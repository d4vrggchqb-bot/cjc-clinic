<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$newPassword = password_hash('admin123', PASSWORD_DEFAULT);
$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'");
$stmt->execute([$newPassword]);
echo "Password for admin has been reset to: admin123\n";
