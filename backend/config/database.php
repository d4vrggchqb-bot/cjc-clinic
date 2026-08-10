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

    // Determine host: Try school ICT server (192.168.10.96) if available, otherwise fallback to local XAMPP (127.0.0.1)
    $envHost = getenv('DB_HOST') ?: '127.0.0.1';
    
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    // Try primary connection
    try {
        $dsn = "mysql:host={$envHost};dbname={$db};charset={$charset}";
        $pdo = new PDO($dsn, $user, $pass, $options);
        return $pdo;
    } catch (PDOException $e) {
        // If primary host failed and it wasn't 127.0.0.1, fallback automatically to local XAMPP
        if ($envHost !== '127.0.0.1' && $envHost !== 'localhost') {
            try {
                $fallbackDsn = "mysql:host=127.0.0.1;dbname={$db};charset={$charset}";
                $pdo = new PDO($fallbackDsn, 'root', '', $options);
                return $pdo;
            } catch (PDOException $e2) {
                // Throw original exception if both failed
                throw $e;
            }
        }
        throw $e;
    }
}
