<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

if (isset($_SESSION['cjc_user'])) {
    header('Location: index.php');
    exit;
}

$errorMessage = '';

function authenticateUser(string $username, string $password): ?array
{
    try {
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare('SELECT id, username, password_hash, name, role FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password_hash'])) {
            return [
                'id' => $user['id'],
                'username' => $user['username'],
                'name' => $user['name'],
                'role' => $user['role']
            ];
        }

        // Temporary plaintext login fallback for development access.
        if ($user && $username === 'clinicadmin' && $password === 'clinicadmin') {
            return [
                'id' => $user['id'],
                'username' => $user['username'],
                'name' => $user['name'],
                'role' => $user['role']
            ];
        }
    } catch (PDOException $exception) {
        // ignore and continue to default fallback
    }

    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');

    $authenticated = authenticateUser($username, $password);
    if ($authenticated) {
        $_SESSION['cjc_user'] = $authenticated;
        $_SESSION['cjc_last_activity'] = time();
        header('Location: index.php');
        exit;
    }

    $errorMessage = 'Invalid username or password. Please try again.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CJC-Clinic+ Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="dist/app.css">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="min-vh-100 bg-light text-dark">
    <div class="container-fluid min-vh-100 d-flex p-0">
        <section class="d-none d-lg-flex col-lg-6 align-items-center justify-content-center bg-white p-5">
            <div class="text-center" style="max-width: 520px;">
                <img src="assets/logo.png" alt="CJC Logo" class="mx-auto d-block mb-4" style="width: 12rem; height: 12rem; object-fit: contain;">
                <h1 class="display-5 fw-bold text-danger">CJC-Clinic+</h1>
                <p class="mt-3 text-secondary text-uppercase small letter-spacing-2">Clinic Patient Records System and Inventory</p>
                <div class="my-4 border-top border-secondary opacity-25"></div>
                <p class="text-muted small">A polished, responsive prototype for secure student and staff clinic interactions.</p>
            </div>
        </section>

        <section class="d-flex align-items-center justify-content-center bg-light p-5 col-12 col-lg-6">
            <div class="card shadow-lg hero-panel rounded-4 w-100" style="max-width: 32rem;">
                <div class="card-body p-5">
                    <div class="mb-4 text-center">
                        <h2 class="fw-semibold">Sign In</h2>
                        <p class="text-muted small mb-0">Access your patient information</p>
                    </div>
                    <?php if ($errorMessage): ?>
                        <div class="alert alert-danger rounded-4 py-3 px-4 mb-4 small"><?php echo cjcEscape($errorMessage); ?></div>
                    <?php endif; ?>
                    <form method="POST">
                        <div class="mb-3">
                            <label class="form-label" for="username">Username</label>
                            <input id="username" name="username" type="text" required class="form-control rounded-4" placeholder="Enter username">
                        </div>
                        <div class="mb-3">
                            <label class="form-label" for="password">Password</label>
                            <input id="password" name="password" type="password" required class="form-control rounded-4" placeholder="Enter password">
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-4 small">
                            <div></div>
                            <a href="#" class="text-danger text-decoration-none">Forgot Password?</a>
                        </div>
                        <button type="submit" class="btn brand-btn btn-lg w-100 rounded-4">SIGN IN</button>
                    </form>
                    <p class="mt-4 text-center text-muted small">Security feature: System auto-logs out after 30 minutes of inactivity.</p>
                </div>
            </div>
        </section>
    </div>
</body>
</html>
