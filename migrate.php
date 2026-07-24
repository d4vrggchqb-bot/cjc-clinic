<?php
require_once __DIR__ . '/backend/config/database.php';
try {
    $pdo = cjcDatabaseConnection();
    
    // Borrowings Table
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS `borrowings` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `profile_id` INT NOT NULL,
      `purpose` VARCHAR(255) NOT NULL,
      `status` ENUM('pending', 'active', 'returned') DEFAULT 'pending',
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      `returned_at` TIMESTAMP NULL DEFAULT NULL,
      FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
    );
    ");

    // Borrowed Items Table
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS `borrowed_items` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `borrowing_id` INT NOT NULL,
      `inventory_item_id` INT NOT NULL,
      `quantity` INT NOT NULL DEFAULT 1,
      `item_type` ENUM('equipment', 'supply') NOT NULL,
      `status` ENUM('borrowed', 'returned', 'dispensed') NOT NULL,
      FOREIGN KEY (`borrowing_id`) REFERENCES `borrowings`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE
    );
    ");
    
    echo "Tables created successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
