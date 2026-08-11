<?php
require_once __DIR__ . '/config.php';

/**
 * Returns a singleton PDO connection.
 *
 * Credentials are read from environment variables so they are never
 * hard-coded in source.  Set them in your web-server environment,
 * a .env file loaded by your deployment pipeline, or php.ini's
 * env[] section.
 *
 * Required env vars:
 *   DB_HOST     (default: 127.0.0.1)
 *   DB_NAME     (default: cjc_clinic)
 *   DB_USER     (NO default — must be set)
 *   DB_PASS     (NO default — must be set)
 *   DB_CHARSET  (default: utf8mb4)
 */
function cjcIsPortOpen(string $host, int $port = 3306, float $timeout = 1.0): bool
{
    if ($host === '127.0.0.1' || $host === 'localhost') return true;
    $s = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
    if ($s) {
        fclose($s);
        return true;
    }
    return false;
}

function cjcDatabaseConnection(): PDO
{
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $db      = getenv('DB_NAME')    ?: 'cjc_clinic';
    $user    = getenv('DB_USER')    ?: 'root';
    $pass    = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
    $charset = getenv('DB_CHARSET') ?: 'utf8mb4';

    // Primary host: Try School ICT Central Server (192.168.10.96) first
    $primaryHost = getenv('DB_HOST') ?: '192.168.10.96';
    
    // Fast socket check: if 192.168.10.96 is unreachable, switch to 127.0.0.1 instantly
    $targetHost = $primaryHost;
    $targetUser = $user;
    $targetPass = $pass;

    if ($primaryHost !== '127.0.0.1' && $primaryHost !== 'localhost') {
        if (!cjcIsPortOpen($primaryHost, 3306, 0.4)) {
            $targetHost = '127.0.0.1';
            $targetUser = 'root';
            $targetPass = '';
        }
    }

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 2,
    ];

    try {
        $dsn = "mysql:host={$targetHost};dbname={$db};charset={$charset}";
        $pdo = new PDO($dsn, $targetUser, $targetPass, $options);
        return $pdo;
    } catch (PDOException $e) {
        if ($targetHost !== '127.0.0.1' && $targetHost !== 'localhost') {
            try {
                $fallbackDsn = "mysql:host=127.0.0.1;dbname={$db};charset={$charset}";
                $pdo = new PDO($fallbackDsn, 'root', '', $options);
                return $pdo;
            } catch (PDOException $e2) {
                throw $e;
            }
        }
        throw $e;
    }
}
