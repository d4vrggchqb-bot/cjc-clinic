<?php
require_once __DIR__ . '/../config/database.php';
$pdo = cjcDatabaseConnection();
$stmt = $pdo->query('SELECT id, first_name, last_name, patient_id_number, contact, email, emergency_contact_number FROM profiles ORDER BY id DESC');
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo "ID: {$r['id']} | Name: {$r['first_name']} {$r['last_name']} | ID_NUM: {$r['patient_id_number']} | Contact: {$r['contact']} | Email: {$r['email']} | Emerg: {$r['emergency_contact_number']}\n";
}
