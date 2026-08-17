<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query("SELECT first_name, last_name, address FROM profiles WHERE first_name='ELEANOR'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
