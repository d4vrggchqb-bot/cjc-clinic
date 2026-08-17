<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

abstract class BaseController {
    /**
     * Send standard JSON response and exit
     */
    protected function jsonResponse($data, int $status = 200): void {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    /**
     * Parse incoming JSON body or fallback to $_POST
     */
    protected function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
        return $_POST ?? [];
    }

    /**
     * Get currently authenticated user from session
     */
    protected function getCurrentUser(): ?array {
        return cjcCurrentUser();
    }

    /**
     * Get current user's clinic branch (guaranteed non-empty)
     */
    protected function getUserBranch(): string {
        $user = $this->getCurrentUser();
        $branch = trim($user['clinic_branch'] ?? '');
        return !empty($branch) ? $branch : 'College Clinic';
    }
}
