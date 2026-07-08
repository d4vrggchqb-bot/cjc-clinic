<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class AuthController {
    
    public function login() {
        cjcCsrfValidate();

        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        if ($username === '' || $password === '') {
            $this->jsonResponse(['success' => false, 'error' => 'Please enter both username and password.'], 400);
        }

        if ($this->isRateLimited($username)) {
            $this->jsonResponse(['success' => false, 'error' => 'Too many failed attempts. Please wait 5 minutes before trying again.'], 429);
        }

        $authenticated = $this->authenticateUser($username, $password);

        if ($authenticated) {
            $this->resetAttempts($username);
            session_regenerate_id(true);
            $_SESSION['cjc_user'] = $authenticated;
            $_SESSION['cjc_last_activity'] = time();
            
            $this->jsonResponse(['success' => true, 'user' => $authenticated]);
        }

        $this->recordFailedAttempt($username);
        $this->jsonResponse(['success' => false, 'error' => 'Invalid username or password.'], 401);
    }

    public function logout() {
        session_unset();
        session_destroy();
        $this->jsonResponse(['success' => true]);
    }

    public function checkSession() {
        if (isset($_SESSION['cjc_user'])) {
            cjcSessionValidate();
            $this->jsonResponse(['success' => true, 'user' => $_SESSION['cjc_user']]);
        } else {
            $this->jsonResponse(['success' => false], 401);
        }
    }

    // --- Private Helpers (copied from old login.php) ---

    private function isRateLimited(string $username): bool {
        $key = 'login_attempts_' . hash('sha256', strtolower($username));
        if (!isset($_SESSION[$key])) return false;
        
        if (time() - $_SESSION[$key]['first_attempt'] > 300) {
            unset($_SESSION[$key]);
            return false;
        }
        return $_SESSION[$key]['count'] >= 5;
    }

    private function recordFailedAttempt(string $username): void {
        $key = 'login_attempts_' . hash('sha256', strtolower($username));
        if (!isset($_SESSION[$key]) || time() - $_SESSION[$key]['first_attempt'] > 300) {
            $_SESSION[$key] = ['count' => 0, 'first_attempt' => time()];
        }
        $_SESSION[$key]['count']++;
    }

    private function resetAttempts(string $username): void {
        $key = 'login_attempts_' . hash('sha256', strtolower($username));
        unset($_SESSION[$key]);
    }

    private function authenticateUser(string $username, string $password): ?array {
        try {
            $pdo = cjcDatabaseConnection();
            $stmt = $pdo->prepare('SELECT id, username, password_hash, name, role FROM users WHERE username = :username LIMIT 1');
            $stmt->execute(['username' => $username]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                return [
                    'id'       => $user['id'],
                    'username' => $user['username'],
                    'name'     => $user['name'],
                    'role'     => $user['role'],
                ];
            }
        } catch (PDOException $exception) {
            error_log('[CJC-CLINIC] Login DB error: ' . $exception->getMessage());
        }
        return null;
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
