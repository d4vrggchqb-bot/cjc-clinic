<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
try {
    $pdo->exec('ALTER TABLE borrowed_items ADD COLUMN returned_quantity INT NOT NULL DEFAULT 0');
    echo 'DB updated!';
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}
?>
