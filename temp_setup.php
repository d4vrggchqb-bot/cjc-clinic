<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$pdo->exec("CREATE TABLE IF NOT EXISTS medcerts (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    profile_id INT NOT NULL, 
    issued_to VARCHAR(255), 
    issued_by VARCHAR(255), 
    reason TEXT, 
    valid_until DATE, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
)");
echo 'Medcerts table ready.';
