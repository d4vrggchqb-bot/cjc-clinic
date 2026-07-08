<?php require 'backend/config/database.php'; $pdo = cjcDatabaseConnection(); $stmt = $pdo->query('SELECT username, password_hash, role FROM users'); print_r($stmt->fetchAll());
