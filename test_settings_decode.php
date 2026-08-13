<?php
require 'backend/config/config.php';
require 'backend/config/database.php';
$pdo = cjcDatabaseConnection();
$settings = [];
$stmt = $pdo->query('SELECT setting_key, setting_value FROM settings');
while ($row = $stmt->fetch()) {
    $val = $row['setting_value'];
    $decoded = json_decode($val, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $settings[$row['setting_key']] = $decoded;
    } else {
        $settings[$row['setting_key']] = $val;
    }
}
print_r($settings['departments_hierarchy']);
?>
