<?php
require_once __DIR__ . '/BaseController.php';

class DashboardController extends BaseController {

    public function stats() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branch = $this->getUserBranch();
        
        if ($userRole === 'Superadmin') {
            $branch = $_GET['branch'] ?? 'All Branches';
        }

        $branchConditionAnd = '';
        $branchConditionWhere = '';
        $branchParams = [];
        if ($branch !== 'All Branches') {
            $branchConditionAnd = 'AND clinic_branch = :branch';
            $branchConditionWhere = 'WHERE clinic_branch = :branch';
            $branchParams = ['branch' => $branch];
        }

        $visitsToday = 0;
        try {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = CURDATE() $branchConditionAnd");
            $stmt->execute($branchParams);
            $visitsToday = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard visits_today error: " . $e->getMessage());
        }

        $totalRegistered = 0;
        try {
            $stmt            = $pdo->prepare("SELECT COUNT(*) FROM profiles");
            $stmt->execute();
            $totalRegistered = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {}

        $unattended = 0;
        $pastUnattended = 0;
        try {
            // Count today's unattended queue
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = CURDATE() AND status IN ('pending','waiting','in-progress') $branchConditionAnd");
            $stmt->execute($branchParams);
            $unattended = (int)$stmt->fetchColumn();

            // Count unclosed leftovers from past dates
            $stmtPast = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE DATE(created_at) < CURDATE() AND status IN ('pending','waiting','in-progress') $branchConditionAnd");
            $stmtPast->execute($branchParams);
            $pastUnattended = (int)$stmtPast->fetchColumn();
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
            $bFilter = ($branch !== 'All Branches') ? "AND b.clinic_branch = :branch" : "";
            $stmt = $pdo->prepare("SELECT COUNT(DISTINCT i.id) FROM inventory_items i LEFT JOIN inventory_batches b ON i.id = b.item_id WHERE 1=1 $bFilter");
            $stmt->execute($branchParams);
            $inventoryCount = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("[CJC-CLINIC] dashboard inventory_count error: " . $e->getMessage());
        }

        $colleges = [];
        $programToDept = [];
        try {
            $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('departments_hierarchy', 'bed_hierarchy')");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $values = json_decode($row['setting_value'], true);
                if (is_array($values)) {
                    foreach ($values as $item) {
                        if (isset($item['department'])) {
                            $deptName = $item['department'];
                            $colleges[] = $deptName;
                            if (isset($item['programs']) && is_array($item['programs'])) {
                                foreach ($item['programs'] as $prog) {
                                    $programToDept[strtolower(trim($prog))] = $deptName;
                                }
                            }
                        } elseif (isset($item['program'])) {
                            $colleges[] = $item['program'];
                        }
                    }
                }
            }
        } catch (Exception $e) {
            error_log("[CJC-CLINIC] dashboard fetch colleges error: " . $e->getMessage());
        }
        $visitsByCollege = empty($colleges) ? [] : array_fill_keys($colleges, 0);

        try {
            $sql = "SELECT p.college_dept, p.course, p.sub_type, p.profile_type, COUNT(c.id) AS cnt
                    FROM consultations c
                    LEFT JOIN profiles p ON p.id = c.profile_id
                    WHERE 1=1 $branchConditionAnd
                    GROUP BY p.college_dept, p.course, p.sub_type, p.profile_type";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $dept = trim($row['college_dept'] ?? '');
                $course = trim($row['course'] ?? '');
                $cnt = (int)$row['cnt'];
                $matchedKey = null;

                // 1. Direct exact match on college_dept
                if (!empty($dept) && array_key_exists($dept, $visitsByCollege)) {
                    $matchedKey = $dept;
                }

                // 2. Direct match on course (for BED levels such as Junior High School)
                if (!$matchedKey && !empty($course) && array_key_exists($course, $visitsByCollege)) {
                    $matchedKey = $course;
                }

                // 3. Lookup parent department via program-to-department hierarchy
                if (!$matchedKey && !empty($course)) {
                    $courseLower = strtolower($course);
                    if (isset($programToDept[$courseLower])) {
                        $matchedKey = $programToDept[$courseLower];
                    } else {
                        if (str_contains($courseLower, 'computer') || str_contains($courseLower, 'information') || $courseLower === 'bscs' || $courseLower === 'bsit') {
                            $matchedKey = 'College of Computing and Information Sciences (CCIS)';
                        } elseif (str_contains($courseLower, 'criminology') || $courseLower === 'bscrim') {
                            $matchedKey = 'College of Special Programs (CSP)';
                        } elseif (str_contains($courseLower, 'nursing') || $courseLower === 'bsn') {
                            $matchedKey = 'College of Health Sciences (CHS)';
                        } elseif (str_contains($courseLower, 'engineering')) {
                            $matchedKey = 'College of Engineering (COE)';
                        } elseif (str_contains($courseLower, 'accountancy') || str_contains($courseLower, 'business')) {
                            $matchedKey = 'College of Accounting Business and Entreprenuership (CABE)';
                        }
                    }
                }

                // 4. Substring & acronym match on department name
                if (!$matchedKey && !empty($dept)) {
                    $deptLower = strtolower($dept);
                    foreach (array_keys($visitsByCollege) as $k) {
                        $kLower = strtolower($k);
                        if (str_contains($deptLower, $kLower) || str_contains($kLower, $deptLower)) {
                            $matchedKey = $k;
                            break;
                        }
                        if (preg_match('/\(([^)]+)\)/', $k, $matches)) {
                            $acronym = strtolower($matches[1]);
                            if (str_contains($deptLower, $acronym)) {
                                $matchedKey = $k;
                                break;
                            }
                        }
                    }
                }

                if ($matchedKey && array_key_exists($matchedKey, $visitsByCollege)) {
                    $visitsByCollege[$matchedKey] += $cnt;
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
            $bJoinFilter = ($branch !== 'All Branches') ? "AND b.clinic_branch = :branch" : "";
            $stmt = $pdo->prepare("
                SELECT i.generic_name, SUM(ABS(l.quantity_changed)) as cnt
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                JOIN inventory_items i ON b.item_id = i.id
                WHERE l.action_type IN ('dispense', 'dispose') $bJoinFilter
                GROUP BY i.generic_name
                ORDER BY cnt DESC LIMIT 5
            ");
            $stmt->execute($branchParams);
            $topDispensed = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $expiringItems = [];
        try {
            $bFilter = ($branch !== 'All Branches') ? "AND b.clinic_branch = :branch" : "";
            $sql = "
                SELECT b.batch_number, i.generic_name, b.expired_on, b.stock_remaining, b.clinic_branch
                FROM inventory_batches b
                JOIN inventory_items i ON b.item_id = i.id
                WHERE b.expired_on IS NOT NULL 
                  AND b.stock_remaining > 0 
                  $bFilter
                  AND b.expired_on <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                ORDER BY b.expired_on ASC LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            $expiringItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $lowStockItems = [];
        try {
            $bFilter = ($branch !== 'All Branches') ? "AND b.clinic_branch = :branch" : "";
            $sql = "
                SELECT i.generic_name, i.category, IFNULL(SUM(b.stock_remaining), 0) as total_stock, i.alert_threshold
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id $bFilter
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
            'visits_today' => $visitsToday,
            'total_registered' => $totalRegistered,
            'unattended' => $unattended,
            'past_unattended' => $pastUnattended,
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
}
