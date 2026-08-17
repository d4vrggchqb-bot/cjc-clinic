<?php
require_once __DIR__ . '/BaseController.php';

class ReportController extends BaseController {

    public function generateReport() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $userBranch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        
        $startDate = $_GET['start_date'] ?? date('Y-m-d');
        $endDate = $_GET['end_date'] ?? date('Y-m-d');
        $department = $_GET['department'] ?? 'All Departments';
        $program = $_GET['program'] ?? 'All Programs';
        $yearLevel = $_GET['year_level'] ?? 'All Year Levels';
        $semester = $_GET['semester'] ?? 'All Semesters';
        $purpose = $_GET['purpose'] ?? 'All Purposes';
        
        $branch = $userBranch;
        if ($userRole === 'Superadmin' && isset($_GET['branch']) && $_GET['branch'] !== 'All Branches') {
            $branch = $_GET['branch'];
        }

        $branchConditionAnd = '';
        $branchParams = ['start_date' => $startDate . ' 00:00:00', 'end_date' => $endDate . ' 23:59:59'];
        
        if ($userRole !== 'Superadmin' || (isset($_GET['branch']) && $_GET['branch'] !== 'All Branches')) {
            $branchConditionAnd = 'AND c.clinic_branch = :branch';
            $branchParams['branch'] = $branch;
        } else {
            $branch = 'All Branches';
        }

        $profileConditions = '';
        if ($department !== 'All Departments' && !empty($department)) {
            $profileConditions .= ' AND p.college_dept = :dept';
            $branchParams['dept'] = $department;
        }
        if ($program !== 'All Programs' && !empty($program)) {
            $profileConditions .= ' AND p.course = :course';
            $branchParams['course'] = $program;
        }
        if ($yearLevel !== 'All Year Levels' && !empty($yearLevel)) {
            $profileConditions .= ' AND p.year_level = :year_level';
            $branchParams['year_level'] = $yearLevel;
        }
        if ($purpose !== 'All Purposes' && !empty($purpose)) {
            $profileConditions .= ' AND c.purpose LIKE :purpose';
            $branchParams['purpose'] = '%' . $purpose . '%';
        }

        // 1. Total Visits by Type (Student vs Employee vs Others)
        $visitsByType = [];
        try {
            $sql = "
                SELECT p.profile_type, COUNT(c.id) as cnt
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $profileConditions
                GROUP BY p.profile_type
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $type = $row['profile_type'] ?: 'Unknown';
                $visitsByType[] = ['type' => ucfirst($type), 'count' => (int)$row['cnt']];
            }
        } catch (PDOException $e) { error_log('Reports Visits Error: ' . $e->getMessage()); }

        // 2. Top Diagnoses (Morbidity)
        $topDiagnoses = [];
        try {
            $sql = "
                SELECT c.diagnosis, COUNT(*) as cnt
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.diagnosis IS NOT NULL AND c.diagnosis != '' 
                AND c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $profileConditions
                GROUP BY c.diagnosis
                ORDER BY cnt DESC
                LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $topDiagnoses[] = ['diagnosis' => $row['diagnosis'], 'count' => (int)$row['cnt']];
            }
        } catch (PDOException $e) { error_log('Reports Diagnoses Error: ' . $e->getMessage()); }

        // 3. Medicines Dispensed
        $medicinesDispensed = [];
        try {
            // Need to handle branch logic for medicines specifically since it uses inventory_batches
            $medBranchCondition = '';
            if (isset($branchParams['branch'])) {
                $medBranchCondition = ' AND b.clinic_branch = :branch ';
            }

            $sql = "
                SELECT i.generic_name, SUM(ABS(l.quantity_changed)) as cnt, l.disposed_to as patient
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                JOIN inventory_items i ON b.item_id = i.id
                LEFT JOIN profiles p ON l.profile_id = p.id
                WHERE l.action_type IN ('dispense') 
                AND l.created_at BETWEEN :start_date AND :end_date
                $medBranchCondition $profileConditions
                GROUP BY i.generic_name, l.disposed_to
                ORDER BY cnt DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $medicinesDispensed[] = [
                    'medicine' => $row['generic_name'], 
                    'count' => (int)$row['cnt'],
                    'patient' => $row['patient'] ?: 'Walk-in/Unknown'
                ];
            }
        } catch (PDOException $e) { error_log('Reports Medicines Error: ' . $e->getMessage()); }

        // 4. Raw Export Data (Logbook)
        $exportData = [];
        try {
            $sql = "
                SELECT 
                    c.created_at as Date,
                    c.clinic_branch as Branch,
                    p.patient_id_number as ID_Number,
                    CONCAT(p.first_name, ' ', p.last_name) as Patient_Name,
                    p.profile_type as Type,
                    c.purpose as Purpose,
                    c.diagnosis as Diagnosis,
                    c.treatment as Treatment,
                    c.attended_by as Attended_By
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $profileConditions
                ORDER BY c.created_at DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            $exportData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) { error_log('Reports Export Error: ' . $e->getMessage()); }

        // 5. Equipment Borrowings Stats
        $equipmentBorrowings = [];
        try {
            $sql = "
                SELECT i.generic_name, COUNT(bi.id) as cnt
                FROM borrowed_items bi
                JOIN borrowings b ON bi.borrowing_id = b.id
                JOIN inventory_items i ON bi.inventory_item_id = i.id
                LEFT JOIN profiles p ON b.profile_id = p.id
                WHERE b.created_at BETWEEN :start_date AND :end_date
                AND bi.item_type = 'equipment'
                $profileConditions
                GROUP BY i.generic_name
                ORDER BY cnt DESC
                LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $equipmentBorrowings[] = [
                    'equipment' => $row['generic_name'],
                    'count' => (int)$row['cnt']
                ];
            }
        } catch (PDOException $e) { error_log('Reports Equipment Error: ' . $e->getMessage()); }

        // 6. Borrowing Export Data
        $borrowingExportData = [];
        try {
            $sql = "
                SELECT 
                    b.created_at as Date,
                    p.patient_id_number as ID_Number,
                    CONCAT(p.first_name, ' ', p.last_name) as Patient_Name,
                    p.profile_type as Type,
                    b.purpose as Purpose,
                    i.generic_name as Item_Name,
                    bi.item_type as Item_Type,
                    bi.quantity as Quantity,
                    bi.status as Status
                FROM borrowings b
                JOIN borrowed_items bi ON bi.borrowing_id = b.id
                JOIN inventory_items i ON bi.inventory_item_id = i.id
                LEFT JOIN profiles p ON b.profile_id = p.id
                WHERE b.created_at BETWEEN :start_date AND :end_date
                $profileConditions
                ORDER BY b.created_at DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($branchParams);
            $borrowingExportData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) { error_log('Reports Borrowing Export Error: ' . $e->getMessage()); }

        $this->jsonResponse([
            'user_role' => $userRole,
            'user_name' => $_SESSION['cjc_user']['name'] ?? $_SESSION['cjc_user']['username'] ?? 'Clinic Staff',
            'current_branch' => $branch,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'department' => $department,
            'program' => $program,
            'year_level' => $yearLevel,
            'visits_by_type' => $visitsByType,
            'top_diagnoses' => $topDiagnoses,
            'medicines_dispensed' => $medicinesDispensed,
            'equipment_borrowings' => $equipmentBorrowings,
            'export_data' => $exportData,
            'borrowing_export_data' => $borrowingExportData
        ]);
    }
}
