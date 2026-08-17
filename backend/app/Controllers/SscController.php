<?php
require_once __DIR__ . '/BaseController.php';

class SscController extends BaseController {

    /**
     * SSC Database student records pool (generic mock records for offline/fallback)
     */
    private function getSampleSscDatabase() {
        return [
            [
                "studentId" => "2024-0001",
                "familyName" => "Dela Cruz",
                "givenName" => "Juan",
                "middleName" => "M.",
                "suffix" => "",
                "fullName" => "Juan M. Dela Cruz",
                "email" => "juan.delacruz@g.cjc.edu.ph",
                "departmentId" => 1,
                "department" => "CCIS",
                "program" => "BS Information Technology",
                "major" => "Network and Security",
                "yearLevel" => "3rd Year",
                "academicStatus" => "Regular",
                "studentType" => "Continuing",
                "contactNumber" => "09120000001",
                "isActive" => true,
                "dateOfBirth" => "2004-05-15",
                "placeOfBirth" => "Digos City",
                "sex" => "Male",
                "civilStatus" => "Single",
                "religion" => "Roman Catholic",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "guardianName" => "Parent / Guardian Name",
                "guardianContactNumber" => "09980000001",
                "emergencyContactName" => "Emergency Contact Name",
                "emergencyContactNumber" => "09980000001"
            ],
            [
                "studentId" => "2024-0002",
                "familyName" => "Santos",
                "givenName" => "Maria",
                "middleName" => "A.",
                "suffix" => "",
                "fullName" => "Maria A. Santos",
                "email" => "maria.santos@g.cjc.edu.ph",
                "departmentId" => 1,
                "department" => "CCIS",
                "program" => "BS Computer Science",
                "major" => "Software Engineering",
                "yearLevel" => "4th Year",
                "academicStatus" => "Regular",
                "studentType" => "Continuing",
                "contactNumber" => "09120000002",
                "isActive" => true,
                "dateOfBirth" => "2003-11-20",
                "placeOfBirth" => "Digos City",
                "sex" => "Female",
                "civilStatus" => "Single",
                "religion" => "Roman Catholic",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "guardianName" => "Guardian Name",
                "guardianContactNumber" => "09980000002",
                "emergencyContactName" => "Emergency Contact",
                "emergencyContactNumber" => "09980000002"
            ],
            [
                "studentId" => "2024-0003",
                "familyName" => "Reyes",
                "givenName" => "Alex",
                "middleName" => "B.",
                "suffix" => "",
                "fullName" => "Alex B. Reyes",
                "email" => "alex.reyes@g.cjc.edu.ph",
                "departmentId" => 2,
                "department" => "COE",
                "program" => "BS Civil Engineering",
                "major" => "",
                "yearLevel" => "2nd Year",
                "academicStatus" => "Regular",
                "studentType" => "Continuing",
                "contactNumber" => "09120000003",
                "isActive" => true,
                "dateOfBirth" => "2005-01-10",
                "placeOfBirth" => "Digos City",
                "sex" => "Male",
                "civilStatus" => "Single",
                "religion" => "Roman Catholic",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "guardianName" => "Guardian Name",
                "guardianContactNumber" => "09980000003",
                "emergencyContactName" => "Emergency Contact",
                "emergencyContactNumber" => "09980000003"
            ]
        ];
    }

