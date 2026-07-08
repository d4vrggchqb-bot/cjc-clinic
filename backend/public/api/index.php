<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../app/Controllers/AuthController.php';
require_once __DIR__ . '/../../app/Controllers/PatientController.php';
require_once __DIR__ . '/../../app/Controllers/InventoryController.php';
require_once __DIR__ . '/../../app/Controllers/ConsultationController.php';
require_once __DIR__ . '/../../app/Controllers/MedcertController.php';
require_once __DIR__ . '/../../app/Controllers/VisitationController.php';
require_once __DIR__ . '/../../app/Controllers/DashboardController.php';

// Parse route and action
// Examples:
// /api/index.php?action=login (Auth is default)
// /api/index.php?route=patients&action=list
$route  = $_GET['route'] ?? 'auth';
$action = $_GET['action'] ?? 'list';

switch ($route) {
    case 'auth':
        $controller = new AuthController();
        if ($action === 'login') {
            $controller->login();
        } elseif ($action === 'logout') {
            $controller->logout();
        } elseif ($action === 'check_session') {
            $controller->checkSession();
        }
        break;

    case 'patients':
        $controller = new PatientController();
        if ($action === 'list') {
            $controller->list();
        } elseif ($action === 'upload') {
            $controller->upload();
        } elseif ($action === 'create') {
            $controller->create();
        } elseif ($action === 'update') {
            $controller->update();
        } elseif ($action === 'get') {
            $controller->get();
        }
        break;

    case 'inventory':
        $controller = new InventoryController();
        if ($action === 'list') {
            $controller->list();
        } elseif ($action === 'dispense') {
            $controller->dispense();
        }
        break;

    case 'consultations':
        $controller = new ConsultationController();
        if ($action === 'list') {
            $controller->list();
        } elseif ($action === 'create') {
            $controller->create();
        }
        break;

    case 'medcert':
        $controller = new MedcertController();
        if ($action === 'generate') {
            $controller->generate();
        }
        break;

    case 'visitation':
        $controller = new VisitationController();
        if ($action === 'list') {
            $controller->list();
        }
        break;

    case 'dashboard':
        $controller = new DashboardController();
        if ($action === 'stats') {
            $controller->stats();
        }
        break;
}

// Fallback 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'API Route or Action Not Found']);
