<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query('SELECT id, item_id, clinic_branch, stock_remaining FROM inventory_batches');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
