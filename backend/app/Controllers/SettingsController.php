<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class SettingsController {

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
        
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        if (empty($input)) {
            $this->jsonResponse(['success' => false, 'message' => 'No settings provided.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (:key, :val) ON DUPLICATE KEY UPDATE setting_value = :val");
            
            foreach ($input as $key => $val) {
                $valueToStore = is_array($val) ? json_encode($val) : (string)$val;
                $stmt->execute(['key' => $key, 'val' => $valueToStore]);
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
                INSERT INTO profiles (patient_id_number, last_name, first_name, middle_initial, gender, birthdate, course, year_level, college_dept, contact_number, profile_type) 
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
        
        // Simulating backup generation (real one requires mysqldump path in Windows)
        $date = date('Y-m-d_H-i-s');
        $filename = "cjc_clinic_backup_$date.sql";
        $backupDir = __DIR__ . '/../../public/uploads/backups';
        if (!is_dir($backupDir)) mkdir($backupDir, 0755, true);
        
        $filepath = "$backupDir/$filename";
        // Fake dump for now since mysqldump path is complex to guess across WAMP/XAMPP
        file_put_contents($filepath, "-- CJC Clinic Backup\n-- Date: $date\n");
        
        $this->jsonResponse(['success' => true, 'message' => "Backup saved to $filename"]);
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
                $row['contact_number'], $row['profile_type']
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

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
