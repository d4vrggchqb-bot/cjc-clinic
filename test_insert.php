<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
try {
    $stmt = $pdo->prepare('INSERT INTO medcerts (profile_id, clinic_branch, issued_to, issued_by, reason, valid_until) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([1, 'College Clinic', 'Test', 'Doc Test', 'Test Reason', null]);
    echo 'Insert Success! ID: ' . $pdo->lastInsertId();
} catch(Exception $e) {
    echo 'Insert Error: ' . $e->getMessage();
}
?>
