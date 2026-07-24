<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../app/Controllers/AuthController.php';
require_once __DIR__ . '/../../app/Controllers/PatientController.php';
require_once __DIR__ . '/../../app/Controllers/InventoryController.php';
require_once __DIR__ . '/../../app/Controllers/ConsultationController.php';
require_once __DIR__ . '/../../app/Controllers/MedcertController.php';
require_once __DIR__ . '/../../app/Controllers/DashboardController.php';
require_once __DIR__ . '/../../app/Controllers/AppointmentController.php';
require_once __DIR__ . '/../../app/Controllers/ReportController.php';

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
        } elseif ($action === 'request_password_reset') {
            $controller->requestPasswordReset();
        } elseif ($action === 'perform_password_reset') {
            $controller->performPasswordReset();
        } elseif ($action === 'google_login') {
            $controller->googleLogin();
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
        } elseif ($action === 'check_id') {
            $controller->checkId();
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
        } elseif ($action === 'low_stock') {
            $controller->getLowStock();
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
        } elseif ($action === 'saveNotes') {
            $controller->saveNotes();
        } elseif ($action === 'history') {
            $controller->history();
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
        } elseif ($action === 'bulkCreate') {
            $controller->bulkCreate();
        } elseif ($action === 'update') {
            $controller->update();
        } elseif ($action === 'updateDetails') {
            $controller->updateDetails();
        }
        break;

    case 'reports':
        $controller = new ReportController();
        if ($action === 'generate') {
            $controller->generateReport();
        }
        break;

    case 'borrowings':
        require_once __DIR__ . '/../../app/Controllers/BorrowingController.php';
        $controller = new BorrowingController();
        if ($action === 'submit') {
            $controller->submitForm();
        } elseif ($action === 'profile_history') {
            $controller->getProfileBorrowings();
        } elseif ($action === 'checked_out') {
            $controller->getCheckedOutEquipment();
        } elseif ($action === 'recent_history') {
            $controller->getRecentHistory();
        } elseif ($action === 'return_item') {
            $controller->returnEquipment();
        }
        break;
}

// Fallback 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'API Route or Action Not Found']);
