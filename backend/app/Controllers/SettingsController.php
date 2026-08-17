<?php
require_once __DIR__ . '/BaseController.php';

class SettingsController extends BaseController {

    public function getSettings() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $settings = [];

        try {
            $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings");
            while ($row = $stmt->fetch()) {
                $key = $row['setting_key'];
                $val = $row['setting_value'];
                
                // Try decoding JSON for array types
                $decoded = json_decode($val, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $settings[$key] = $decoded;
                } else {
                    $settings[$key] = $val;
                }
            }
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Settings fetch error: ' . $e->getMessage());
        }

        $this->jsonResponse(['settings' => $settings]);
    }

    public function updateSettings() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Superadmin']);
        
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        if (empty($input)) {
            $this->jsonResponse(['success' => false, 'message' => 'No settings provided.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (:key, :val) ON DUPLICATE KEY UPDATE setting_value = :val2");
            
            foreach ($input as $key => $val) {
                $valueToStore = is_array($val) ? json_encode($val) : (string)$val;
                $stmt->execute(['key' => $key, 'val' => $valueToStore, 'val2' => $valueToStore]);
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            error_log('[CJC-CLINIC] Settings update error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Failed to save settings.'], 500);
        }
    }
    
    public function importCSV() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcRequireRole(['Admin', 'Superadmin']);
        cjcCsrfValidate();

        if (!isset($_FILES['file'])) {
            $this->jsonResponse(['success' => false, 'message' => 'No file uploaded.'], 400);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $this->jsonResponse(['success' => false, 'message' => 'File upload error.'], 400);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($ext !== 'csv') {
            $this->jsonResponse(['success' => false, 'message' => 'Only CSV files are supported right now.'], 400);
        }

        $handle = fopen($file['tmp_name'], 'r');
        if (!$handle) {
            $this->jsonResponse(['success' => false, 'message' => 'Cannot read file.'], 500);
        }

        $pdo = cjcDatabaseConnection();
        $pdo->beginTransaction();

        $successCount = 0;
        $skipCount = 0;
        $row = 0;

        try {
            $stmt = $pdo->prepare("
                INSERT INTO profiles (patient_id_number, last_name, first_name, middle_initial, gender, birthdate, course, year_level, college_dept, contact, profile_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $row++;
                if ($row === 1) continue; // Skip header

                // Map to columns: A=ID, B=LastName, C=FirstName, D=MI, E=Gender, F=DOB, G=Course, H=Year, I=Dept, J=Contact, K=Type
                if (count($data) < 11) {
                    continue; // Skip invalid rows
                }

                $id_num = trim($data[0]);
                if (empty($id_num)) continue;

                // Check if exists
                $check = $pdo->prepare("SELECT id FROM profiles WHERE patient_id_number = ? LIMIT 1");
                $check->execute([$id_num]);
                if ($check->fetch()) {
                    $skipCount++;
                    continue;
                }

                $dob = trim($data[5]);
                if (empty($dob)) $dob = null;
                
                $stmt->execute([
                    $id_num,
                    trim($data[1]),
                    trim($data[2]),
                    trim($data[3]),
                    trim($data[4]),
                    $dob,
                    trim($data[6]),
                    trim($data[7]),
                    trim($data[8]),
                    trim($data[9]),
                    trim($data[10])
                ]);
                $successCount++;
            }
            
            $pdo->commit();
            fclose($handle);
            
            $this->jsonResponse([
                'success' => true, 
                'message' => "Import complete. $successCount added, $skipCount skipped."
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            fclose($handle);
            error_log('[CJC-CLINIC] CSV Import error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Import failed.'], 500);
        }
    }

    public function backupDatabase() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin']);
        
        $pdo = cjcDatabaseConnection();
        $date = date('Y-m-d_H-i-s');
        $filename = "cjc_clinic_backup_$date.sql";
        
        // Store in non-public storage directory
        $backupDir = __DIR__ . '/../../storage/backups';
        if (!is_dir($backupDir)) {
            mkdir($backupDir, 0750, true);
        }
        
        $filepath = "$backupDir/$filename";

        try {
            $tables = [];
            $stmt = $pdo->query('SHOW TABLES');
            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                $tables[] = $row[0];
            }

            $sqlDump = "-- CJC Clinic Database Backup\n";
            $sqlDump .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
            $sqlDump .= "-- Host: " . (getenv('DB_HOST') ?: 'localhost') . "\n";
            $sqlDump .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

            foreach ($tables as $table) {
                // Table schema
                $createStmt = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
                $sqlDump .= "DROP TABLE IF EXISTS `$table`;\n";
                $sqlDump .= $createStmt[1] . ";\n\n";

                // Table data
                $dataStmt = $pdo->query("SELECT * FROM `$table`");
                $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($rows)) {
                    $columns = array_keys($rows[0]);
                    $colList = implode('`, `', $columns);

                    foreach ($rows as $r) {
                        $values = array_map(function($v) use ($pdo) {
                            if ($v === null) return 'NULL';
                            return $pdo->quote($v);
                        }, array_values($r));

                        $sqlDump .= "INSERT INTO `$table` (`$colList`) VALUES (" . implode(', ', $values) . ");\n";
                    }
                    $sqlDump .= "\n";
                }
            }

            $sqlDump .= "SET FOREIGN_KEY_CHECKS=1;\n";
            file_put_contents($filepath, $sqlDump);

            cjcLogAudit("Generated database backup: $filename", 'BACKUP', 'Settings');
            $this->jsonResponse(['success' => true, 'message' => "Database backup successfully saved to server storage: $filename"]);
        } catch (Exception $e) {
            error_log('[CJC-CLINIC] Database backup error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Failed to generate database backup.'], 500);
        }
    }

    public function exportHealthRecords() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcRequireRole(['Admin', 'Superadmin']);
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->query("SELECT * FROM profiles ORDER BY last_name ASC");
        
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="health_records_' . date('Y-m-d') . '.csv"');
        
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Last Name', 'First Name', 'MI', 'Gender', 'Birthdate', 'Course', 'Year', 'Dept', 'Contact', 'Type']);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($out, [
                $row['patient_id_number'], $row['last_name'], $row['first_name'], $row['middle_initial'],
                $row['gender'], $row['birthdate'], $row['course'], $row['year_level'], $row['college_dept'],
                $row['contact'], $row['profile_type']
            ]);
        }
        fclose($out);
        exit;
    }

    public function exportVisitLog() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcRequireRole(['Admin', 'Superadmin']);
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->query("
            SELECT p.patient_id_number, p.last_name, p.first_name, c.created_at, c.time_out, c.purpose, c.attended_by 
            FROM consultations c 
            JOIN profiles p ON c.profile_id = p.id 
            ORDER BY c.created_at DESC
        ");
        
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="visit_log_' . date('Y-m-d') . '.csv"');
        
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Patient ID', 'Last Name', 'First Name', 'Time In', 'Time Out', 'Purpose', 'Attended By']);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($out, $row);
        }
        fclose($out);
        exit;
    }
}
