<?php
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query('SELECT username, password_hash, role FROM users');
$users = $stmt->fetchAll();
foreach ($users as $u) {
    echo "Username: " . $u['username'] . "\n";
    $passwords = ['admin', 'password', 'admin123', '123456', 'cjc'];
    foreach ($passwords as $p) {
        if (password_verify($p, $u['password_hash'])) {
            echo "Found password for " . $u['username'] . ": " . $p . "\n";
        }
    }
}
