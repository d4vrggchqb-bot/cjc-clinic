<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query('SELECT setting_key, setting_value FROM settings');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
