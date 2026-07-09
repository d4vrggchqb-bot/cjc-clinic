<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../app/Controllers/AuthController.php';
require_once __DIR__ . '/../../app/Controllers/PatientController.php';
require_once __DIR__ . '/../../app/Controllers/InventoryController.php';
require_once __DIR__ . '/../../app/Controllers/ConsultationController.php';
require_once __DIR__ . '/../../app/Controllers/MedcertController.php';
require_once __DIR__ . '/../../app/Controllers/VisitationController.php';
require_once __DIR__ . '/../../app/Controllers/DashboardController.php';
require_once __DIR__ . '/../../app/Controllers/AppointmentController.php';

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
        } elseif ($action === 'users') {
            $controller->getUsers();
        } elseif ($action === 'create_user') {
            $controller->createUser();
        } elseif ($action === 'delete_user') {
            $controller->deleteUser();
        } elseif ($action === 'reset_password') {
            $controller->resetPassword();
        } elseif ($action === 'change_password') {
            $controller->changePassword();
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
        if ($action === 'items') {
            $controller->getItems();
        } elseif ($action === 'add_item') {
            $controller->addItem();
        } elseif ($action === 'batches') {
            $controller->getBatches();
        } elseif ($action === 'add_batch') {
            $controller->addBatch();
        } elseif ($action === 'dispense') {
            $controller->dispense();
        } elseif ($action === 'purchases') {
            $controller->getPurchases();
        } elseif ($action === 'add_purchase') {
            $controller->addPurchase();
        } elseif ($action === 'update_purchase') {
            $controller->updatePurchase();
        } elseif ($action === 'logs') {
            $controller->getLogs();
        } elseif ($action === 'edit_batch') {
            $controller->editBatch();
        } elseif ($action === 'get_next_batch') {
            $controller->getNextBatchNumber();
        }
        break;

    case 'consultations':
        $controller = new ConsultationController();
        if ($action === 'list') {
            $controller->list();
        } elseif ($action === 'create') {
            $controller->create();
        } elseif ($action === 'update') {
            $controller->update();
        } elseif ($action === 'checkoutAll') {
            $controller->checkoutAll();
        }
        break;

    case 'settings':
        require_once __DIR__ . '/../../app/Controllers/SettingsController.php';
        $controller = new SettingsController();
        if ($action === 'get') {
            $controller->getSettings();
        } elseif ($action === 'update') {
            $controller->updateSettings();
        } elseif ($action === 'import') {
            $controller->importCSV();
        } elseif ($action === 'backup_db') {
            $controller->backupDatabase();
        } elseif ($action === 'export_health') {
            $controller->exportHealthRecords();
        } elseif ($action === 'export_visits') {
            $controller->exportVisitLog();
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

    case 'appointments':
        $controller = new AppointmentController();
        if ($action === 'list') {
            $controller->list();
        } elseif ($action === 'create') {
            $controller->create();
        } elseif ($action === 'update') {
            $controller->update();
        }
        break;
}

// Fallback 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'API Route or Action Not Found']);
