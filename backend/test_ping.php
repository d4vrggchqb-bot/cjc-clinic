<?php
$host = '192.168.10.96';
$port = 3306;
$timeout = 2.0;

echo "Pinging $host on port $port...\n";
$s = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
if ($s) {
    echo "SUCCESS: Connected to $host:$port\n";
    fclose($s);
} else {
    echo "FAILED: Could not connect to $host:$port. Error $errno: $errstr\n";
}

// Also try direct PDO connection
try {
    $dsn = "mysql:host={$host};dbname=cjc_clinic;charset=utf8mb4";
    $pdo = new PDO($dsn, 'root', '', [PDO::ATTR_TIMEOUT => 2]);
    echo "SUCCESS: PDO connected to $host.\n";
} catch (PDOException $e) {
    echo "FAILED: PDO could not connect: " . $e->getMessage() . "\n";
}
?>