    /**
     * Attempts to query the live remote SSC API masterlist endpoint
     */
    private function fetchFromRemoteSscMasterlist() {
        $baseUrl = getenv('SSC_API_BASE_URL') ?: ($_ENV['SSC_API_BASE_URL'] ?? '');
        $clientName = getenv('SSC_MASTERLIST_CLIENT_NAME') ?: ($_ENV['SSC_MASTERLIST_CLIENT_NAME'] ?? 'clinic-system');
        $clientKey = getenv('SSC_MASTERLIST_CLIENT_KEY') ?: ($_ENV['SSC_MASTERLIST_CLIENT_KEY'] ?? '');

        if (empty($baseUrl) || empty($clientKey)) {
            return null;
        }

        $url = rtrim($baseUrl, '/') . '/api/v1/integration/masterlist';

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'X-API-Key: ' . $clientKey,
            'X-Client-Name: ' . $clientName,
            'X-Client-Key: ' . $clientKey,
            'Authorization: Bearer ' . $clientKey
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);
            if (is_array($data) && count($data) > 0) {
                return $data;
            }
        }
        return null;
    }

    public function lookup() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();

        $studentId = trim($_GET['student_id'] ?? $_GET['id'] ?? '');
        $query = trim($_GET['q'] ?? $_GET['search'] ?? '');

        if (empty($studentId) && empty($query)) {
            $this->jsonResponse(['found' => false, 'message' => 'Please provide a student ID or search query.'], 400);
        }

        $matched = null;

        // 1. Try querying remote SSC masterlist API
        $remoteList = $this->fetchFromRemoteSscMasterlist();
        if ($remoteList) {
            foreach ($remoteList as $item) {
                if (!empty($studentId) && strtolower($item['studentId'] ?? '') === strtolower($studentId)) {
                    $matched = $item;
                    break;
                }
                if (!empty($query)) {
                    $q = strtolower($query);
                    if (
                        strtolower($item['studentId'] ?? '') === $q ||
                        str_contains(strtolower($item['fullName'] ?? ''), $q) ||
                        str_contains(strtolower($item['givenName'] ?? ''), $q) ||
                        str_contains(strtolower($item['familyName'] ?? ''), $q)
                    ) {
                        $matched = $item;
                        break;
                    }
                }
            }
        }

        // 2. Fallback to sample student database pool if remote API is offline
        if (!$matched) {
            $records = $this->getSampleSscDatabase();
            foreach ($records as $item) {
                if (!empty($studentId) && strtolower($item['studentId'] ?? '') === strtolower($studentId)) {
                    $matched = $item;
                    break;
                }
                if (!empty($query)) {
                    $q = strtolower($query);
                    if (
                        strtolower($item['studentId'] ?? '') === $q ||
                        str_contains(strtolower($item['fullName'] ?? ''), $q) ||
                        str_contains(strtolower($item['givenName'] ?? ''), $q) ||
                        str_contains(strtolower($item['familyName'] ?? ''), $q)
                    ) {
                        $matched = $item;
                        break;
                    }
                }
            }
        }

        if (!$matched) {
            $this->jsonResponse(['found' => false, 'message' => 'Student record not found in SSC database.']);
        }

        $rawDept = $matched['department'] ?? $matched['departmentId'] ?? '';
        $rawProg = $matched['program'] ?? '';
        $rawYear = $matched['yearLevel'] ?? '';

        $mappedDept = 'College of Computing and Information Sciences (CCIS)';
        $deptLower = strtolower($rawDept . ' ' . $rawProg);

        if (str_contains($deptLower, 'ccis') || str_contains($deptLower, 'computer') || str_contains($deptLower, 'information')) {
            $mappedDept = 'College of Computing and Information Sciences (CCIS)';
        } else if (str_contains($deptLower, 'con') || str_contains($deptLower, 'nursing')) {
            $mappedDept = 'College of Nursing (CON)';
        } else if (str_contains($deptLower, 'cte') || str_contains($deptLower, 'education') || str_contains($deptLower, 'teacher')) {
            $mappedDept = 'College of Teacher Education (CTE)';
        } else if (str_contains($deptLower, 'cbe') || str_contains($deptLower, 'business') || str_contains($deptLower, 'accountancy')) {
            $mappedDept = 'College of Business & Education (CBE)';
        } else if (str_contains($deptLower, 'ccje') || str_contains($deptLower, 'criminology')) {
            $mappedDept = 'College of Criminal Justice Education (CCJE)';
        } else if (!empty($rawDept)) {
            $mappedDept = $rawDept;
        }

        // Normalize Course/Program
        $mappedCourse = $rawProg;
        $progLower = strtolower($rawProg);
        if (str_contains($progLower, 'computer science') || $progLower === 'bscs' || $progLower === 'cs') {
            $mappedCourse = 'Bachelor of Science in Computer Science';
        } else if (str_contains($progLower, 'information technology') || $progLower === 'bsit' || $progLower === 'it') {
            $mappedCourse = 'Bachelor of Science in Information Technology';
        } else if (str_contains($progLower, 'nursing') || $progLower === 'bsn') {
            $mappedCourse = 'Bachelor of Science in Nursing';
        } else if (str_contains($progLower, 'elementary education') || $progLower === 'beed') {
            $mappedCourse = 'Bachelor of Elementary Education';
        } else if (str_contains($progLower, 'secondary education') || $progLower === 'bsed') {
            $mappedCourse = 'Bachelor of Secondary Education';
        } else if (str_contains($progLower, 'business administration') || $progLower === 'bsba') {
            $mappedCourse = 'Bachelor of Science in Business Administration';
        } else if (str_contains($progLower, 'criminology') || $progLower === 'bscrim') {
            $mappedCourse = 'Bachelor of Science in Criminology';
        } else if (str_contains($progLower, 'accountancy') || $progLower === 'bsa') {
            $mappedCourse = 'Bachelor of Science in Accountancy';
        }

        // Map SSC fields to CJC Clinic profile fields
        $mapped = [
            'found' => true,
            'ssc_data' => $matched,
            'clinic_profile' => [
                'profile_type' => 'student',
                'patient_id_number' => $matched['studentId'] ?? '',
                'first_name' => $matched['givenName'] ?? '',
                'last_name' => $matched['familyName'] ?? '',
                'middle_initial' => $matched['middleName'] ?? '',
                'birthdate' => $matched['dateOfBirth'] ?? '',
                'gender' => $matched['sex'] ?? 'Male',
                'sub_type' => 'College',
                'college_dept' => $mappedDept,
                'course' => $mappedCourse,
                'year_level' => $rawYear ?: '1st Year',
                'contact' => $matched['contactNumber'] ?? '',
                'email' => $matched['email'] ?? '',
                'address' => ($matched['currentAddress'] ?? '') ?: ($matched['permanentAddress'] ?? ''),
                'emergency_contact_name' => ($matched['emergencyContactName'] ?? '') ?: ($matched['guardianName'] ?? ''),
                'emergency_contact_number' => ($matched['emergencyContactNumber'] ?? '') ?: ($matched['guardianContactNumber'] ?? ''),
                'emergency_relation' => 'Guardian / Parent'
            ]
        ];

        $this->jsonResponse($mapped);
    }

    public function listSsc() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }
        cjcRequireAuth();

        $records = $this->fetchFromRemoteSscMasterlist();
        if (!$records) {
            $records = $this->getSampleSscDatabase();
        }

        $this->jsonResponse([
            'success' => true, 
            'total' => count($records), 
            'students' => $records
        ]);
    }
}
