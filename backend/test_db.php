<?php
require 'config/database.php';
$pdo = cjcDatabaseConnection();
echo "Connected to: " . $pdo->getAttribute(PDO::ATTR_CONNECTION_STATUS) . "\n";
$stmt = $pdo->query('SELECT username, role, clinic_branch FROM users');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
