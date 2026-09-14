<?php
require_once __DIR__ . '/backend/config/database.php';

$pdo = cjcDatabaseConnection();

$migrations = [
    "ALTER TABLE `inventory_items` ADD COLUMN IF NOT EXISTS `serial_no` VARCHAR(100) DEFAULT NULL AFTER `formulation`",
    "ALTER TABLE `inventory_items` ADD COLUMN IF NOT EXISTS `model_no` VARCHAR(100) DEFAULT NULL AFTER `serial_no`",
    "ALTER TABLE `inventory_items` ADD COLUMN IF NOT EXISTS `supplier` VARCHAR(150) DEFAULT NULL AFTER `model_no`",
    "ALTER TABLE `inventory_items` ADD COLUMN IF NOT EXISTS `unit` VARCHAR(50) DEFAULT NULL AFTER `supplier`",
    "ALTER TABLE `inventory_items` ADD COLUMN IF NOT EXISTS `date_purchased` DATE DEFAULT NULL AFTER `unit`",
    "ALTER TABLE `equipment_calibrations` ADD COLUMN IF NOT EXISTS `serial_no` VARCHAR(100) DEFAULT NULL AFTER `cert_number`",
];

foreach ($migrations as $sql) {
    try {
        $pdo->exec($sql);
        echo "OK: $sql\n";
    } catch (PDOException $e) {
        echo "SKIP/ERROR: " . $e->getMessage() . "\n";
    }
}
echo "\nMigration complete.\n";
