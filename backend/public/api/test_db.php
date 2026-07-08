<?php
require_once __DIR__ . '/../../config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query("SELECT id, CONCAT(first_name, ' ', last_name) as name, profile_type FROM profiles WHERE first_name LIKE '%john%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
