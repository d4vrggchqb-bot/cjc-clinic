<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class ReportController {
    
    private function jsonResponse($data, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    public function generateReport() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $userBranch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        
        $startDate = $_GET['start_date'] ?? date('Y-m-d');
        $endDate = $_GET['end_date'] ?? date('Y-m-d');
        
        $branch = $userBranch;
        if (in_array($userRole, ['Superadmin', 'Admin']) && isset($_GET['branch']) && $_GET['branch'] !== 'All Branches') {
            $branch = $_GET['branch'];
        }

        $branchConditionAnd = '';
        $branchParams = ['start_date' => $startDate . ' 00:00:00', 'end_date' => $endDate . ' 23:59:59'];
        
        if (!in_array($userRole, ['Superadmin', 'Admin']) || (isset($_GET['branch']) && $_GET['branch'] !== 'All Branches')) {
            $branchConditionAnd = 'AND clinic_branch = :branch';
            $branchParams['branch'] = $branch;
        } else {
            $branch = 'All Branches';
        }

        // 1. Total Visits by Type (Student vs Employee vs Others)
        $visitsByType = [];
        try {
            $sql = "
                SELECT p.profile_type, COUNT(c.id) as cnt
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd
                GROUP BY p.profile_type
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $type = $row['profile_type'] ?: 'Unknown';
                $visitsByType[] = ['type' => ucfirst($type), 'count' => (int)$row['cnt']];
            }
        } catch (PDOException $e) {}

        // 2. Top Diagnoses (Morbidity)
        $topDiagnoses = [];
        try {
            $sql = "
                SELECT diagnosis, COUNT(*) as cnt
                FROM consultations
                WHERE diagnosis IS NOT NULL AND diagnosis != '' 
                AND created_at BETWEEN :start_date AND :end_date $branchConditionAnd
                GROUP BY diagnosis
                ORDER BY cnt DESC
                LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $topDiagnoses[] = ['diagnosis' => $row['diagnosis'], 'count' => (int)$row['cnt']];
            }
        } catch (PDOException $e) {}

        // 3. Medicines Dispensed
        $medicinesDispensed = [];
        try {
            $sql = "
                SELECT i.generic_name, SUM(ABS(l.quantity_changed)) as cnt
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                JOIN inventory_items i ON b.item_id = i.id
                WHERE l.action_type IN ('dispense') 
                AND l.created_at BETWEEN :start_date AND :end_date
                $branchConditionAnd
                GROUP BY i.generic_name
                ORDER BY cnt DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $medicinesDispensed[] = ['medicine' => $row['generic_name'], 'count' => (int)$row['cnt']];
            }
        } catch (PDOException $e) {}

        // 4. Raw Export Data (Logbook)
        $exportData = [];
        try {
            $sql = "
                SELECT 
                    c.created_at as Date,
                    c.clinic_branch as Branch,
                    p.id_number as ID_Number,
                    p.name as Patient_Name,
                    p.profile_type as Type,
                    c.purpose as Purpose,
                    c.diagnosis as Diagnosis,
                    c.treatment as Treatment,
                    c.attended_by as Attended_By
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd
                ORDER BY c.created_at DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            $exportData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}

        $this->jsonResponse([
            'user_role' => $userRole,
            'current_branch' => $branch,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'visits_by_type' => $visitsByType,
            'top_diagnoses' => $topDiagnoses,
            'medicines_dispensed' => $medicinesDispensed,
            'export_data' => $exportData
        ]);
    }
}
