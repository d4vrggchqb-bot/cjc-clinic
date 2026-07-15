-- CJC Clinic Management System - Database Schema
-- Generated based on PHP Controllers

CREATE DATABASE IF NOT EXISTS `cjc_clinic` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cjc_clinic`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` ENUM('Admin', 'Doctor', 'Nurse', 'Clerk') NOT NULL DEFAULT 'Clerk',
  `clinic_branch` ENUM('College Clinic', 'BED Clinic', 'Power Campus Clinic') NOT NULL DEFAULT 'College Clinic',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default Admin Account (Password: admin123)
-- Hash generated via standard password_hash('admin123', PASSWORD_BCRYPT)
INSERT INTO `users` (`username`, `password_hash`, `name`, `role`) 
VALUES ('admin', '$2y$10$SFGU8A.a0wKjKrFGF.lfk.mx6vfdGoEz7Gq.famdczyNrATGZwuQ.', 'System Administrator', 'Admin') 
ON DUPLICATE KEY UPDATE `id`=`id`;


-- 2. Profiles Table (Patients/Students/Employees)
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `profile_type` ENUM('student', 'employee') NOT NULL DEFAULT 'student',
  `patient_id_number` VARCHAR(50) DEFAULT NULL,
  `school_year` VARCHAR(20) DEFAULT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `middle_initial` VARCHAR(10) DEFAULT NULL,
  `birthdate` DATE DEFAULT NULL,
  `gender` VARCHAR(20) DEFAULT NULL,
  `sub_type` VARCHAR(50) DEFAULT NULL,
  `college_dept` VARCHAR(100) DEFAULT NULL,
  `year_level` VARCHAR(20) DEFAULT NULL,
  `course` VARCHAR(100) DEFAULT NULL,
  `contact` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `emergency_contact_name` VARCHAR(100) DEFAULT NULL,
  `emergency_contact_number` VARCHAR(50) DEFAULT NULL,
  `emergency_relation` VARCHAR(50) DEFAULT NULL,
  `blood_type` VARCHAR(10) DEFAULT NULL,
  `health_history` TEXT DEFAULT NULL,
  `vital_stats` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3. Consultations Table
CREATE TABLE IF NOT EXISTS `consultations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `profile_id` INT NOT NULL,
  `purpose` VARCHAR(255) NOT NULL,
  `complaint` TEXT DEFAULT NULL,
  `time_out` TIMESTAMP NULL DEFAULT NULL,
  `blood_pressure` VARCHAR(50) DEFAULT NULL,
  `temperature` VARCHAR(50) DEFAULT NULL,
  `weight` VARCHAR(50) DEFAULT NULL,
  `diagnosis` TEXT DEFAULT NULL,
  `treatment` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `prescriptions` TEXT DEFAULT NULL,
  `status` ENUM('waiting', 'active', 'in-progress', 'pending', 'completed') DEFAULT 'waiting',
  `clinic_branch` ENUM('College Clinic', 'BED Clinic', 'Power Campus Clinic') DEFAULT 'College Clinic',
  `assigned_to` VARCHAR(100) DEFAULT NULL,
  `attended_by` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);


-- 4. Inventory Catalog (Items)
CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category` ENUM('medicine', 'supply', 'equipment') NOT NULL,
  `brand_name` VARCHAR(100) DEFAULT NULL,
  `generic_name` VARCHAR(100) NOT NULL,
  `dosage` VARCHAR(50) DEFAULT NULL,
  `formulation` VARCHAR(100) DEFAULT NULL,
  `alert_threshold` INT DEFAULT 20,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.1 Inventory Batches (Physical Stock)
CREATE TABLE IF NOT EXISTS `inventory_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_id` INT NOT NULL,
  `clinic_branch` ENUM('College Clinic', 'BED Clinic', 'Power Campus Clinic') NOT NULL,
  `batch_number` VARCHAR(50) DEFAULT NULL,
  `stock_remaining` INT NOT NULL DEFAULT 0,
  `date_arrived` DATE DEFAULT NULL,
  `expired_on` DATE DEFAULT NULL,
  `status` ENUM('active', 'depleted', 'expired') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE
);

-- 4.2 Inventory Logs (History)
CREATE TABLE IF NOT EXISTS `inventory_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `action_type` ENUM('restock', 'dispense', 'dispose', 'adjust') NOT NULL,
  `quantity_changed` INT NOT NULL,
  `disposed_to` VARCHAR(255) DEFAULT NULL,
  `processed_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);


-- 5. Medcerts Table (Medical Certificates)
CREATE TABLE IF NOT EXISTS `medcerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `profile_id` INT NOT NULL,
  `issued_to` VARCHAR(150) NOT NULL,
  `issued_by` VARCHAR(150) NOT NULL,
  `reason` TEXT NOT NULL,
  `valid_until` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);


-- 6. Purchase Orders Table
CREATE TABLE IF NOT EXISTS `purchase_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category` ENUM('medicine', 'supply', 'equipment') NOT NULL,
  `generic_name` VARCHAR(150) NOT NULL,
  `brand_name` VARCHAR(150) DEFAULT NULL,
  `dosage` VARCHAR(50) DEFAULT NULL,
  `clinic_branch` ENUM('College Clinic', 'BED Clinic', 'Power Campus Clinic') NOT NULL,
  `supplier` VARCHAR(150) DEFAULT NULL,
  `quantity_ordered` INT NOT NULL DEFAULT 1,
  `expected_delivery_date` DATE DEFAULT NULL,
  `requested_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('pending', 'approved', 'delivered', 'cancelled') DEFAULT 'pending',
  `actual_delivery_date` DATE DEFAULT NULL,
  `manifest_details` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Password Resets Table
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token` VARCHAR(128) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- 8. Appointments Table
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `profile_id` INT NOT NULL,
  `appointment_date` DATE NOT NULL,
  `appointment_time` TIME NOT NULL,
  `purpose` VARCHAR(255) NOT NULL,
  `clinic_branch` ENUM('College Clinic', 'BED Clinic', 'Power Campus Clinic') NOT NULL DEFAULT 'College Clinic',
  `group_name` VARCHAR(150) DEFAULT NULL,
  `status` ENUM('Scheduled', 'Completed', 'Cancelled', 'No-Show') DEFAULT 'Scheduled',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);

#php -S localhost:8000 -t backend/public