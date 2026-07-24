<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query('SELECT * FROM borrowings ORDER BY created_at DESC LIMIT 5');
print_r($stmt->fetchAll());
