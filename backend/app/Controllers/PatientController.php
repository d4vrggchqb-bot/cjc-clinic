<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class PatientController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $currentUser = cjcCurrentUser();
        
        $pdo = cjcDatabaseConnection();
        $profileType = $_GET['type'] ?? 'all';
        $allowed     = ['student', 'employee'];
        if ($profileType !== 'all' && !in_array($profileType, $allowed, true)) {
            $profileType = 'all';
        }

        $perPage = max(1, min(100, (int)($_GET['per_page'] ?? 25)));
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $offset  = ($page - 1) * $perPage;
        $search  = trim($_GET['search'] ?? '');
        $filterDept = trim($_GET['dept'] ?? '');

        $conditions = [];
        $params     = [];
        if ($profileType !== 'all') {
            $conditions[]    = 'profile_type = :type';
            $params['type']  = $profileType;
        }
        if ($search !== '') {
            $conditions[]        = '(CONCAT(first_name, \' \', last_name) LIKE :search1 OR contact LIKE :search2 OR patient_id_number LIKE :search3)';
            $params['search1']   = '%' . $search . '%';
            $params['search2']   = '%' . $search . '%';
            $params['search3']   = '%' . $search . '%';
        }
        if ($filterDept !== '') {
            $conditions[]    = 'college_dept = :dept';
            $params['dept']  = $filterDept;
        }

        // Apply role and branch filters
        $userRole = $currentUser['role'] ?? '';
        $userBranch = $currentUser['clinic_branch'] ?? '';

        if ($userRole !== 'Superadmin') {
            if ($userBranch === 'Basic Education Clinic') {
                $conditions[] = "((profile_type = 'student' AND sub_type = 'BED') OR (profile_type = 'employee' AND college_dept = 'Basic Education'))";
            } else if (in_array($userBranch, ['College Clinic', 'Power Campus Clinic'])) {
                $conditions[] = "((profile_type = 'student' AND (sub_type != 'BED' OR sub_type IS NULL)) OR (profile_type = 'employee' AND (college_dept != 'Basic Education' OR college_dept IS NULL)))";
            }
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        try {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM profiles $where");
            $countStmt->execute($params);
            $totalCount = (int)$countStmt->fetchColumn();
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] patients count error: ' . $e->getMessage());
            $totalCount = 0;
        }

        $listSql  = "SELECT id, profile_type, patient_id_number, first_name, last_name, middle_initial, contact, college_dept as program_department, blood_type, course, year_level, CONCAT(first_name, ' ', last_name) as name
                     FROM profiles $where
                     ORDER BY created_at DESC
                     LIMIT :limit OFFSET :offset";
        $listStmt = $pdo->prepare($listSql);
        $listStmt->bindValue(':limit',  $perPage, PDO::PARAM_INT);
        $listStmt->bindValue(':offset', $offset,  PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $listStmt->bindValue(':' . $key, $value);
        }
        $listStmt->execute();
        $profiles = $listStmt->fetchAll();

        $this->jsonResponse([
            'profiles'    => $profiles,
            'pagination'  => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total_count' => $totalCount,
                'total_pages' => (int)ceil($totalCount / $perPage),
            ],
        ]);
    }

    public function upload() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Superadmin', 'Admin', 'Doctor', 'Nurse', 'Staff']);

        if (empty($_FILES['attachment']) || $_FILES['attachment']['error'] !== UPLOAD_ERR_OK) {
            $this->jsonResponse(['success' => false, 'message' => 'Upload failed or no file provided.'], 400);
        }

        $file = $_FILES['attachment'];
        $allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        $finfo       = new finfo(FILEINFO_MIME_TYPE);
        $detectedMime = $finfo->file($file['tmp_name']);
        
        if (!in_array($detectedMime, $allowedMime, true)) {
            $this->jsonResponse(['success' => false, 'message' => 'Only JPEG, PNG, GIF, WebP and PDF files are allowed.'], 400);
        }

        $mimeToExt = [
            'image/jpeg'      => 'jpg',
            'image/png'       => 'png',
            'image/gif'       => 'gif',
            'image/webp'      => 'webp',
            'application/pdf' => 'pdf',
        ];
        $safeExt  = $mimeToExt[$detectedMime];
        $filename = uniqid('attachment_', true) . '.' . $safeExt;

        $uploadDir = realpath(CJC_UPLOAD_DIR);
        if ($uploadDir === false || !is_dir($uploadDir)) {
            $this->jsonResponse(['success' => false, 'message' => 'Upload directory is not configured properly.'], 500);
        }

        $maxBytes = 5 * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            $this->jsonResponse(['success' => false, 'message' => 'File too large. Maximum allowed size is 5 MB.'], 400);
        }

        $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            $this->jsonResponse(['success' => false, 'message' => 'Unable to save file.'], 500);
        }
        
        $pdo = cjcDatabaseConnection();
        $currentUser = cjcCurrentUser();
        $profile_id = isset($_POST['profile_id']) ? (int)$_POST['profile_id'] : 0;
        
        $fileUrl = 'api/download.php?file=' . urlencode($filename);
        $attachmentId = 0;
        
        if ($profile_id > 0) {
            try {
                $stmt = $pdo->prepare("INSERT INTO profile_attachments (profile_id, filename, file_url, uploaded_by) VALUES (:profile_id, :filename, :file_url, :uploaded_by)");
                $stmt->execute([
                    'profile_id' => $profile_id,
                    'filename' => $file['name'],
                    'file_url' => $fileUrl,
                    'uploaded_by' => $currentUser['name'] ?? 'Staff'
                ]);
                $attachmentId = $pdo->lastInsertId();
            } catch (PDOException $e) {
                // Silently ignore insert errors if any
            }
        }

        $ocrScript = realpath(__DIR__ . '/../../scripts/ocr_parser.py');
        $extractedText = null;
        $ocrError = null;
        if ($ocrScript) {
            // XAMPP's web-server process may not inherit the interactive PATH.
            // Resolve a local Python installation explicitly, while allowing a
            // deployment to override it through CJC_PYTHON_EXECUTABLE.
            $pythonExecutable = getenv('CJC_PYTHON_EXECUTABLE') ?: 'python';
            if (DIRECTORY_SEPARATOR === '\\' && $pythonExecutable === 'python') {
                $localAppData = getenv('LOCALAPPDATA');
                if ($localAppData) {
                    // Prefer the project's supported interpreter. Fall back to
                    // another installed Python only when it is unavailable.
                    $pythonCandidates = glob($localAppData . '\\Programs\\Python\\Python313\\python.exe') ?: [];
                    if (empty($pythonCandidates)) {
                        $pythonCandidates = glob($localAppData . '\\Programs\\Python\\Python*\\python.exe') ?: [];
                    }
                    if (!empty($pythonCandidates)) {
                        $pythonExecutable = $pythonCandidates[0];
                    }
                }
            }

            $cmd = escapeshellarg($pythonExecutable) . " " . escapeshellarg($ocrScript) . " " . escapeshellarg($targetPath) . " 2>&1";
            $output = [];
            $return_var = 0;
            exec($cmd, $output, $return_var);
            
            if ($return_var === 0 && !empty($output)) {
                $ocrResult = json_decode(implode("\n", $output), true);
                if (isset($ocrResult['success']) && $ocrResult['success']) {
                    $extractedText = $ocrResult['text'];
                    
                    // Update database with extracted text
                    if ($attachmentId > 0) {
                        try {
                            $updateStmt = $pdo->prepare("UPDATE profile_attachments SET extracted_text = :text WHERE id = :id");
                            $updateStmt->execute(['text' => $extractedText, 'id' => $attachmentId]);
                        } catch (PDOException $e) {
                            // Silently ignore
                        }
                    }
                } else {
                    $ocrError = $ocrResult['error'] ?? 'Text extraction could not be completed.';
                }
            } else {
                $ocrError = 'Text extraction could not be completed' . (!empty($output) ? ': ' . implode(" ", $output) : '.') ;
            }
        }

        $this->jsonResponse([
            'success' => true, 
            'url' => $fileUrl,
            'id' => $attachmentId,
            'ocr_extracted' => $extractedText !== null,
            'extracted_text' => $extractedText,
            'ocr_error' => $ocrError
        ]);
    }

    public function deleteAttachment() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Superadmin', 'Admin', 'Doctor', 'Nurse', 'Staff']);

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $attachmentId = (int)($input['attachment_id'] ?? 0);
        $profileId = (int)($input['profile_id'] ?? 0);

        if ($attachmentId <= 0 || $profileId <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid attachment selection.'], 400);
        }

        $pdo = cjcDatabaseConnection();

        try {
            $stmt = $pdo->prepare("SELECT id, profile_id, filename, file_url FROM profile_attachments WHERE id = :id AND profile_id = :profile_id LIMIT 1");
            $stmt->execute(['id' => $attachmentId, 'profile_id' => $profileId]);
            $attachment = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$attachment) {
                $this->jsonResponse(['success' => false, 'message' => 'Attachment not found.'], 404);
            }

            $parsedUrl = parse_url($attachment['file_url'] ?? '');
            $query = [];
            if (!empty($parsedUrl['query'])) {
                parse_str($parsedUrl['query'], $query);
            }
            $storedFilename = $query['file'] ?? null;

            if ($storedFilename) {
                $uploadDir = realpath(CJC_UPLOAD_DIR);
                if ($uploadDir !== false && is_dir($uploadDir)) {
                    $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $storedFilename;
                    if (is_file($targetPath)) {
                        @unlink($targetPath);
                    }
                }
            }

            $deleteStmt = $pdo->prepare("DELETE FROM profile_attachments WHERE id = :id AND profile_id = :profile_id");
            $deleteStmt->execute(['id' => $attachmentId, 'profile_id' => $profileId]);

            $this->jsonResponse(['success' => true, 'message' => 'Attachment deleted successfully.']);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] delete attachment error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to delete attachment.'], 500);
        }
    }

    public function get() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            $this->jsonResponse(['error' => 'Invalid ID'], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM profiles WHERE id = :id");
            $stmt->execute(['id' => $id]);
            $profile = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$profile) {
                $this->jsonResponse(['error' => 'Patient not found'], 404);
            }
            
            $attachmentsStmt = $pdo->prepare("SELECT * FROM profile_attachments WHERE profile_id = :id ORDER BY created_at DESC");
            $attachmentsStmt->execute(['id' => $id]);
            $attachments = $attachmentsStmt->fetchAll(PDO::FETCH_ASSOC);
            $profile['attachments'] = $attachments;

            $this->jsonResponse(['profile' => $profile]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] get patient error: ' . $e->getMessage());
            $this->jsonResponse(['error' => 'Database error'], 500);
        }
    }

    public function create() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcRequireRole(['Superadmin', 'Admin', 'Doctor', 'Nurse', 'Staff']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $firstName = trim($input['first_name'] ?? '');
        $lastName = trim($input['last_name'] ?? '');
        $profileType = $input['profile_type'] ?? 'student';

        if (empty($firstName) || empty($lastName)) {
            $this->jsonResponse(['error' => 'First and Last name are required'], 400);
        }

        $pdo = cjcDatabaseConnection();

        // Check for duplicates
        $idNum = $input['patient_id_number'] ?? null;
        if (!empty($idNum)) {
            $dupSql = "SELECT id FROM profiles WHERE first_name = :fname AND last_name = :lname AND patient_id_number = :id_num LIMIT 1";
            $dupStmt = $pdo->prepare($dupSql);
            $dupStmt->execute(['fname' => $firstName, 'lname' => $lastName, 'id_num' => $idNum]);
        } else {
            $dupSql = "SELECT id FROM profiles WHERE first_name = :fname AND last_name = :lname AND (patient_id_number IS NULL OR patient_id_number = '') LIMIT 1";
            $dupStmt = $pdo->prepare($dupSql);
            $dupStmt->execute(['fname' => $firstName, 'lname' => $lastName]);
        }
        
        if ($dupStmt->fetch()) {
            $this->jsonResponse(['error' => 'A patient with this exact name and ID number already exists.'], 400);
        }

        try {
            $sql = "INSERT INTO profiles (
                        profile_type, patient_id_number, school_year, first_name, last_name, middle_initial,
                        birthdate, gender, height, mother_name, father_name, weight, sub_type, college_dept, year_level, course, 
                        contact, email, address, emergency_contact_name, emergency_contact_number, 
                        emergency_relation, blood_type, health_history, vital_stats
                    ) VALUES (
                        :type, :id_num, :school_year, :fname, :lname, :mi,
                        :bdate, :gender, :height, :mname, :fname_parent, :weight, :sub_type, :dept, :ylevel, :course,
                        :contact, :email, :address, :e_name, :e_num, 
                        :e_rel, :blood, :history, :vitals
                    )";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                'type' => $profileType,
                'id_num' => $input['patient_id_number'] ?? null,
                'school_year' => $input['school_year'] ?? null,
                'fname' => $firstName,
                'lname' => $lastName,
                'mi' => $input['middle_initial'] ?? null,
                'bdate' => !empty($input['birthdate']) ? $input['birthdate'] : null,
                'gender' => $input['gender'] ?? null,
                'height' => $input['height'] ?? null,
                'mname' => $input['mother_name'] ?? null,
                'fname_parent' => $input['father_name'] ?? null,
                'weight' => $input['weight'] ?? null,
                'sub_type' => $input['sub_type'] ?? null,
                'dept' => $input['college_dept'] ?? null,
                'ylevel' => $input['year_level'] ?? null,
                'course' => $input['course'] ?? null,
                'contact' => $input['contact'] ?? null,
                'email' => $input['email'] ?? null,
                'address' => $input['address'] ?? null,
                'e_name' => $input['emergency_contact_name'] ?? null,
                'e_num' => $input['emergency_contact_number'] ?? null,
                'e_rel' => $input['emergency_relation'] ?? null,
                'blood' => $input['blood_type'] ?? null,
                'history' => $input['health_history'] ?? null,
                'vitals' => $input['vital_stats'] ?? null
            ]);

            $this->jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] create patient error: ' . $e->getMessage());
            $this->jsonResponse(['error' => 'Database error'], 500);
        }
    }

    public function update() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcRequireRole(['Superadmin', 'Admin', 'Doctor', 'Nurse', 'Staff']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $id = (int)($input['id'] ?? 0);
        $firstName = trim($input['first_name'] ?? '');
        $lastName = trim($input['last_name'] ?? '');
        
        if ($id <= 0 || empty($firstName) || empty($lastName)) {
            $this->jsonResponse(['error' => 'Invalid ID or Name'], 400);
        }

        $pdo = cjcDatabaseConnection();

        // Check for duplicates excluding current ID
        $idNum = $input['patient_id_number'] ?? null;
        if (!empty($idNum)) {
            $dupSql = "SELECT id FROM profiles WHERE first_name = :fname AND last_name = :lname AND patient_id_number = :id_num AND id != :id LIMIT 1";
            $dupStmt = $pdo->prepare($dupSql);
            $dupStmt->execute(['fname' => $firstName, 'lname' => $lastName, 'id_num' => $idNum, 'id' => $id]);
        } else {
            $dupSql = "SELECT id FROM profiles WHERE first_name = :fname AND last_name = :lname AND (patient_id_number IS NULL OR patient_id_number = '') AND id != :id LIMIT 1";
            $dupStmt = $pdo->prepare($dupSql);
            $dupStmt->execute(['fname' => $firstName, 'lname' => $lastName, 'id' => $id]);
        }
        
        if ($dupStmt->fetch()) {
            $this->jsonResponse(['error' => 'A patient with this exact name and ID number already exists.'], 400);
        }

        try {
            $sql = "UPDATE profiles 
                    SET profile_type = :type, patient_id_number = :id_num, school_year = :school_year, 
                        first_name = :fname, last_name = :lname, middle_initial = :mi,
                        birthdate = :bdate, gender = :gender, height = :height, mother_name = :mname, 
                        father_name = :fname_parent, weight = :weight, sub_type = :sub_type, 
                        college_dept = :dept, year_level = :ylevel, course = :course,
                        contact = :contact, email = :email, address = :address, 
                        emergency_contact_name = :e_name, emergency_contact_number = :e_num, 
                        emergency_relation = :e_rel, blood_type = :blood, 
                        health_history = :history, vital_stats = :vitals 
                    WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                'id' => $id,
                'type' => $input['profile_type'] ?? 'student',
                'id_num' => $input['patient_id_number'] ?? null,
                'school_year' => $input['school_year'] ?? null,
                'fname' => $firstName,
                'lname' => $lastName,
                'mi' => $input['middle_initial'] ?? null,
                'bdate' => !empty($input['birthdate']) ? $input['birthdate'] : null,
                'gender' => $input['gender'] ?? null,
                'height' => $input['height'] ?? null,
                'mname' => $input['mother_name'] ?? null,
                'fname_parent' => $input['father_name'] ?? null,
                'weight' => $input['weight'] ?? null,
                'sub_type' => $input['sub_type'] ?? null,
                'dept' => $input['college_dept'] ?? null,
                'ylevel' => $input['year_level'] ?? null,
                'course' => $input['course'] ?? null,
                'contact' => $input['contact'] ?? null,
                'email' => $input['email'] ?? null,
                'address' => $input['address'] ?? null,
                'e_name' => $input['emergency_contact_name'] ?? null,
                'e_num' => $input['emergency_contact_number'] ?? null,
                'e_rel' => $input['emergency_relation'] ?? null,
                'blood' => $input['blood_type'] ?? null,
                'history' => $input['health_history'] ?? null,
                'vitals' => $input['vital_stats'] ?? null
            ]);

            $this->jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] update patient error: ' . $e->getMessage());
            $this->jsonResponse(['error' => 'Database error'], 500);
        }
    }

    public function checkId() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $idNum = trim($_GET['id_number'] ?? '');

        if (empty($idNum)) {
            $this->jsonResponse(['exists' => false]);
        }

        $pdo = cjcDatabaseConnection();
        try {
            $stmt = $pdo->prepare("SELECT id FROM profiles WHERE patient_id_number = :id_num LIMIT 1");
            $stmt->execute(['id_num' => $idNum]);
            $exists = (bool)$stmt->fetch();
            $this->jsonResponse(['exists' => $exists]);
        } catch (PDOException $e) {
            $this->jsonResponse(['error' => 'Database error'], 500);
        }
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
