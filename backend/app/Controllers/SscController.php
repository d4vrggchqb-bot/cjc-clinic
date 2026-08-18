<?php
require_once __DIR__ . '/BaseController.php';

class SscController extends BaseController {

    /**
     * Get integration API credentials from environment
     */
    private function getIntegrationConfig(): array {
        $baseUrl = getenv('SSC_API_BASE_URL') ?: ($_ENV['SSC_API_BASE_URL'] ?? 'http://localhost:9004');
        $clientKey = getenv('SSC_MASTERLIST_CLIENT_KEY') ?: ($_ENV['SSC_MASTERLIST_CLIENT_KEY'] ?? '326bcd86b8a63778f42289729eede712f47e356478fad0092fd47e975dc2ab7f');
        $clientName = getenv('SSC_MASTERLIST_CLIENT_NAME') ?: ($_ENV['SSC_MASTERLIST_CLIENT_NAME'] ?? 'clinic-system');

        return [
            'baseUrl' => rtrim($baseUrl, '/'),
            'clientKey' => $clientKey,
            'clientName' => $clientName
        ];
    }

    /**
     * Execute authenticated HTTP request to external SSC Server
     */
    private function makeSscRequest(string $endpoint, array $queryParams = []): ?array {
        $cfg = $this->getIntegrationConfig();
        if (empty($cfg['baseUrl']) || empty($cfg['clientKey'])) {
            return null;
        }

        // Always include sensitive data since clinic-system has sensitive access enabled
        $queryParams['includeSensitive'] = 'true';
        $queryString = http_build_query($queryParams);
        $url = $cfg['baseUrl'] . $endpoint . ($queryString ? '?' . $queryString : '');

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 4);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'X-API-Key: ' . $cfg['clientKey'],
            'X-Client-Name: ' . $cfg['clientName'],
            'User-Agent: CJC-Clinic-Integration/1.0'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);
            if (is_array($data)) {
                return $data;
            }
        }
        return null;
    }

    /**
     * SSC Database sample student records pool (for offline/demo fallback)
     */
    private function getSampleSscDatabase(): array {
        return [
            [
                "studentId" => "2024-0001",
                "firstName" => "Juan",
                "lastName" => "Dela Cruz",
                "middleName" => "Mendoza",
                "fullName" => "Juan M. Dela Cruz",
                "email" => "juan.delacruz@g.cjc.edu.ph",
                "departmentId" => "dept-ccis",
                "departmentName" => "College of Computing and Information Sciences (CCIS)",
                "courseName" => "Bachelor of Science in Information Technology",
                "yearLevel" => 3,
                "academicStatus" => "REGULAR",
                "status" => "ENROLLED",
                "contactNumber" => "09120000001",
                "dateOfBirth" => "2004-05-15",
                "gender" => "Male",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "emergencyContactName" => "Pedro Dela Cruz",
                "emergencyContactNumber" => "09980000001"
            ],
            [
                "studentId" => "2024-0002",
                "firstName" => "Maria",
                "lastName" => "Santos",
                "middleName" => "Aquino",
                "fullName" => "Maria A. Santos",
                "email" => "maria.santos@g.cjc.edu.ph",
                "departmentId" => "dept-ccis",
                "departmentName" => "College of Computing and Information Sciences (CCIS)",
                "courseName" => "Bachelor of Science in Computer Science",
                "yearLevel" => 4,
                "academicStatus" => "REGULAR",
                "status" => "ENROLLED",
                "contactNumber" => "09120000002",
                "dateOfBirth" => "2003-11-20",
                "gender" => "Female",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "emergencyContactName" => "Elena Santos",
                "emergencyContactNumber" => "09980000002"
            ],
            [
                "studentId" => "2024-0003",
                "firstName" => "Alex",
                "lastName" => "Reyes",
                "middleName" => "Bautista",
                "fullName" => "Alex B. Reyes",
                "email" => "alex.reyes@g.cjc.edu.ph",
                "departmentId" => "dept-con",
                "departmentName" => "College of Nursing (CON)",
                "courseName" => "Bachelor of Science in Nursing",
                "yearLevel" => 2,
                "academicStatus" => "REGULAR",
                "status" => "ENROLLED",
                "contactNumber" => "09120000003",
                "dateOfBirth" => "2005-01-10",
                "gender" => "Male",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "emergencyContactName" => "Roberto Reyes",
                "emergencyContactNumber" => "09980000003"
            ]
        ];
    }

    /**
     * Map any external SSC format into the normalized CJC Clinic Profile schema
     */
    private function normalizeSscRecord(array $raw): array {
        $studentId = trim($raw['studentId'] ?? '');
        $firstName = trim($raw['firstName'] ?? $raw['givenName'] ?? '');
        $lastName  = trim($raw['lastName']  ?? $raw['familyName'] ?? '');
        $middle    = trim($raw['middleName'] ?? '');

        // Middle Initial formatting (e.g. "Santos" -> "S.")
        $mi = '';
        if (!empty($middle)) {
            $mi = (strlen($middle) === 1 || substr($middle, -1) === '.') ? $middle : substr($middle, 0, 1) . '.';
        }

        $rawDept = trim($raw['departmentName'] ?? $raw['department'] ?? $raw['departmentId'] ?? '');
        $rawProg = trim($raw['courseName'] ?? $raw['program'] ?? $raw['courseId'] ?? '');
        $rawYear = $raw['yearLevel'] ?? 1;

        // Normalize Department Hierarchy
        $mappedDept = 'College of Computing and Information Sciences (CCIS)';
        $deptLower = strtolower($rawDept . ' ' . $rawProg);

        if (str_contains($deptLower, 'ccis') || str_contains($deptLower, 'computer') || str_contains($deptLower, 'information')) {
            $mappedDept = 'College of Computing and Information Sciences (CCIS)';
        } elseif (str_contains($deptLower, 'con') || str_contains($deptLower, 'nursing')) {
            $mappedDept = 'College of Nursing (CON)';
        } elseif (str_contains($deptLower, 'cte') || str_contains($deptLower, 'education') || str_contains($deptLower, 'teacher')) {
            $mappedDept = 'College of Teacher Education (CTE)';
        } elseif (str_contains($deptLower, 'cbe') || str_contains($deptLower, 'business') || str_contains($deptLower, 'accountancy')) {
            $mappedDept = 'College of Business & Education (CBE)';
        } elseif (str_contains($deptLower, 'ccje') || str_contains($deptLower, 'criminology')) {
            $mappedDept = 'College of Criminal Justice Education (CCJE)';
        } elseif (!empty($rawDept)) {
            $mappedDept = $rawDept;
        }

        // Normalize Course / Program
        $mappedCourse = $rawProg;
        $progLower = strtolower($rawProg);
        if (str_contains($progLower, 'computer science') || $progLower === 'bscs' || $progLower === 'cs') {
            $mappedCourse = 'Bachelor of Science in Computer Science';
        } elseif (str_contains($progLower, 'information technology') || $progLower === 'bsit' || $progLower === 'it') {
            $mappedCourse = 'Bachelor of Science in Information Technology';
        } elseif (str_contains($progLower, 'nursing') || $progLower === 'bsn') {
            $mappedCourse = 'Bachelor of Science in Nursing';
        } elseif (str_contains($progLower, 'elementary education') || $progLower === 'beed') {
            $mappedCourse = 'Bachelor of Elementary Education';
        } elseif (str_contains($progLower, 'secondary education') || $progLower === 'bsed') {
            $mappedCourse = 'Bachelor of Secondary Education';
        } elseif (str_contains($progLower, 'business administration') || $progLower === 'bsba') {
            $mappedCourse = 'Bachelor of Science in Business Administration';
        } elseif (str_contains($progLower, 'criminology') || $progLower === 'bscrim') {
            $mappedCourse = 'Bachelor of Science in Criminology';
        } elseif (str_contains($progLower, 'accountancy') || $progLower === 'bsa') {
            $mappedCourse = 'Bachelor of Science in Accountancy';
        }

        // Normalize Year Level
        $yearStr = '1st Year';
        if (is_numeric($rawYear)) {
            $y = (int)$rawYear;
            $yearMap = [1 => '1st Year', 2 => '2nd Year', 3 => '3rd Year', 4 => '4th Year', 5 => '5th Year'];
            $yearStr = $yearMap[$y] ?? "{$y}th Year";
        } elseif (!empty($rawYear)) {
            $yearStr = $rawYear;
        }

        // Normalize Gender
        $gender = 'Male';
        $rawGender = strtolower(trim($raw['gender'] ?? $raw['sex'] ?? ''));
        if ($rawGender === 'female' || $rawGender === 'f') {
            $gender = 'Female';
        }

        $dob = trim($raw['dateOfBirth'] ?? $raw['birthdate'] ?? '');
        $contact = trim($raw['contactNumber'] ?? $raw['contact'] ?? '');
        $email = trim($raw['email'] ?? '');
        $address = trim(($raw['currentAddress'] ?? '') ?: ($raw['permanentAddress'] ?? ($raw['address'] ?? '')));
        $emerName = trim(($raw['emergencyContactName'] ?? '') ?: ($raw['guardianName'] ?? ''));
        $emerNum  = trim(($raw['emergencyContactNumber'] ?? '') ?: ($raw['guardianContactNumber'] ?? ''));

        $fullName = trim($raw['fullName'] ?? "$firstName " . ($mi ? "$mi " : "") . "$lastName");

        return [
            'found' => true,
            'source' => $raw['source'] ?? 'ssc_api',
            'ssc_data' => [
                'studentId' => $studentId,
                'fullName' => $fullName,
                'department' => $mappedDept,
                'program' => $mappedCourse,
                'yearLevel' => $yearStr,
                'email' => $email
            ],
            'clinic_profile' => [
                'profile_type' => 'student',
                'patient_id_number' => $studentId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'middle_initial' => $mi,
                'birthdate' => $dob,
                'gender' => $gender,
                'sub_type' => 'College',
                'college_dept' => $mappedDept,
                'course' => $mappedCourse,
                'year_level' => $yearStr,
                'contact' => $contact,
                'email' => $email,
                'address' => $address,
                'emergency_contact_name' => $emerName,
                'emergency_contact_number' => $emerNum,
                'emergency_relation' => 'Guardian / Parent'
            ]
        ];
    }

    /**
     * Action: Lookup student by Student ID or Keyword
     * GET /api/index.php?route=ssc&action=lookup&student_id=2026-00101
     */
    public function lookup() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();

        $studentId = trim($_GET['student_id'] ?? $_GET['id'] ?? '');
        $query     = trim($_GET['q'] ?? $_GET['search'] ?? '');

        if (empty($studentId) && empty($query)) {
            $this->jsonResponse(['found' => false, 'message' => 'Please provide a student ID or search query.'], 400);
        }

        $matched = null;

        // 1. If exact studentId is provided, query Single Student Endpoint:
        //    GET /api/v1/integration/masterlist/{studentId}?includeSensitive=true
        if (!empty($studentId)) {
            $endpoint = '/api/v1/integration/masterlist/' . rawurlencode($studentId);
            $res = $this->makeSscRequest($endpoint);
            if ($res && isset($res['studentId'])) {
                $res['source'] = 'live_ssc_api';
                $matched = $res;
            }
        }

        // 2. If not found by direct ID or if searching by name/keyword:
        //    GET /api/v1/integration/masterlist?search={query}&page=0&size=10
        if (!$matched) {
            $searchTerm = !empty($studentId) ? $studentId : $query;
            $res = $this->makeSscRequest('/api/v1/integration/masterlist', [
                'search' => $searchTerm,
                'page' => 0,
                'size' => 10
            ]);

            if ($res && isset($res['content']) && is_array($res['content']) && count($res['content']) > 0) {
                // Find best matching student in content array
                foreach ($res['content'] as $item) {
                    if (!empty($studentId) && strtolower($item['studentId'] ?? '') === strtolower($studentId)) {
                        $item['source'] = 'live_ssc_api';
                        $matched = $item;
                        break;
                    }
                    if (!empty($query)) {
                        $q = strtolower($query);
                        if (
                            strtolower($item['studentId'] ?? '') === $q ||
                            str_contains(strtolower($item['firstName'] ?? ''), $q) ||
                            str_contains(strtolower($item['lastName'] ?? ''), $q) ||
                            str_contains(strtolower(($item['firstName'] ?? '') . ' ' . ($item['lastName'] ?? '')), $q)
                        ) {
                            $item['source'] = 'live_ssc_api';
                            $matched = $item;
                            break;
                        }
                    }
                }
                if (!$matched && !empty($res['content'][0])) {
                    $matched = $res['content'][0];
                    $matched['source'] = 'live_ssc_api';
                }
            }
        }

        // 3. Fallback to local sample student pool if remote SSC server is offline or unreachable
        if (!$matched) {
            $samplePool = $this->getSampleSscDatabase();
            foreach ($samplePool as $item) {
                if (!empty($studentId) && strtolower($item['studentId'] ?? '') === strtolower($studentId)) {
                    $item['source'] = 'offline_sample';
                    $matched = $item;
                    break;
                }
                if (!empty($query)) {
                    $q = strtolower($query);
                    if (
                        strtolower($item['studentId'] ?? '') === $q ||
                        str_contains(strtolower($item['firstName'] ?? ''), $q) ||
                        str_contains(strtolower($item['lastName'] ?? ''), $q) ||
                        str_contains(strtolower($item['fullName'] ?? ''), $q)
                    ) {
                        $item['source'] = 'offline_sample';
                        $matched = $item;
                        break;
                    }
                }
            }
        }

        if (!$matched) {
            $this->jsonResponse(['found' => false, 'message' => 'Student record not found in SSC database.']);
        }

        $normalized = $this->normalizeSscRecord($matched);
        $this->jsonResponse($normalized);
    }

    /**
     * Action: List students from SSC Masterlist with search & pagination
     * GET /api/index.php?route=ssc&action=listSsc&search=Juan&page=0&size=20
     */
    public function listSsc() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();

        $search = trim($_GET['search'] ?? $_GET['q'] ?? '');
        $page   = max(0, (int)($_GET['page'] ?? 0));
        $size   = max(1, min(100, (int)($_GET['size'] ?? 20)));

        $students = [];
        $totalElements = 0;
        $totalPages = 1;

        // Try querying live SSC API
        $params = ['page' => $page, 'size' => $size];
        if (!empty($search)) {
            $params['search'] = $search;
        }

        $res = $this->makeSscRequest('/api/v1/integration/masterlist', $params);
        if ($res && isset($res['content']) && is_array($res['content'])) {
            foreach ($res['content'] as $raw) {
                $norm = $this->normalizeSscRecord($raw);
                $students[] = [
                    'studentId' => $norm['ssc_data']['studentId'],
                    'fullName' => $norm['ssc_data']['fullName'],
                    'firstName' => $norm['clinic_profile']['first_name'],
                    'lastName' => $norm['clinic_profile']['last_name'],
                    'department' => $norm['ssc_data']['department'],
                    'program' => $norm['ssc_data']['program'],
                    'yearLevel' => $norm['ssc_data']['yearLevel'],
                    'email' => $norm['ssc_data']['email']
                ];
            }
            $totalElements = (int)($res['totalElements'] ?? count($students));
            $totalPages = (int)($res['totalPages'] ?? 1);
        } else {
            // Fallback to sample pool
            $sample = $this->getSampleSscDatabase();
            if (!empty($search)) {
                $q = strtolower($search);
                $sample = array_values(array_filter($sample, function($s) use ($q) {
                    return str_contains(strtolower($s['studentId']), $q) ||
                           str_contains(strtolower($s['fullName']), $q) ||
                           str_contains(strtolower($s['program']), $q);
                }));
            }
            foreach ($sample as $raw) {
                $norm = $this->normalizeSscRecord($raw);
                $students[] = [
                    'studentId' => $norm['ssc_data']['studentId'],
                    'fullName' => $norm['ssc_data']['fullName'],
                    'firstName' => $norm['clinic_profile']['first_name'],
                    'lastName' => $norm['clinic_profile']['last_name'],
                    'department' => $norm['ssc_data']['department'],
                    'program' => $norm['ssc_data']['program'],
                    'yearLevel' => $norm['ssc_data']['yearLevel'],
                    'email' => $norm['ssc_data']['email']
                ];
            }
            $totalElements = count($students);
            $totalPages = 1;
        }

        $this->jsonResponse([
            'success' => true, 
            'students' => $students, 
            'total' => $totalElements, 
            'page' => $page, 
            'size' => $size, 
            'totalPages' => $totalPages
        ]);
    }
}
