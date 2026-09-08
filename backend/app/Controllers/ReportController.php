<?php
require_once __DIR__ . '/BaseController.php';

class ReportController extends BaseController {

    private function ensureActivityLogSchema($pdo) {
        // Backward-compatible migration for installations created before the
        // activity feed existed.
        $column = $pdo->query("SHOW COLUMNS FROM appointments LIKE 'created_by'")->fetch();
        if (!$column) {
            $pdo->exec("ALTER TABLE appointments ADD COLUMN created_by INT NULL AFTER clinic_branch");
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY, user_id INT DEFAULT NULL,
            user_name VARCHAR(100) DEFAULT NULL, action_type VARCHAR(50) DEFAULT 'UPDATE',
            module VARCHAR(50) DEFAULT 'General', details TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");
    }

    /**
     * A paginated, cross-module activity feed for Superadmins.  This is kept
     * separate from generateReport() so the standard reports payload does not
     * grow with every historical transaction.
     */
    public function getActivityLog() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        cjcRequireRole(['Superadmin']);

        $pdo = cjcDatabaseConnection();
        $this->ensureActivityLogSchema($pdo);
        $startDate = $_GET['start_date'] ?? date('Y-m-d');
        $endDate = $_GET['end_date'] ?? date('Y-m-d');
        $branch = trim($_GET['branch'] ?? 'All Branches');
        $module = trim($_GET['module'] ?? 'All');
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 5)));

        $allowedModules = ['All', 'Sign-in', 'Patient', 'Consultation', 'Appointment', 'Borrowing', 'Inventory', 'Audit'];
        if (!in_array($module, $allowedModules, true)) $module = 'All';

        $from = $startDate . ' 00:00:00';
        $to = $endDate . ' 23:59:59';
        $parts = [];
        $params = [];
        $add = function ($sourceModule, $sql, $sourceParams = []) use (&$parts, &$params, $module) {
            if ($module === 'All' || $module === $sourceModule) {
                $parts[] = $sql;
                array_push($params, ...$sourceParams);
            }
        };

        // Columns are intentionally normalized and exclude clinical notes,
        // treatment and diagnosis from the administrative activity feed.
        $auditBranch = $branch === 'All Branches' ? '' : ' AND COALESCE(u.clinic_branch, \'\') = ?';
        $add('Audit', "SELECT al.created_at AS occurred_at, 'Audit' AS module, al.action_type AS action,
                    COALESCE(al.user_name, 'System') AS actor, NULL AS subject,
                    COALESCE(u.clinic_branch, '') AS branch, al.details AS summary
              FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
              WHERE al.created_at BETWEEN ? AND ?$auditBranch", $branch === 'All Branches' ? [$from, $to] : [$from, $to, $branch]);

        $consultationBranch = $branch === 'All Branches' ? '' : ' AND c.clinic_branch = ?';
        $add('Consultation', "SELECT c.created_at AS occurred_at, 'Consultation' AS module, 'Created' AS action,
                    COALESCE(c.attended_by, c.assigned_to, 'Clinic staff') AS actor,
                    CONCAT(p.first_name, ' ', p.last_name) AS subject, c.clinic_branch AS branch,
                    CONCAT('Consultation: ', c.purpose, ' (', c.status, ')') AS summary
              FROM consultations c LEFT JOIN profiles p ON p.id = c.profile_id
              WHERE c.created_at BETWEEN ? AND ?$consultationBranch", $branch === 'All Branches' ? [$from, $to] : [$from, $to, $branch]);

        $appointmentBranch = $branch === 'All Branches' ? '' : ' AND a.clinic_branch = ?';
        $add('Appointment', "SELECT a.created_at AS occurred_at, 'Appointment' AS module, 'Created' AS action,
                    COALESCE(creator.name, 'Unknown (legacy record)') AS actor, CONCAT(p.first_name, ' ', p.last_name) AS subject,
                    a.clinic_branch AS branch,
                    CONCAT('Appointment: ', a.purpose, ' on ', a.appointment_date, ' (', a.status, ')') AS summary
              FROM appointments a LEFT JOIN profiles p ON p.id = a.profile_id
              LEFT JOIN users creator ON creator.id = a.created_by
              WHERE a.created_at BETWEEN ? AND ?$appointmentBranch", $branch === 'All Branches' ? [$from, $to] : [$from, $to, $branch]);

        $borrowingBranch = $branch === 'All Branches' ? '' : ' AND COALESCE(u.clinic_branch, \'\') = ?';
        $add('Borrowing', "SELECT b.created_at AS occurred_at, 'Borrowing' AS module, 'Released' AS action,
                    COALESCE(u.name, 'Clinic staff') AS actor, CONCAT(p.first_name, ' ', p.last_name) AS subject,
                    COALESCE(u.clinic_branch, '') AS branch,
                    CONCAT('Borrowing: ', b.purpose, ' (', b.status, ')') AS summary
              FROM borrowings b LEFT JOIN profiles p ON p.id = b.profile_id
              LEFT JOIN users u ON u.id = b.released_by
              WHERE b.created_at BETWEEN ? AND ?$borrowingBranch", $branch === 'All Branches' ? [$from, $to] : [$from, $to, $branch]);

        $inventoryBranch = $branch === 'All Branches' ? '' : ' AND ib.clinic_branch = ?';
        $add('Inventory', "SELECT il.created_at AS occurred_at, 'Inventory' AS module, UPPER(il.action_type) AS action,
                    COALESCE(u.name, 'Clinic staff') AS actor, CONCAT(ii.generic_name, ' (', il.quantity_changed, ')') AS subject,
                    ib.clinic_branch AS branch,
                    COALESCE(il.disposed_to, CONCAT('Inventory ', il.action_type)) AS summary
              FROM inventory_logs il JOIN inventory_batches ib ON ib.id = il.batch_id
              JOIN inventory_items ii ON ii.id = ib.item_id LEFT JOIN users u ON u.id = il.processed_by
              WHERE il.created_at BETWEEN ? AND ?$inventoryBranch", $branch === 'All Branches' ? [$from, $to] : [$from, $to, $branch]);

        // Profiles do not have a branch column. They are shown only in the
        // all-branches view to avoid implying that a patient belongs to a branch.
        if ($branch === 'All Branches') {
            $add('Patient', "SELECT p.created_at AS occurred_at, 'Patient' AS module, 'Created' AS action,
                        'Unknown (actor not recorded)' AS actor, CONCAT(p.first_name, ' ', p.last_name) AS subject,
                        '' AS branch, CONCAT('Patient profile created: ', COALESCE(p.patient_id_number, CONCAT('Profile #', p.id))) AS summary
                  FROM profiles p WHERE p.created_at BETWEEN ? AND ?", [$from, $to]);
        }

        if (!$parts) $this->jsonResponse(['records' => [], 'has_more' => false, 'next_offset' => $offset]);

        $sql = 'SELECT * FROM (' . implode(' UNION ALL ', $parts) . ') activity ORDER BY occurred_at DESC LIMIT ' . ($limit + 1) . ' OFFSET ' . $offset;
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $hasMore = count($records) > $limit;
            if ($hasMore) array_pop($records);
            $this->jsonResponse(['records' => $records, 'has_more' => $hasMore, 'next_offset' => $offset + count($records)]);
        } catch (PDOException $e) {
            error_log('Activity log error: ' . $e->getMessage());
            $this->jsonResponse(['error' => 'Unable to load activity log.'], 500);
        }
    }

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
        $profileParams = [];
        if ($department !== 'All Departments' && !empty($department)) {
            $profileConditions .= ' AND p.college_dept = :dept';
            $profileParams['dept'] = $department;
        }
        if ($program !== 'All Programs' && !empty($program)) {
            $profileConditions .= ' AND p.course = :course';
            $profileParams['course'] = $program;
        }
        if ($yearLevel !== 'All Year Levels' && !empty($yearLevel)) {
            $profileConditions .= ' AND p.year_level = :year_level';
            $profileParams['year_level'] = $yearLevel;
        }

        $consultationConditions = $profileConditions;
        $consultationParams = $branchParams + $profileParams;
        if ($purpose !== 'All Purposes' && !empty($purpose)) {
            $consultationConditions .= ' AND c.purpose LIKE :purpose';
            $consultationParams['purpose'] = '%' . $purpose . '%';
        }

        // 1. Total Visits by Type (Student vs Employee vs Others)
        $visitsByType = [];
        try {
            $sql = "
                SELECT p.profile_type, COUNT(c.id) as cnt
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $consultationConditions
                GROUP BY p.profile_type
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($consultationParams);
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
                AND c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $consultationConditions
                GROUP BY c.diagnosis
                ORDER BY cnt DESC
                LIMIT 10
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($consultationParams);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $topDiagnoses[] = ['diagnosis' => $row['diagnosis'], 'count' => (int)$row['cnt']];
            }
        } catch (PDOException $e) { error_log('Reports Diagnoses Error: ' . $e->getMessage()); }

        // 3. Medicines Dispensed
        $medicinesDispensed = [];
        try {
            // Need to handle branch logic for medicines specifically since it uses inventory_batches
            $medBranchCondition = '';
            $medParams = [
                'start_date' => $branchParams['start_date'],
                'end_date'   => $branchParams['end_date'],
            ] + $profileParams;
            if (isset($branchParams['branch'])) {
                $medBranchCondition = ' AND b.clinic_branch = :branch ';
                $medParams['branch'] = $branchParams['branch'];
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
            $stmt->execute($medParams);
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
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $consultationConditions
                ORDER BY c.created_at DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($consultationParams);
            $exportData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) { error_log('Reports Export Error: ' . $e->getMessage()); }

        // 5. Equipment Borrowings Stats
        $equipmentBorrowings = [];
        $borrowingParams = [
            'start_date' => $branchParams['start_date'],
            'end_date'   => $branchParams['end_date'],
        ] + $profileParams;
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
            $stmt->execute($borrowingParams);
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
            $stmt->execute($borrowingParams);
            $borrowingExportData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) { error_log('Reports Borrowing Export Error: ' . $e->getMessage()); }

        // 7. Attendance by College & Program Breakdown
        $attendanceByCollegeProgram = [];
        $collegeAttendanceExport = [];
        try {
            $sql = "
                SELECT 
                    COALESCE(NULLIF(p.college_dept, ''), 'Unspecified College/Dept') AS college,
                    COALESCE(NULLIF(p.course, ''), 'N/A') AS program,
                    COUNT(c.id) AS attendance
                FROM consultations c
                LEFT JOIN profiles p ON c.profile_id = p.id
                WHERE c.created_at BETWEEN :start_date AND :end_date $branchConditionAnd $consultationConditions
                GROUP BY p.college_dept, p.course
                ORDER BY attendance DESC, college ASC, program ASC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($consultationParams);
            $attendanceByCollegeProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $rank = 1;
            foreach ($attendanceByCollegeProgram as $row) {
                $collegeAttendanceExport[] = [
                    '#' => $rank++,
                    'College' => $row['college'],
                    'Programs' => $row['program'],
                    'Visitation' => (int)$row['attendance']
                ];
            }
        } catch (PDOException $e) { 
            error_log('Reports Attendance By College Error: ' . $e->getMessage()); 
        }

        $this->jsonResponse([
            'user_role' => $userRole,
            'user_name' => $_SESSION['cjc_user']['name'] ?? $_SESSION['cjc_user']['username'] ?? 'Clinic Staff',
            'current_branch' => $branch,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'department' => $department,
            'program' => $program,
            'year_level' => $yearLevel,
            'semester' => $semester,
            'purpose' => $purpose,
            'visits_by_type' => $visitsByType,
            'top_diagnoses' => $topDiagnoses,
            'medicines_dispensed' => $medicinesDispensed,
            'equipment_borrowings' => $equipmentBorrowings,
            'export_data' => $exportData,
            'borrowing_export_data' => $borrowingExportData,
            'attendance_by_college_program' => $attendanceByCollegeProgram,
            'college_attendance_export_data' => $collegeAttendanceExport
        ]);
    }
}
