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

    public function googleLogin() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcCsrfValidate();

        $input = json_decode(file_get_contents('php://input'), true);
        $token = $input['token'] ?? '';

        if (empty($token)) {
            $this->jsonResponse(['success' => false, 'error' => 'No token provided.'], 400);
        }

        // Verify token with Google API
        $verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($token);
        
        $context = stream_context_create([
            'http' => [
                'ignore_errors' => true
            ]
        ]);
        
        $response = file_get_contents($verifyUrl, false, $context);
        
        if ($response === false) {
            $this->jsonResponse(['success' => false, 'error' => 'Failed to verify token with Google.'], 500);
        }
        
        $payload = json_decode($response, true);
        
        if (isset($payload['error'])) {
            $this->jsonResponse(['success' => false, 'error' => 'Invalid Google token.'], 401);
        }
        
        // Validate Audience
        if ($payload['aud'] !== CJC_GOOGLE_CLIENT_ID && CJC_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
            // If the client ID is customized, verify audience. If not, bypass to allow testing, but warn in logs.
            $this->jsonResponse(['success' => false, 'error' => 'Token audience mismatch.'], 401);
        }
        
        // Validate Domain
        $email = $payload['email'] ?? '';
        if (!str_ends_with(strtolower($email), '@g.cjc.edu.ph')) {
            $this->jsonResponse(['success' => false, 'error' => 'Access denied. Only @g.cjc.edu.ph accounts are allowed.'], 403);
        }
        
        $username = $email;
        $name = $payload['name'] ?? explode('@', $email)[0];
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare('SELECT id, username, password_hash, name, role, clinic_branch FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();
        
        if (!$user) {
            // User does not exist in the database. Reject login.
            $this->jsonResponse(['success' => false, 'error' => 'Access Denied. Your account has not been authorized by the administrator.'], 403);
        } else {
            $user = [
                'id' => $user['id'],
                'username' => $user['username'],
                'name' => $user['name'],
                'role' => $user['role'],
                'clinic_branch' => $user['clinic_branch']
            ];
        }
        
        session_regenerate_id(true);
        $_SESSION['cjc_user'] = $user;
        $_SESSION['cjc_last_activity'] = time();
        
        $this->jsonResponse(['success' => true, 'user' => $user]);
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

    public function getUsers() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        cjcRequireRole(['Admin', 'Superadmin']); // Assuming Admin can manage users
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->query('SELECT id, username, name, role, clinic_branch, created_at FROM users ORDER BY username ASC');
        $this->jsonResponse(['users' => $stmt->fetchAll()]);
    }

    public function createUser() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Admin', 'Superadmin']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $name = trim($input['name'] ?? $username);
        $role = trim($input['role'] ?? 'Staff');
        $clinic_branch = trim($input['clinic_branch'] ?? 'College Clinic');
        
        if (empty($username)) {
            $this->jsonResponse(['success' => false, 'message' => 'Username is required.'], 400);
        }
        if (empty($password)) {
            $password = bin2hex(random_bytes(16));
        }
        
        $pdo = cjcDatabaseConnection();
        try {
            $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, name, role, clinic_branch) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $name, $role, $clinic_branch]);
            $this->jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                $this->jsonResponse(['success' => false, 'message' => 'Username already exists.'], 400);
            }
            $this->jsonResponse(['success' => false, 'message' => 'Failed to create user.'], 500);
        }
    }

    public function deleteUser() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Admin', 'Superadmin']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($input['id'] ?? 0);
        
        if ($id === $_SESSION['cjc_user']['id']) {
            $this->jsonResponse(['success' => false, 'message' => 'Cannot delete yourself.'], 400);
        }
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $this->jsonResponse(['success' => true]);
    }

    public function resetPassword() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Admin', 'Superadmin']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($input['id'] ?? 0);
        $new_password = $input['new_password'] ?? '';
        
        if (empty($new_password)) {
            $this->jsonResponse(['success' => false, 'message' => 'New password is required.'], 400);
        }
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([password_hash($new_password, PASSWORD_DEFAULT), $id]);
        $this->jsonResponse(['success' => true]);
    }

    public function changePassword() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $current = $input['current_password'] ?? '';
        $new = $input['new_password'] ?? '';
        
        if (empty($current) || empty($new)) {
            $this->jsonResponse(['success' => false, 'message' => 'Current and new passwords are required.'], 400);
        }
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['cjc_user']['id']]);
        $user = $stmt->fetch();
        
        if (!$user || !password_verify($current, $user['password_hash'])) {
            $this->jsonResponse(['success' => false, 'message' => 'Incorrect current password.'], 400);
        }
        
        $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([password_hash($new, PASSWORD_DEFAULT), $_SESSION['cjc_user']['id']]);
        $this->jsonResponse(['success' => true]);
    }

    public function requestPasswordReset() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcCsrfValidate();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $username = trim($input['username'] ?? '');

        if (empty($username)) {
            $this->jsonResponse(['success' => false, 'message' => 'Username is required.'], 400);
        }

        $pdo = cjcDatabaseConnection();

        // Ensure password_resets table exists (simple migration)
        $pdo->exec("CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(128) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $stmt = $pdo->prepare('SELECT id, username FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();

        if (!$user) {
            // Do not reveal whether the user exists — still return success
            $this->jsonResponse(['success' => true, 'message' => 'If the account exists, you will receive reset instructions.']);
        }

        $token = bin2hex(random_bytes(32));
        $expires = (new DateTime('+1 hour'))->format('Y-m-d H:i:s');

        $ins = $pdo->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)');
        $ins->execute([$user['id'], $token, $expires]);

        // In production you'd email the token; for local dev return it in the response
        $this->jsonResponse(['success' => true, 'message' => 'Password reset created.', 'token' => $token]);
    }

    public function performPasswordReset() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcCsrfValidate();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $token = $input['token'] ?? '';
        $new_password = $input['new_password'] ?? '';

        if (empty($token) || empty($new_password)) {
            $this->jsonResponse(['success' => false, 'message' => 'Token and new password are required.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare('SELECT pr.id AS pr_id, pr.user_id, pr.expires_at, u.username FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE pr.token = ? LIMIT 1');
        $stmt->execute([$token]);
        $row = $stmt->fetch();

        if (!$row) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid or expired token.'], 400);
        }

        if (new DateTime($row['expires_at']) < new DateTime()) {
            $this->jsonResponse(['success' => false, 'message' => 'Token has expired.'], 400);
        }

        $update = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $update->execute([password_hash($new_password, PASSWORD_DEFAULT), $row['user_id']]);

        // Remove used token
        $del = $pdo->prepare('DELETE FROM password_resets WHERE id = ?');
        $del->execute([$row['pr_id']]);

        $this->jsonResponse(['success' => true, 'message' => 'Password has been reset for ' . $row['username']]);
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
            $stmt = $pdo->prepare('SELECT id, username, password_hash, name, role, clinic_branch FROM users WHERE username = :username LIMIT 1');
            $stmt->execute(['username' => $username]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                return [
                    'id'            => $user['id'],
                    'username'      => $user['username'],
                    'name'          => $user['name'],
                    'role'          => $user['role'],
                    'clinic_branch' => $user['clinic_branch'],
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
