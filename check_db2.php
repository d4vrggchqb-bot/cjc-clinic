<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    $stmt = $pdo->query("SELECT b.id, b.purpose, b.created_at, p.id as profile_id, p.first_name, p.last_name, p.profile_type, GROUP_CONCAT(i.generic_name SEPARATOR ', ') as items FROM borrowings b JOIN profiles p ON b.profile_id = p.id JOIN borrowed_items bi ON bi.borrowing_id = b.id JOIN inventory_items i ON bi.inventory_item_id = i.id GROUP BY b.id ORDER BY b.created_at DESC LIMIT 5");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo $e->getMessage();
}
