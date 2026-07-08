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

        $this->jsonResponse([
            'visits_this_week'  => $visitsWeek,
            'total_registered'  => $totalRegistered,
            'unattended'        => $unattended,
            'pending_rechecks'  => $pendingRechecks,
            'inventory_count'   => $inventoryCount,
            'visits_by_college' => $visitsByCollege,
            'top_diagnoses'     => $topDiagnoses,
        ]);
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
