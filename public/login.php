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
        body {
            font-family: 'Inter', sans-serif;
            background-color: #ffffff;
        }

        .auth-shell {
            background-color: #ffffff;
        }

        .auth-left {
            background-color: #ffffff;
            position: relative;
            overflow: hidden;
        }
        
        .login-grid-bg {
            background-image: 
                linear-gradient(rgba(128, 0, 22, 0.015) 1px, transparent 1px),
                linear-gradient(90deg, rgba(128, 0, 22, 0.015) 1px, transparent 1px);
            background-size: 24px 24px;
        }

        .brand-title {
            color: #800016;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .brand-title sup {
            color: #800016;
            font-size: 0.55em;
            top: -0.6em;
            font-weight: 600;
        }

        .brand-subtitle {
            color: #64748b;
            font-weight: 700;
            font-size: 0.75rem;
            letter-spacing: 0.08em;
        }

        .brand-divider {
            border-top: 1px solid rgba(15, 23, 42, 0.08);
        }

        .brand-credits {
            color: #64748b;
        }

        .brand-credits .credit-names {
            font-size: 0.78rem;
        }

        .brand-credits .credit-origin {
            font-size: 0.68rem;
            font-style: italic;
            opacity: 0.85;
        }

        .auth-right {
            background-color: #f8fafc;
        }

        .hero-panel {
            border: 1px solid rgba(15, 23, 42, 0.06);
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
            background-color: #ffffff;
            border-radius: 1.25rem !important;
        }

        .hero-panel h2 {
            color: #800016;
            font-weight: 800;
            letter-spacing: -0.025em;
        }
        
        .form-control {
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 0.75rem 1.15rem;
            font-size: 0.88rem;
            transition: all 0.2s ease;
        }
        
        .form-control:focus {
            border-color: #a30f36;
            box-shadow: 0 0 0 4px rgba(128, 0, 22, 0.12);
            outline: none;
        }

        .brand-btn {
            background-color: #800016;
            border-color: #800016;
            color: #ffffff;
            font-weight: 700;
            font-size: 0.88rem;
            letter-spacing: 0.04em;
            padding: 0.75rem;
            border-radius: 0.75rem;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 12px rgba(128, 0, 22, 0.15);
            text-transform: uppercase;
        }

        .brand-btn:hover {
            background-color: #4a000b;
            border-color: #4a000b;
            color: #ffffff;
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(128, 0, 22, 0.25);
        }
        
        .brand-btn:active {
            transform: translateY(0);
        }

        .footer-copy {
            color: #94a3b8;
            font-size: 0.72rem;
            font-weight: 500;
        }
    </style>
</head>

<body class="min-vh-100 bg-white text-dark">
    <div class="auth-shell container-fluid min-vh-100 d-flex p-0">
        <section class="d-none d-lg-flex col-lg-6 align-items-center justify-content-center auth-left login-grid-bg p-5">
            <div class="text-center" style="max-width: 480px; z-index: 2;">
                <img src="assets/logo.png" alt="CJC Logo" class="mx-auto d-block mb-4"
                    style="width: 11rem; height: 11rem; object-fit: contain;">
                <h1 class="display-5 brand-title mb-0">CJC-Clinic<sup>+</sup></h1>
                <p class="mt-3 text-uppercase small brand-subtitle">Clinic Patient Records System and Inventory</p>
                <div class="my-4 brand-divider"></div>
                <div class="brand-credits">
                    <div class="credit-names">Powered by</div>
                    <div class="credit-names fw-bold text-dark mb-2">Rhea Balatero &amp; John Mark Limsan</div>
                    <div class="credit-origin mt-3">
                        Originally conceived and developed by Margarilyn Zosa, Elgin Manlisig
                    </div>
                </div>
            </div>
        </section>

        <section class="d-flex flex-column align-items-center justify-content-center auth-right p-5 col-12 col-lg-6">
            <div class="auth-panel card hero-panel w-100" style="max-width: 32rem;">
                <div class="card-body p-5">
                    <div class="mb-4 text-center">
                        <h2 class="fw-bold">Sign In</h2>
                        <p class="text-secondary small mb-0">Access the clinic records &amp; management dashboard</p>
                    </div>
                    <?php if ($errorMessage): ?>
                        <div class="alert alert-danger rounded-4 py-3 px-4 mb-4 small border-0" style="background-color: #fef2f2; color: #b91c1c;">
                            <?php echo cjcEscape($errorMessage); ?></div>
                    <?php endif; ?>
                    <form method="POST">
                        <div class="mb-3">
                            <label class="form-label text-uppercase fw-bold text-secondary mb-1" style="font-size: 0.72rem; letter-spacing: 0.04em;" for="username">Username</label>
                            <input id="username" name="username" type="text" required class="form-control"
                                placeholder="Enter username">
                        </div>
                        <div class="mb-4">
                            <label class="form-label text-uppercase fw-bold text-secondary mb-1" style="font-size: 0.72rem; letter-spacing: 0.04em;" for="password">Password</label>
                            <input id="password" name="password" type="password" required class="form-control"
                                placeholder="Enter password">
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-4 small">
                            <div></div>
                            <a href="#" class="text-decoration-none fw-bold" style="color: #a30f36;">Forgot Password?</a>
                        </div>
                        <button type="submit" class="btn brand-btn w-100">SIGN IN</button>
                    </form>
                    <p class="mt-4 text-center text-secondary small" style="font-size: 0.75rem; opacity: 0.8;">Security feature: System auto-logs out after 30 minutes of inactivity.</p>
                </div>
            </div>
            <p class="footer-copy mt-4 mb-0">&copy; 2026 CJC-Clinic. All Rights Reserved.</p>
        </section>
    </div>
</body>

</html>