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
    <link rel="stylesheet" href="dist/app.css">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="min-h-screen bg-slate-100 text-slate-900">
    <div class="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
        <section class="flex items-center justify-center bg-white px-6 py-12">
            <div class="max-w-lg text-center">
                <img src="assets/logo.png" alt="CJC Logo" class="mx-auto w-48 h-48 object-contain">
                <h1 class="mt-8 text-4xl font-extrabold tracking-tight text-[#f44b38]">CJC-Clinic+</h1>
                <p class="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Clinic Patient Records System and Inventory</p>
                <div class="mt-10 h-px w-28 bg-slate-200 mx-auto"></div>
                <p class="mt-6 text-xs text-slate-500">A polished, responsive prototype for secure student and staff clinic interactions.</p>
            </div>
        </section>

        <section class="flex items-center justify-center bg-slate-50 px-6 py-12">
            <div class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-9 shadow-sm">
                <div class="mb-8 text-center">
                    <h2 class="text-3xl font-semibold text-slate-900">Sign In</h2>
                    <p class="mt-2 text-sm text-slate-500">Access your patient information</p>
                </div>
                <?php if ($errorMessage): ?>
                    <div class="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><?php echo cjcEscape($errorMessage); ?></div>
                <?php endif; ?>
                <form method="POST" class="space-y-6">
                    <div>
                        <label class="mb-2 block text-sm font-medium text-slate-600" for="username">Username</label>
                        <input id="username" name="username" type="text" required class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" placeholder="Enter username">
                    </div>
                    <div>
                        <label class="mb-2 block text-sm font-medium text-slate-600" for="password">Password</label>
                        <input id="password" name="password" type="password" required class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" placeholder="Enter password">
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <div></div>
                        <a href="#" class="text-sm font-medium text-[#f44b38] hover:text-[#d93c2d]">Forgot Password?</a>
                    </div>
                    <button type="submit" class="mt-2 w-full rounded-2xl bg-[#f44b38] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d03c2f]">SIGN IN</button>
                </form>
                <p class="mt-8 text-center text-xs text-slate-400">Security feature: System auto-logs out after 30 minutes of inactivity.</p>
            </div>
        </section>
    </div>
</body>
</html>
