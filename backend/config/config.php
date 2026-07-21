<?php
// ─── Global CORS Configuration for Headless API ──────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';
if (in_array($origin, ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'])) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost:5173");
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Origin, Cache-Control');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit(0);
}

// ─── Secure session cookie parameters (must be set BEFORE session_start) ───────
session_set_cookie_params([
    'lifetime' => 0,              // expires when browser closes
    'path'     => '/',
    'httponly' => true,           // JS cannot read the cookie (XSS mitigation)
    'secure'   => false,          // Set to TRUE when served over HTTPS
    'samesite' => 'Lax',          // allow cross-port requests during local dev
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

const CJC_SESSION_TIMEOUT = 1800; // 30 minutes
const CJC_BASE_URL = '/';
const CJC_UPLOAD_DIR = __DIR__ . '/../storage/uploads';
const CJC_BRAND_COLOR = '#f26b4a';

// ─── Session Validation ──────────────────────────────────────────────────────
function cjcSessionValidate(): void
{
    if (!isset($_SESSION['cjc_last_activity'])) {
        $_SESSION['cjc_last_activity'] = time();
    }

    if (time() - $_SESSION['cjc_last_activity'] > CJC_SESSION_TIMEOUT) {
        session_unset();
        session_destroy();
        header('Location: ' . CJC_BASE_URL . 'login.php');
        exit;
    }

    $_SESSION['cjc_last_activity'] = time();
}

// ─── Authentication Guard ────────────────────────────────────────────────────
/**
 * Call at the top of every protected page and API endpoint.
 * Checks session presence, validates timeout, and initialises the CSRF token.
 */
function cjcRequireAuth(): void
{
    if (!isset($_SESSION['cjc_user'])) {
        cjcRedirectToLogin();
    }

    cjcSessionValidate();

    // Ensure a CSRF token exists in the session
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

// ─── CSRF Protection ─────────────────────────────────────────────────────────
/**
 * Returns the current session CSRF token (generates one if needed).
 */
function cjcCsrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validates the CSRF token from a request.
 * Accepts it from the X-CSRF-Token header (AJAX) or from a _csrf POST field (forms).
 * Terminates with a 403 on failure.
 */
function cjcCsrfValidate(): void
{
    $submitted = $_SERVER['HTTP_X_CSRF_TOKEN']
        ?? $_POST['_csrf']
        ?? '';

    if (
        empty($submitted) ||
        empty($_SESSION['csrf_token']) ||
        !hash_equals($_SESSION['csrf_token'], $submitted)
    ) {
        http_response_code(403);
        // If the caller expects JSON (API), return JSON; otherwise plain text
        $isApi = str_starts_with($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')
               || str_ends_with($_SERVER['PHP_SELF'] ?? '', '.php') && str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/');
        if ($isApi) {
            header('Content-Type: application/json');
            echo json_encode(['error' => 'CSRF validation failed.']);
        } else {
            echo 'CSRF validation failed. Please refresh the page and try again.';
        }
        exit;
    }
}

// ─── Output Escaping ─────────────────────────────────────────────────────────
function cjcEscape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

// ─── Current User ────────────────────────────────────────────────────────────
/**
 * Returns the authenticated user from the session.
 * Redirects to login if no user is present (never returns a fake guest).
 */
function cjcCurrentUser(): array
{
    if (!isset($_SESSION['cjc_user'])) {
        cjcRedirectToLogin();
    }
    return $_SESSION['cjc_user'];
}

/**
 * Validates that the current user has one of the allowed roles.
 * Terminates with 403 Forbidden if not.
 */
function cjcRequireRole(array $allowedRoles): void
{
    $user = cjcCurrentUser();
    
    // System Administrator (root user) bypasses all role checks
    if ($user['role'] === 'System Administrator') {
        return;
    }
    
    if (!in_array($user['role'], $allowedRoles, true)) {
        http_response_code(403);
        
        $isApi = str_starts_with($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')
               || (str_ends_with($_SERVER['PHP_SELF'] ?? '', '.php') && str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/'));
               
        if ($isApi) {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Forbidden: Insufficient privileges.']);
        } else {
            echo '403 Forbidden: You do not have permission to access this resource.';
        }
        exit;
    }
}

// ─── Redirect Helpers ────────────────────────────────────────────────────────
function cjcRedirectToLogin(): void
{
    header('Location: ' . CJC_BASE_URL . 'login.php');
    exit;
}

// ─── Cryptographic Helpers ───────────────────────────────────────────────────
// Fallback key if not provided by environment. In production, set this securely.
define('CJC_APP_KEY', getenv('CJC_APP_KEY') ?: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
define('CJC_GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '814203352511-rp2uq7eajh56v8k9gnspbmureb2hpk3a.apps.googleusercontent.com');

/**
 * Encrypts data using AES-256-CBC.
 */
function cjcEncrypt(string $data): string
{
    $method = 'aes-256-cbc';
    $ivLength = openssl_cipher_iv_length($method);
    $iv = random_bytes($ivLength);
    $key = hash('sha256', CJC_APP_KEY, true);
    
    $encrypted = openssl_encrypt($data, $method, $key, OPENSSL_RAW_DATA, $iv);
    
    // Prepend IV to the encrypted data and base64 encode
    return base64_encode($iv . $encrypted);
}

/**
 * Decrypts data encrypted by cjcEncrypt.
 */
function cjcDecrypt(string $payload): ?string
{
    $method = 'aes-256-cbc';
    $decoded = base64_decode($payload, true);
    
    if ($decoded === false) {
        return null;
    }
    
    $ivLength = openssl_cipher_iv_length($method);
    if (strlen($decoded) < $ivLength) {
        return null;
    }
    
    $iv = substr($decoded, 0, $ivLength);
    $encrypted = substr($decoded, $ivLength);
    $key = hash('sha256', CJC_APP_KEY, true);
    
    $decrypted = openssl_decrypt($encrypted, $method, $key, OPENSSL_RAW_DATA, $iv);
    return $decrypted !== false ? $decrypted : null;
}

# c:\xampp\php\php.exe -S localhost:8000 -t backend\public
