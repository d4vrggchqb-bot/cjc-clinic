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

    $host    = getenv('DB_HOST')    ?: '127.0.0.1';
    $db      = getenv('DB_NAME')    ?: 'cjc_clinic';
    $user    = getenv('DB_USER')    ?: 'root';
    $pass    = getenv('DB_PASS')    ?: '';
    $charset = getenv('DB_CHARSET') ?: 'utf8mb4';

    // Warn loudly if credentials are not configured
    if ($user === '') {
        error_log('[CJC-CLINIC] DB_USER environment variable is not set. Using empty credentials — this is insecure.');
    }

    $dsn     = "mysql:host={$host};dbname={$db};charset={$charset}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $user, $pass, $options);
    return $pdo;
}
