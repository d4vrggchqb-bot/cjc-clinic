<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class SscController {

    private function jsonResponse($data, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    /**
     * SSC Database student records pool
     */
    private function getSampleSscDatabase() {
        return [
            [
                "studentId" => "2022-0027-8",
                "familyName" => "Saludo",
                "givenName" => "Gielou Charls",
                "middleName" => "L.",
                "suffix" => "",
                "fullName" => "Gielou Charls L. Saludo",
                "email" => "saludogielou@g.cjc.edu.ph",
                "departmentId" => 1,
                "department" => "CCIS",
                "program" => "BS Computer Science",
                "major" => "Software Engineering",
                "yearLevel" => "3rd Year",
                "academicStatus" => "Regular",
                "studentType" => "Continuing",
                "contactNumber" => "09123456789",
                "isActive" => true,
                "dateOfBirth" => "2003-05-15",
                "placeOfBirth" => "Digos City",
                "sex" => "Male",
                "civilStatus" => "Single",
                "religion" => "Roman Catholic",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "guardianName" => "Parent / Guardian Name",
                "guardianContactNumber" => "09987654321",
                "emergencyContactName" => "Emergency Contact Name",
                "emergencyContactNumber" => "09987654321"
            ],
            [
                "studentId" => "2021-0492",
                "familyName" => "Shellstrop",
                "givenName" => "Eleanor",
                "middleName" => "",
                "suffix" => "",
                "fullName" => "Eleanor Shellstrop",
                "email" => "eleanor@uni.edu.ph",
                "departmentId" => 1,
                "department" => "CCIS",
                "program" => "BS Computer Science",
                "major" => "",
                "yearLevel" => "4th Year",
                "academicStatus" => "Regular",
                "studentType" => "Continuing",
                "contactNumber" => "09129998888",
                "isActive" => true,
                "dateOfBirth" => "2002-11-20",
                "placeOfBirth" => "Digos City",
                "sex" => "Female",
                "civilStatus" => "Single",
                "religion" => "Roman Catholic",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "guardianName" => "Guardian Name",
                "guardianContactNumber" => "09981112222",
                "emergencyContactName" => "Emergency Contact",
                "emergencyContactNumber" => "09981112222"
            ],
            [
                "studentId" => "2022-1103",
                "familyName" => "Anagonye",
                "givenName" => "Chidi",
                "middleName" => "",
                "suffix" => "",
                "fullName" => "Chidi Anagonye",
                "email" => "chidi@uni.edu.ph",
                "departmentId" => 2,
                "department" => "COE",
                "program" => "BS Civil Engineering",
                "major" => "",
                "yearLevel" => "3rd Year",
                "academicStatus" => "Regular",
                "studentType" => "Continuing",
                "contactNumber" => "09127776666",
                "isActive" => true,
                "dateOfBirth" => "2003-01-10",
                "placeOfBirth" => "Digos City",
                "sex" => "Male",
                "civilStatus" => "Single",
                "religion" => "Roman Catholic",
                "permanentAddress" => "Digos City, Davao del Sur",
                "currentAddress" => "Digos City, Davao del Sur",
                "guardianName" => "Guardian Name",
                "guardianContactNumber" => "09983334444",
                "emergencyContactName" => "Emergency Contact",
                "emergencyContactNumber" => "09983334444"
            ]
        ];
    }

    /**
     * Attempts to query the live remote SSC API endpoint
     */
    private function fetchFromRemoteSscApi($studentId, $query) {
        $baseUrl = getenv('SSC_API_BASE_URL') ?: 'https://ent-load-august-scientists.trycloudflare.com';
        $clientName = getenv('SSC_MASTERLIST_CLIENT_NAME') ?: 'clinic-system';
        $clientKey = getenv('SSC_MASTERLIST_CLIENT_KEY') ?: '326bcd86b8a63778f42289729eede712f47e356478fad0092fd47e975dc2ab7f';

        $searchParam = !empty($studentId) ? $studentId : $query;
        $url = rtrim($baseUrl, '/') . '/api/v1/integration/students?search=' . urlencode($searchParam);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 4);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
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
            if (!empty($data)) {
                if (isset($data['studentId'])) return $data;
                if (is_array($data) && isset($data[0]['studentId'])) return $data[0];
                if (isset($data['data']) && is_array($data['data']) && count($data['data']) > 0) return $data['data'][0];
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

        // 1. Try querying remote SSC API
        $matched = $this->fetchFromRemoteSscApi($studentId, $query);

        // 2. Fallback to sample student database pool if remote API is offline
        if (!$matched) {
            $records = $this->getSampleSscDatabase();
            foreach ($records as $item) {
                if (!empty($studentId) && strtolower($item['studentId']) === strtolower($studentId)) {
                    $matched = $item;
                    break;
                }
                if (!empty($query)) {
                    $q = strtolower($query);
                    if (
                        strtolower($item['studentId']) === $q ||
                        str_contains(strtolower($item['fullName']), $q) ||
                        str_contains(strtolower($item['givenName']), $q) ||
                        str_contains(strtolower($item['familyName']), $q)
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

        // Map SSC fields to CJC Clinic profile fields
        $mapped = [
            'found' => true,
            'ssc_data' => $matched,
            'clinic_profile' => [
                'profile_type' => 'student',
                'patient_id_number' => $matched['studentId'],
                'first_name' => $matched['givenName'],
                'last_name' => $matched['familyName'],
                'middle_initial' => $matched['middleName'],
                'birthdate' => $matched['dateOfBirth'],
                'gender' => $matched['sex'],
                'sub_type' => 'College',
                'college_dept' => $matched['department'],
                'course' => $matched['program'],
                'year_level' => $matched['yearLevel'],
                'contact' => $matched['contactNumber'],
                'email' => $matched['email'],
                'address' => $matched['currentAddress'] ?: $matched['permanentAddress'],
                'emergency_contact_name' => $matched['emergencyContactName'] ?: $matched['guardianName'],
                'emergency_contact_number' => $matched['emergencyContactNumber'] ?: $matched['guardianContactNumber'],
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

        $records = $this->getSampleSscDatabase();
        $this->jsonResponse([
            'success' => true, 
            'total' => count($records), 
            'students' => $records
        ]);
    }
}
