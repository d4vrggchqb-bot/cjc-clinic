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

    // Settings Table
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS `settings` (
      `setting_key` VARCHAR(50) PRIMARY KEY,
      `setting_value` TEXT NOT NULL
    );
    ");

    try { $pdo->exec("ALTER TABLE `profiles` ADD COLUMN `height` VARCHAR(20) DEFAULT NULL;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `profiles` ADD COLUMN `weight` VARCHAR(20) DEFAULT NULL;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `profiles` ADD COLUMN `mother_name` VARCHAR(100) DEFAULT NULL;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `profiles` ADD COLUMN `father_name` VARCHAR(100) DEFAULT NULL;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `appointments` ADD COLUMN `appointment_code` VARCHAR(50) DEFAULT NULL AFTER `id`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `consultations` ADD COLUMN `appointment_id` INT NULL AFTER `profile_id`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `consultations` ADD CONSTRAINT `fk_consultations_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `appointments` MODIFY COLUMN `status` ENUM('Scheduled', 'In Consultation', 'Completed', 'Cancelled', 'No-Show') DEFAULT 'Scheduled';"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `users` ADD COLUMN `account_type` ENUM('gsuite', 'personal') DEFAULT 'personal';"); } catch (Exception $e) {}
    try { $pdo->exec("UPDATE `users` SET `account_type` = 'gsuite' WHERE `username` LIKE '%@%';"); } catch (Exception $e) {}
    try { $pdo->exec("UPDATE `users` SET `account_type` = 'personal' WHERE `username` NOT LIKE '%@%';"); } catch (Exception $e) {}

    // Inventory Batches: Main vs Drawer & Batch details
    try { $pdo->exec("ALTER TABLE `inventory_batches` ADD COLUMN `main_stock` INT NOT NULL DEFAULT 0 AFTER `stock_remaining`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `inventory_batches` ADD COLUMN `drawer_stock` INT NOT NULL DEFAULT 0 AFTER `main_stock`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `inventory_batches` ADD COLUMN `lot_number` VARCHAR(50) DEFAULT NULL AFTER `batch_number`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `inventory_batches` ADD COLUMN `restock_semester` VARCHAR(50) DEFAULT '1st Semester' AFTER `expired_on`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `inventory_batches` ADD COLUMN `school_year` VARCHAR(20) DEFAULT '2025-2026' AFTER `restock_semester`;"); } catch (Exception $e) {}

    // Backfill existing batches: if main_stock and drawer_stock are both 0 but stock_remaining > 0, set main_stock = stock_remaining
    try { $pdo->exec("UPDATE `inventory_batches` SET `main_stock` = `stock_remaining` WHERE `main_stock` = 0 AND `drawer_stock` = 0 AND `stock_remaining` > 0;"); } catch (Exception $e) {}
    try { $pdo->exec("UPDATE `inventory_batches` SET `lot_number` = `batch_number` WHERE (`lot_number` IS NULL OR `lot_number` = '') AND `batch_number` IS NOT NULL;"); } catch (Exception $e) {}

    // Inventory Logs: Add transfer and edit action types and locations
    try { $pdo->exec("ALTER TABLE `inventory_logs` MODIFY COLUMN `action_type` ENUM('restock', 'dispense', 'dispose', 'adjust', 'transfer', 'edit') NOT NULL;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `inventory_logs` ADD COLUMN `source_location` ENUM('main', 'drawer') NULL AFTER `quantity_changed`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `inventory_logs` ADD COLUMN `target_location` ENUM('main', 'drawer') NULL AFTER `source_location`;"); } catch (Exception $e) {}

    // Patient profile attachments (used by the Patient View modal)
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS `profile_attachments` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `profile_id` INT NOT NULL,
      `filename` VARCHAR(255) NOT NULL,
      `file_url` VARCHAR(500) NOT NULL,
      `uploaded_by` VARCHAR(100) DEFAULT NULL,
      `extracted_text` LONGTEXT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
    );
    ");

    // Remove the canned findings generated by the old demo-only OCR script.
    // Real OCR never fabricates a clinical result when an image cannot be read.
    $pdo->exec("
        UPDATE `profile_attachments`
        SET `extracted_text` = NULL
        WHERE `extracted_text` LIKE 'HEMATOLOGY REPORT (COMPLETE BLOOD COUNT)%'
           OR `extracted_text` LIKE 'RADIOLOGY REPORT - CHEST X-RAY (PA VIEW)%'
    ");

    // Retry attachments that were uploaded while the OCR engine was unavailable.
    $ocrScript = realpath(__DIR__ . '/backend/scripts/ocr_parser.py');
    $uploadDir = realpath(CJC_UPLOAD_DIR);
    $pythonExecutable = getenv('CJC_PYTHON_EXECUTABLE') ?: 'python';
    if (DIRECTORY_SEPARATOR === '\\' && $pythonExecutable === 'python') {
        $localAppData = getenv('LOCALAPPDATA');
        $preferredPython = $localAppData ? glob($localAppData . '\\Programs\\Python\\Python313\\python.exe') : [];
        if (!empty($preferredPython)) {
            $pythonExecutable = $preferredPython[0];
        }
    }

    $recoveredExtracts = 0;
    if ($ocrScript && $uploadDir) {
        $attachments = $pdo->query("SELECT id, file_url FROM profile_attachments WHERE extracted_text IS NULL")->fetchAll(PDO::FETCH_ASSOC);
        $updateExtract = $pdo->prepare("UPDATE profile_attachments SET extracted_text = :text WHERE id = :id");

        foreach ($attachments as $attachment) {
            parse_str(parse_url($attachment['file_url'], PHP_URL_QUERY) ?? '', $query);
            $storedFile = basename($query['file'] ?? '');
            $filePath = realpath($uploadDir . DIRECTORY_SEPARATOR . $storedFile);
            if (!$storedFile || !$filePath || !str_starts_with($filePath, $uploadDir . DIRECTORY_SEPARATOR)) {
                continue;
            }

            $output = [];
            $returnCode = 0;
            $command = escapeshellarg($pythonExecutable) . ' ' . escapeshellarg($ocrScript) . ' ' . escapeshellarg($filePath) . ' 2>&1';
            exec($command, $output, $returnCode);
            $ocr = $returnCode === 0 ? json_decode(implode("\n", $output), true) : null;
            if (!empty($ocr['success']) && !empty($ocr['text'])) {
                $updateExtract->execute(['text' => $ocr['text'], 'id' => $attachment['id']]);
                $recoveredExtracts++;
            }
        }
    }

    try {
        $pdo->exec("ALTER TABLE `profiles` MODIFY COLUMN `profile_type` ENUM('student', 'employee', 'guest') NOT NULL DEFAULT 'student'");
    } catch (PDOException $e) {
        // Ignore error
    }

    try {
        $pdo->exec("ALTER TABLE `borrowings` ADD COLUMN `booking_code` VARCHAR(20) DEFAULT NULL UNIQUE AFTER `id`");
    } catch (PDOException $e) {
        // Ignore error
    }

    try {
        $pdo->exec("ALTER TABLE `borrowings` ADD COLUMN `expected_return_date` DATETIME DEFAULT NULL AFTER `purpose`");
    } catch (PDOException $e) {
        // Ignore error
    }

    try {
        $pdo->exec("ALTER TABLE `borrowings` ADD COLUMN `released_by` INT DEFAULT NULL AFTER `expected_return_date`");
    } catch (PDOException $e) {
        // Ignore error
    }

    // borrowed_items: track whether equipment stock was reserved
    try {
        $pdo->exec("ALTER TABLE `borrowed_items` ADD COLUMN `stock_reserved` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`");
    } catch (PDOException $e) {
        // Ignore error
    }

    // Return reconciliation table — tracks per-item return details
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS `borrowed_item_returns` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `borrowed_item_id` INT NOT NULL,
      `quantity_returned` INT NOT NULL DEFAULT 0,
      `quantity_consumed` INT NOT NULL DEFAULT 0,
      `notes` TEXT DEFAULT NULL,
      `processed_by` INT DEFAULT NULL,
      `returned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`borrowed_item_id`) REFERENCES `borrowed_items`(`id`) ON DELETE CASCADE,
      FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
    );
    ");

    try {
        $pdo->exec("ALTER TABLE `inventory_items` 
            ADD COLUMN `serial_no` VARCHAR(100) DEFAULT NULL AFTER `formulation`,
            ADD COLUMN `model_no` VARCHAR(100) DEFAULT NULL AFTER `serial_no`,
            ADD COLUMN `supplier` VARCHAR(150) DEFAULT NULL AFTER `model_no`,
            ADD COLUMN `unit` VARCHAR(50) DEFAULT NULL AFTER `supplier`,
            ADD COLUMN `date_acquired` DATE DEFAULT NULL,
            ADD COLUMN `date_purchased` DATE DEFAULT NULL,
            ADD COLUMN `last_calibrated` DATE DEFAULT NULL,
            ADD COLUMN `calibration_due` DATE DEFAULT NULL,
            ADD COLUMN `calibration_notes` TEXT DEFAULT NULL
        ");
    } catch (PDOException $e) {
        // Ignore error
    }

    // Equipment Calibrations Table
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS `equipment_calibrations` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `item_id` INT NOT NULL,
      `batch_id` INT DEFAULT NULL,
      `cert_type` ENUM('external_upload', 'internal_generated') NOT NULL DEFAULT 'external_upload',
      `calibrated_by` VARCHAR(150) DEFAULT NULL,
      `cert_number` VARCHAR(100) DEFAULT NULL,
      `serial_no` VARCHAR(100) DEFAULT NULL,
      `calibration_date` DATE DEFAULT NULL,
      `due_date` DATE DEFAULT NULL,
      `file_url` VARCHAR(500) DEFAULT NULL,
      `filename` VARCHAR(255) DEFAULT NULL,
      `uploaded_by` VARCHAR(100) DEFAULT NULL,
      `notes` TEXT DEFAULT NULL,
      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE
    );
    ");

    try { $pdo->exec("ALTER TABLE `equipment_calibrations` ADD COLUMN `batch_id` INT DEFAULT NULL AFTER `item_id`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `equipment_calibrations` ADD COLUMN `serial_no` VARCHAR(100) DEFAULT NULL AFTER `cert_number`;"); } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE `inventory_batches` 
            ADD COLUMN `last_calibrated` DATE DEFAULT NULL,
            ADD COLUMN `calibration_due` DATE DEFAULT NULL,
            ADD COLUMN `calibration_notes` TEXT DEFAULT NULL
        ");
    } catch (Exception $e) {}

    // Performance Indexes
    $indexes = [
        "ALTER TABLE `profiles` ADD INDEX `idx_profiles_pid` (`patient_id_number`)",
        "ALTER TABLE `profiles` ADD INDEX `idx_profiles_name` (`last_name`, `first_name`)",
        "ALTER TABLE `profiles` ADD INDEX `idx_profiles_dept` (`college_dept`, `year_level`)",
        "ALTER TABLE `consultations` ADD INDEX `idx_consultations_branch_date` (`clinic_branch`, `created_at`)",
        "ALTER TABLE `consultations` ADD INDEX `idx_consultations_status` (`status`)",
        "ALTER TABLE `inventory_batches` ADD INDEX `idx_batches_lookup` (`item_id`, `clinic_branch`, `status`)",
        "ALTER TABLE `inventory_logs` ADD INDEX `idx_logs_created` (`created_at`, `action_type`)",
        "ALTER TABLE `appointments` ADD INDEX `idx_appointments_date_branch` (`appointment_date`, `clinic_branch`, `status`)",
        "ALTER TABLE `borrowings` ADD INDEX `idx_borrowings_booking_code` (`booking_code`)",
        "ALTER TABLE `borrowings` ADD INDEX `idx_borrowings_status` (`status`, `created_at`)"
    ];

    foreach ($indexes as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Exception $e) {
            // Index already exists or non-critical error
        }
    }

    try { $pdo->exec("ALTER TABLE `consultations` ADD COLUMN `clinic_process` VARCHAR(100) DEFAULT NULL AFTER `purpose`;"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `consultations` ADD COLUMN `emergency_disposition` VARCHAR(100) DEFAULT NULL AFTER `clinic_process`;"); } catch (Exception $e) {}

    // Seed default Clinic Processes in settings if missing
    try {
        $checkStmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'clinic_processes' LIMIT 1");
        $checkStmt->execute();
        $existing = $checkStmt->fetchColumn();
        if (!$existing) {
            $defaultProcesses = [
                ['id' => 'cp_gen', 'name' => 'General Health Services', 'requires_disposition' => false, 'is_active' => true],
                ['id' => 'cp_med', 'name' => 'Medical check-up', 'requires_disposition' => false, 'is_active' => true],
                ['id' => 'cp_den', 'name' => 'Dental Check-up', 'requires_disposition' => false, 'is_active' => true],
                ['id' => 'cp_otc', 'name' => 'OTC Medicine', 'requires_disposition' => false, 'is_active' => true],
                ['id' => 'cp_emg', 'name' => 'Emergency Cases', 'requires_disposition' => true, 'is_active' => true]
            ];
            $seedStmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('clinic_processes', :val)");
            $seedStmt->execute(['val' => json_encode($defaultProcesses)]);
        }
    } catch (Exception $e) {}

    echo "Tables and performance indexes created/updated successfully. Recovered {$recoveredExtracts} OCR extract(s).\n";


} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
