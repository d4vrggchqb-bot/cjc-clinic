<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query("
    SELECT b.id as borrowing_id, b.purpose, b.created_at,
           p.first_name, p.last_name, p.course, p.year_level, p.profile_type,
           bi.item_type, bi.status, bi.quantity,
           i.generic_name, i.brand_name
    FROM borrowings b
    JOIN profiles p ON b.profile_id = p.id
    JOIN borrowed_items bi ON bi.borrowing_id = b.id
    JOIN inventory_items i ON bi.inventory_item_id = i.id
    ORDER BY b.created_at DESC
    LIMIT 100
");
print_r($stmt->fetchAll());
