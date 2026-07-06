-- CJC-Clinic+ MySQL schema

CREATE DATABASE IF NOT EXISTS cjc_clinic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cjc_clinic;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profile_type ENUM('student', 'employee') NOT NULL,
  name VARCHAR(150) NOT NULL,
  contact VARCHAR(100) DEFAULT NULL,
  program_department VARCHAR(120) DEFAULT NULL,
  blood_type VARCHAR(10) DEFAULT NULL,
  health_history TEXT DEFAULT NULL,
  vital_stats TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('medicine', 'supply', 'equipment') NOT NULL,
  brand_name VARCHAR(150) NOT NULL,
  generic_name VARCHAR(150) DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  expired_on DATE DEFAULT NULL,
  last_ordered DATE DEFAULT NULL,
  status VARCHAR(60) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(180) NOT NULL,
  requested_date DATE NOT NULL,
  transit_status ENUM('pending', 'in transit', 'delivered') NOT NULL DEFAULT 'pending',
  delivery_date DATE DEFAULT NULL,
  manifest_details TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profile_id INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('active', 'completed', 'waiting') NOT NULL DEFAULT 'waiting',
  provider VARCHAR(100) NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medcerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profile_id INT NOT NULL,
  issued_to VARCHAR(150) NOT NULL,
  issued_by VARCHAR(120) NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  valid_until DATE NOT NULL,
  document_path VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL,
  details TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO users (username, password_hash, name, role)
VALUES ('clinicadmin', '$2y$10$T3QVy8M3fV0Q/0bfsNnGzuVXRn3xBS6Jy2A1gx7H5GZk7OBUQbP.m', 'CJC Clinic Admin', 'System Administrator');

INSERT IGNORE INTO profiles (profile_type, name, contact, program_department, blood_type, health_history, vital_stats)
VALUES
('student', 'Janna Dela Cruz', '0917 123 4567', 'Senior High School - STEM', 'O+', 'Asthma, seasonal allergies', 'BP 110/70, Temp 36.7°C'),
('employee', 'Lance Navarro', '0919 765 4321', 'Nursing Staff', 'A+', 'No known conditions', 'BP 118/76, Temp 36.5°C');

INSERT IGNORE INTO inventory (category, brand_name, generic_name, stock, expired_on, status)
VALUES
('medicine', 'Panadol', 'Paracetamol', 24, '2025-11-30', 'available'),
('supply', 'Gauze Pads', 'Non-woven gauze', 12, NULL, 'available'),
('equipment', 'Stethoscope', 'Acoustic Stethoscope', 6, NULL, 'available');

INSERT IGNORE INTO purchase_requests (item_name, requested_date, transit_status, delivery_date, manifest_details)
VALUES
('Amoxicillin Capsules', '2026-06-10', 'in transit', '2026-06-20', 'Batch #A123 / Route 5'),
('Surgical Gloves', '2026-05-25', 'delivered', '2026-05-30', 'Manifest #G78 / Warehouse'),
('Thermometers', '2026-06-18', 'pending', NULL, 'PO #T99');

INSERT IGNORE INTO consultations (profile_id, reason, status, provider, notes)
VALUES
(1, 'Fever and headache evaluation', 'active', 'Dr. Angela Santos', 'Patient remains under observation for infection risk.'),
(2, 'Follow-up vaccination review', 'completed', 'Nurse Maria Luz', 'Routine check completed, no complications.');

INSERT IGNORE INTO medcerts (profile_id, issued_to, issued_by, reason, valid_until)
VALUES
(1, 'Janna Dela Cruz', 'Dr. Angela Santos', 'Medical leave for respiratory treatment', '2026-07-10');
