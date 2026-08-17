<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try { 
    $pdo->exec("INSERT INTO borrowings (profile_id, purpose, status) VALUES (1, 'Test', 'active')"); 
    $bId = $pdo->lastInsertId(); 
    $pdo->exec("INSERT INTO borrowed_items (borrowing_id, inventory_item_id, quantity, item_type, status) VALUES ($bId, 1, 1, 'equipment', 'borrowed')"); 
    echo 'Success'; 
} catch(Exception $e) { 
    echo $e->getMessage(); 
}
?>
