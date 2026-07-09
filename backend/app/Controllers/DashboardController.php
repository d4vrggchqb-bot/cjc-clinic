<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class DashboardController {

    public function stats() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $visitsWeek = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
            $stmt->execute();
            $visitsWeek = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard visits_week error: " . $e->getMessage());
        }

        $totalRegistered = 0;
        try {
            $stmt            = $pdo->prepare("SELECT COUNT(*) FROM profiles");
            $stmt->execute();
            $totalRegistered = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard total_registered error: " . $e->getMessage());
        }

        $unattended = 0;
        try {
            $stmt       = $pdo->query("SELECT COUNT(*) FROM consultations WHERE status IN ('pending','waiting','no-show')");
            if ($stmt) {
                $unattended = (int)$stmt->fetchColumn();
            }
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard unattended error: " . $e->getMessage());
        }

        $pendingRechecks = 0;
        try {
            $colCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'follow_up'");
            if ($colCheck && $colCheck->fetch()) {
                $stmt            = $pdo->query("SELECT COUNT(*) FROM consultations WHERE follow_up = 1");
                if ($stmt) $pendingRechecks = (int)$stmt->fetchColumn();
            } else {
                $stmt = $pdo->query("SELECT COUNT(*) FROM consultations WHERE status IN ('follow-up','recheck')");
                if ($stmt) $pendingRechecks = (int)$stmt->fetchColumn();
            }
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard pending_rechecks error: " . $e->getMessage());
        }

        $inventoryCount = 0;
        try {
            $stmt           = $pdo->query("SELECT COUNT(*) FROM inventory");
            if ($stmt) $inventoryCount = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard inventory_count error: " . $e->getMessage());
        }

        $colleges = [
            'BED Department',
            'College of Accounting, Business and Entreprenueurship (CABE)',
            'College of Education and Sciences (CEDAS)',
            'College of Health Sciences (CHS)',
            'College of Computing and Information Sciences (CCIS)',
            'College of Engineering (COE)',
            'College of Special Programs (CSP)',
        ];
        $visitsByCollege = array_fill_keys($colleges, 0);

        try {
            $hasCollegeInConsult = false;
            $colCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'college'");
            if ($colCheck && $colCheck->fetch()) {
                $hasCollegeInConsult = true;
                $stmt = $pdo->query("SELECT college, COUNT(*) AS cnt FROM consultations GROUP BY college");
                if ($stmt) {
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $key = $row['college'];
                        if ($key && array_key_exists($key, $visitsByCollege)) {
                            $visitsByCollege[$key] = (int)$row['cnt'];
                        }
                    }
                }
            }

            if (!$hasCollegeInConsult) {
                $profileCollegeCol = null;
                $possibleCols      = ['college', 'program', 'department', 'course'];
                foreach ($possibleCols as $col) {
                    $check = $pdo->query("SHOW COLUMNS FROM profiles LIKE '{$col}'");
                    if ($check && $check->fetch()) {
                        $profileCollegeCol = $col;
                        break;
                    }
                }

                if ($profileCollegeCol !== null) {
                    $sql  = "SELECT p.{$profileCollegeCol} AS college, COUNT(c.id) AS cnt
                             FROM consultations c
                             LEFT JOIN profiles p ON p.id = c.profile_id
                             GROUP BY p.{$profileCollegeCol}";
                    $stmt = $pdo->query($sql);
                    if ($stmt) {
                        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                            $key = $row['college'];
                            if ($key && array_key_exists($key, $visitsByCollege)) {
                                $visitsByCollege[$key] = (int)$row['cnt'];
                            }
                        }
                    }
                }
            }
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard visits_by_college error: " . $e->getMessage());
        }

        $topDiagnoses = [];
        try {
            $diagCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'diagnosis'");
            if ($diagCheck && $diagCheck->fetch()) {
                $stmt = $pdo->query(
                    "SELECT diagnosis, COUNT(*) AS cnt FROM consultations GROUP BY diagnosis ORDER BY cnt DESC LIMIT 10"
                );
                if ($stmt) {
                    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $topDiagnoses[] = ['diagnosis' => $r['diagnosis'], 'count' => (int)$r['cnt']];
                    }
                }
            }
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard top_diagnoses error: " . $e->getMessage());
        }

        $topDispensed = [];
        try {
            $stmt = $pdo->query("
                SELECT i.generic_name, SUM(ABS(l.quantity_changed)) as cnt
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                JOIN inventory_items i ON b.item_id = i.id
                WHERE l.action_type IN ('dispense', 'dispose')
                GROUP BY i.generic_name
                ORDER BY cnt DESC LIMIT 5
            ");
            if ($stmt) $topDispensed = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $expiringItems = [];
        try {
            $stmt = $pdo->query("
                SELECT b.batch_number, i.generic_name, b.expired_on, b.stock_remaining, b.clinic_branch
                FROM inventory_batches b
                JOIN inventory_items i ON b.item_id = i.id
                WHERE b.expired_on IS NOT NULL 
                  AND b.stock_remaining > 0 
                  AND b.expired_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                ORDER BY b.expired_on ASC LIMIT 10
            ");
            if ($stmt) $expiringItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $lowStockItems = [];
        try {
            $stmt = $pdo->query("
                SELECT i.generic_name, i.category, IFNULL(SUM(b.stock_remaining), 0) as total_stock, i.alert_threshold
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id
                GROUP BY i.id
                HAVING total_stock <= i.alert_threshold
                LIMIT 10
            ");
            if ($stmt) $lowStockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $this->jsonResponse([
            'visits_this_week'  => $visitsWeek,
            'total_registered'  => $totalRegistered,
            'unattended'        => $unattended,
            'pending_rechecks'  => $pendingRechecks,
            'inventory_count'   => $inventoryCount,
            'visits_by_college' => $visitsByCollege,
            'top_diagnoses'     => $topDiagnoses,
            'top_dispensed'     => $topDispensed,
            'expiring_items'    => $expiringItems,
            'low_stock_items'   => $lowStockItems,
        ]);
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
