<?php
$ch = curl_init('http://localhost/CJC_CLINIC/backend/public/api/index.php?route=medcert&action=generate');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['profile_id' => 1, 'issued_to' => 'test', 'issued_by' => 'doc', 'reason' => 'sick', 'valid_until' => '2026-07-12']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
echo "RESPONSE:\n" . $res;
