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

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $userBranch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        $branch = $userBranch;
        
        if ($userRole === 'Superadmin' && isset($_GET['branch']) && $_GET['branch'] !== 'All Branches') {
            $branch = $_GET['branch'];
        }

        $branchConditionAnd = '';
        $branchConditionWhere = '';
        $branchParams = [];
        if ($userRole !== 'Superadmin' || (isset($_GET['branch']) && $_GET['branch'] !== 'All Branches')) {
            $branchConditionAnd = 'AND clinic_branch = :branch';
            $branchConditionWhere = 'WHERE clinic_branch = :branch';
            $branchParams = ['branch' => $branch];
        } else {
            $branch = 'All Branches';
        }

        $visitsWeek = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) $branchConditionAnd");
            $stmt->execute($branchParams);
            $visitsWeek = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard visits_week error: " . $e->getMessage());
        }

        $totalRegistered = 0;
        try {
            $stmt            = $pdo->prepare("SELECT COUNT(*) FROM profiles");
            $stmt->execute();
            $totalRegistered = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {}

        $unattended = 0;
        try {
            $stmt       = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE status IN ('pending','waiting','no-show') $branchConditionAnd");
            $stmt->execute($branchParams);
            $unattended = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {}

        $pendingRechecks = 0;
        try {
            $colCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'follow_up'");
            if ($colCheck && $colCheck->fetch()) {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE follow_up = 1 $branchConditionAnd");
            } else {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE status IN ('follow-up','recheck') $branchConditionAnd");
            }
            $stmt->execute($branchParams);
            $pendingRechecks = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {}

        $inventoryCount = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(DISTINCT i.id) FROM inventory_items i LEFT JOIN inventory_batches b ON i.id = b.item_id $branchConditionAnd");
            $stmt->execute($branchParams);
            $inventoryCount = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard inventory_count error: " . $e->getMessage());
        }

        $colleges = [];
        try {
            $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key IN ('departments', 'bed_departments')");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $values = json_decode($row['setting_value'], true);
                if (is_array($values)) {
                    $colleges = array_merge($colleges, $values);
                }
            }
        } catch (Exception $e) {
            error_log("[CJC-CLINIC] dashboard fetch colleges error: " . $e->getMessage());
        }
        $visitsByCollege = empty($colleges) ? [] : array_fill_keys($colleges, 0);

        try {
            $hasCollegeInConsult = false;
            $colCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'college'");
            if ($colCheck && $colCheck->fetch()) {
                $hasCollegeInConsult = true;
                $stmt = $pdo->prepare("SELECT college, COUNT(*) AS cnt FROM consultations WHERE 1=1 $branchConditionAnd GROUP BY college");
                $stmt->execute($branchParams);
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $key = $row['college'];
                    if ($key && array_key_exists($key, $visitsByCollege)) {
                        $visitsByCollege[$key] = (int)$row['cnt'];
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
                             WHERE 1=1 $branchConditionAnd
                             GROUP BY p.{$profileCollegeCol}";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($branchParams);
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $key = $row['college'];
                        if ($key && array_key_exists($key, $visitsByCollege)) {
                            $visitsByCollege[$key] = (int)$row['cnt'];
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
                $stmt = $pdo->prepare(
                    "SELECT diagnosis, COUNT(*) AS cnt FROM consultations WHERE diagnosis IS NOT NULL AND diagnosis != '' $branchConditionAnd GROUP BY diagnosis ORDER BY cnt DESC LIMIT 5"
                );
                $stmt->execute($branchParams);
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $topDiagnoses[] = ['diagnosis' => $r['diagnosis'], 'count' => (int)$r['cnt']];
                }
            }
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard top_diagnoses error: " . $e->getMessage());
        }

        $visitTrends = [];
        try {
            $trendCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'created_at'");
            if ($trendCheck && $trendCheck->fetch()) {
                $stmt = $pdo->prepare("
                    SELECT DATE(created_at) as visit_date, COUNT(*) as cnt 
                    FROM consultations 
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) $branchConditionAnd
                    GROUP BY DATE(created_at)
                ");
                $stmt->execute($branchParams);
                $visitMap = [];
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $visitMap[$r['visit_date']] = (int)$r['cnt'];
                }
                
                for ($i = 6; $i >= 0; $i--) {
                    $date = date('Y-m-d', strtotime("-$i days"));
                    $visitTrends[] = [
                        'date' => date('M j', strtotime($date)),
                        'visits' => $visitMap[$date] ?? 0
                    ];
                }
            }
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard visit_trends error: " . $e->getMessage());
        }

        $topDispensed = [];
        try {
            $stmt = $pdo->prepare("
                SELECT i.generic_name, SUM(ABS(l.quantity_changed)) as cnt
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                JOIN inventory_items i ON b.item_id = i.id
                WHERE l.action_type IN ('dispense', 'dispose') $branchConditionAnd
                GROUP BY i.generic_name
                ORDER BY cnt DESC LIMIT 5
            ");
            $stmt->execute($branchParams);
            $topDispensed = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $expiringItems = [];
        try {
            $sql = "
                SELECT b.batch_number, i.generic_name, b.expired_on, b.stock_remaining, b.clinic_branch
                FROM inventory_batches b
                JOIN inventory_items i ON b.item_id = i.id
                WHERE b.expired_on IS NOT NULL 
                  AND b.stock_remaining > 0 
                  $branchConditionAnd
                  AND b.expired_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                ORDER BY b.expired_on ASC LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            $expiringItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $lowStockItems = [];
        try {
            // For low stock, we sum the batches for each item. 
            // If branch is specific, we only sum for that branch.
            $sql = "
                SELECT i.generic_name, i.category, IFNULL(SUM(b.stock_remaining), 0) as total_stock, i.alert_threshold
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id $branchConditionAnd
                GROUP BY i.id
                HAVING total_stock <= i.alert_threshold
                LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            $lowStockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $currentlyCheckedOut = 0;
        try {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) FROM borrowed_items bi 
                JOIN borrowings b ON bi.borrowing_id = b.id 
                WHERE bi.status = 'borrowed' AND bi.item_type = 'equipment' 
                -- We can't strictly filter branch here unless borrowings table has clinic_branch, 
                -- but we will assume global or if branch exists we can add it later.
            ");
            $stmt->execute();
            $currentlyCheckedOut = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {}

        $recentBorrowings = [];
        try {
            $stmt = $pdo->prepare("
                SELECT b.id, b.purpose, b.created_at, p.id as profile_id, p.first_name, p.last_name, p.profile_type,
                       GROUP_CONCAT(i.generic_name SEPARATOR ', ') as items
                FROM borrowings b
                JOIN profiles p ON b.profile_id = p.id
                JOIN borrowed_items bi ON bi.borrowing_id = b.id
                JOIN inventory_items i ON bi.inventory_item_id = i.id
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT 5
            ");
            $stmt->execute();
            $recentBorrowings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $this->jsonResponse([
            'user_role' => $userRole,
            'current_branch' => $branch,
            'visits_week' => $visitsWeek,
            'total_registered' => $totalRegistered,
            'unattended' => $unattended,
            'pending_rechecks' => $pendingRechecks,
            'inventory_count' => $inventoryCount,
            'visits_by_college' => $visitsByCollege,
            'top_diagnoses' => $topDiagnoses,
            'visit_trends' => $visitTrends,
            'top_dispensed' => $topDispensed,
            'expiring_items' => $expiringItems,
            'low_stock_items' => $lowStockItems,
            'currently_checked_out' => $currentlyCheckedOut,
            'recent_borrowings' => $recentBorrowings
        ]);
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
