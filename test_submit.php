<?php
session_start();
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = [
    'profile_id' => 1,
    'purpose' => 'Test borrow',
    'items' => [
        [
            'inventory_item_id' => 1,
            'quantity' => 1,
            'item_type' => 'equipment'
        ]
    ]
];
$_SESSION['cjc_user']['id'] = 1;
$_SESSION['cjc_user']['clinic_branch'] = 'Power Campus Clinic';

require 'backend/config/config.php';
require 'backend/config/database.php';
$_SERVER['HTTP_X_CSRF_TOKEN'] = $_SESSION['csrf_token']; // bypass CSRF

require 'backend/app/Controllers/BorrowingController.php';

// Mock jsonResponse to avoid exit()
class TestBorrowingController extends BorrowingController {
    public function jsonResponse(array $data, int $status = 200) {
        echo json_encode($data);
        exit;
    }
}


$c = new TestBorrowingController();
$c->submitForm();
?>
