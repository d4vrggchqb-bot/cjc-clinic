<?php
require_once __DIR__ . '/backend/config/config.php';
require_once __DIR__ . '/backend/config/database.php';
$pdo = cjcDatabaseConnection();
$val = '[{"department":"College of Special Programs (CSP)","programs":["Bachelor of Science in Criminology"]}]';
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (:key, :val) ON DUPLICATE KEY UPDATE setting_value = :val");
    $stmt->execute(['key' => 'departments_hierarchy', 'val' => $val]);
    $pdo->commit();
    echo "Success\n";
} catch (PDOException $e) {
    $pdo->rollBack();
    echo "PDOException: " . $e->getMessage() . "\n";
}
