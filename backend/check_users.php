<?php
require 'config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query('SELECT id, username, role, clinic_branch FROM users');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
