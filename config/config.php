<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

const CJC_SESSION_TIMEOUT = 1800; // 30 minutes
const CJC_BASE_URL = '/';
const CJC_UPLOAD_DIR = __DIR__ . '/../public/uploads';
const CJC_BRAND_COLOR = '#f26b4a';

function cjcSessionValidate(): void
{
    if (!isset($_SESSION['cjc_last_activity'])) {
        $_SESSION['cjc_last_activity'] = time();
    }

    if (time() - $_SESSION['cjc_last_activity'] > CJC_SESSION_TIMEOUT) {
        session_unset();
        session_destroy();
        header('Location: login.php');
        exit;
    }

    $_SESSION['cjc_last_activity'] = time();
}

function cjcEscape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function cjcCurrentUser(): array
{
    return $_SESSION['cjc_user'] ?? ['username' => 'Guest', 'name' => 'Clinic Attendant', 'role' => 'Medical Staff'];
}

function cjcRedirectToLogin(): void
{
    header('Location: login.php');
    exit;
}
