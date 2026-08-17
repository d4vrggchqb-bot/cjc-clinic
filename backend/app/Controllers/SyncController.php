<?php
require_once __DIR__ . '/BaseController.php';

class SyncController extends BaseController {

    /**
     * Heartbeat ping to test network connectivity and sync status
     */
    public function ping() {
        cjcRequireAuth();
        $this->jsonResponse([
            'success'   => true,
            'timestamp' => date('Y-m-d H:i:s'),
            'branch'    => $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic'
        ]);
    }

    /**
     * Process batch of offline sync transactions
     */
    public function batch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $batch = $input['batch'] ?? [];

        if (!is_array($batch) || empty($batch)) {
            $this->jsonResponse(['success' => true, 'results' => []]);
        }

        $pdo = cjcDatabaseConnection();
        $currentUser = cjcCurrentUser();
        $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        $userId = $currentUser['id'] ?? null;

        $results = [];
        $tempIdMap = []; // Maps client temp_id / uuid -> real MySQL server ID

        foreach ($batch as $item) {
            $uuid   = $item['uuid'] ?? '';
            $action = $item['action'] ?? '';
            $payload = $item['payload'] ?? [];
            $rawTimestamp = $item['timestamp'] ?? '';
            $ts = !empty($rawTimestamp) ? strtotime($rawTimestamp) : false;
            $now = time();
            // Ensure timestamp is valid and within realistic bounds (-90 days to +1 day)
            if ($ts !== false && $ts >= ($now - (90 * 86400)) && $ts <= ($now + 86400)) {
                $timestamp = date('Y-m-d H:i:s', $ts);
            } else {
                $timestamp = date('Y-m-d H:i:s', $now);
            }

            if (empty($uuid) || empty($action)) {
                $results[] = ['uuid' => $uuid, 'success' => false, 'error' => 'Invalid queue item'];
                continue;
            }

            try {
                $pdo->beginTransaction();

                if ($action === 'create_patient') {
                    $firstName = trim($payload['first_name'] ?? '');
                    $lastName  = trim($payload['last_name'] ?? '');
                    $profileType = $payload['profile_type'] ?? 'student';

                    if (empty($firstName) || empty($lastName)) {
                        throw new Exception('First and Last name are required');
                    }

                    $idNum = trim($payload['patient_id_number'] ?? '');
                    if ($profileType === 'guest' && empty($idNum)) {
                        $year = date('Y');
                        $countStmt = $pdo->query("SELECT COUNT(*) FROM profiles WHERE profile_type = 'guest'");
                        $count = (int)$countStmt->fetchColumn() + 1;
                        $idNum = sprintf('GST-%s-%05d', $year, $count);
                    }

                    // Check if already created
                    $dupStmt = $pdo->prepare("SELECT id FROM profiles WHERE (first_name = ? AND last_name = ?) OR (patient_id_number = ? AND patient_id_number IS NOT NULL AND patient_id_number != '') LIMIT 1");
                    $dupStmt->execute([$firstName, $lastName, $idNum ?: '']);
                    $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);

                    if ($existing) {
                        $serverId = $existing['id'];
                    } else {
                        $history = $payload['health_history'] ?? null;
                        if (is_array($history)) {
                            $history = json_encode($history);
                        }
                        $vitals = $payload['vital_stats'] ?? null;
                        if (is_array($vitals)) {
                            $vitals = json_encode($vitals);
                        }

                        $sql = "INSERT INTO profiles (
                                    profile_type, patient_id_number, school_year, first_name, last_name, middle_initial,
                                    birthdate, gender, height, mother_name, father_name, weight, sub_type, college_dept, year_level, course, 
                                    contact, email, address, emergency_contact_name, emergency_contact_number, 
                                    emergency_relation, blood_type, health_history, vital_stats
                                ) VALUES (
                                    :type, :id_num, :school_year, :fname, :lname, :mi,
                                    :bdate, :gender, :height, :mname, :fname_parent, :weight, :sub_type, :dept, :ylevel, :course,
                                    :contact, :email, :address, :e_name, :e_num, 
                                    :e_rel, :blood, :history, :vitals
                                )";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute([
                            'type' => $profileType,
                            'id_num' => !empty($idNum) ? $idNum : null,
                            'school_year' => $payload['school_year'] ?? null,
                            'fname' => $firstName,
                            'lname' => $lastName,
                            'mi' => $payload['middle_initial'] ?? null,
                            'bdate' => !empty($payload['birthdate']) ? $payload['birthdate'] : null,
                            'gender' => $payload['gender'] ?? null,
                            'height' => $payload['height'] ?? null,
                            'mname' => $payload['mother_name'] ?? null,
                            'fname_parent' => $payload['father_name'] ?? null,
                            'weight' => $payload['weight'] ?? null,
                            'sub_type' => $payload['sub_type'] ?? null,
                            'dept' => $payload['college_dept'] ?? null,
                            'ylevel' => $payload['year_level'] ?? null,
                            'course' => $payload['course'] ?? null,
                            'contact' => $payload['contact'] ?? null,
                            'email' => $payload['email'] ?? null,
                            'address' => $payload['address'] ?? null,
                            'e_name' => $payload['emergency_contact_name'] ?? null,
                            'e_num' => $payload['emergency_contact_number'] ?? null,
                            'e_rel' => $payload['emergency_relation'] ?? null,
                            'blood' => $payload['blood_type'] ?? null,
                            'history' => $history,
                            'vitals' => $vitals
                        ]);
                        $serverId = $pdo->lastInsertId();
                    }

                    if (isset($payload['temp_id'])) {
                        $tempIdMap[$payload['temp_id']] = $serverId;
                    }
                    $tempIdMap[$uuid] = $serverId;

                    $pdo->commit();
                    $results[] = ['uuid' => $uuid, 'success' => true, 'server_id' => $serverId];

                } elseif ($action === 'create_consultation') {
                    $profileId = $payload['profile_id'] ?? null;
                    if (isset($tempIdMap[$profileId])) {
                        $profileId = $tempIdMap[$profileId];
                    }

                    $purpose = trim($payload['purpose'] ?? '');
                    if (!$profileId || empty($purpose)) {
                        throw new Exception('Profile ID and purpose required');
                    }

                    $attendedBy = $currentUser['name'] ?? 'Clinic Staff';
                    $stmt = $pdo->prepare(
                        'INSERT INTO consultations (profile_id, purpose, status, attended_by, clinic_branch, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)'
                    );
                    $stmt->execute([
                        $profileId,
                        $purpose,
                        $payload['status'] ?? 'waiting',
                        $attendedBy,
                        $branch,
                        $timestamp
                    ]);
                    $serverId = $pdo->lastInsertId();

                    $pdo->commit();
                    $results[] = ['uuid' => $uuid, 'success' => true, 'server_id' => $serverId];

                } elseif ($action === 'create_borrowing') {
                    $profileId = $payload['profile_id'] ?? null;
                    if (isset($tempIdMap[$profileId])) {
                        $profileId = $tempIdMap[$profileId];
                    }

                    $purpose = $payload['purpose'] ?? '';
                    $expectedReturnDate = !empty($payload['expected_return_date']) ? $payload['expected_return_date'] : null;
                    $items = $payload['items'] ?? [];

                    if (!$profileId || empty($items)) {
                        throw new Exception('Profile ID and items required');
                    }

                    $releasedBy = $userId;
                    $stmt = $pdo->prepare("INSERT INTO borrowings (profile_id, purpose, expected_return_date, released_by, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)");
                    $stmt->execute([$profileId, $purpose, $expectedReturnDate, $releasedBy, $timestamp]);
                    $borrowingId = $pdo->lastInsertId();

                    $bookingCode = 'EQ-' . date('Y') . '-' . str_pad($borrowingId, 5, '0', STR_PAD_LEFT);
                    $pdo->prepare("UPDATE borrowings SET booking_code = ? WHERE id = ?")->execute([$bookingCode, $borrowingId]);

                    foreach ($items as $item) {
                        $itemId   = $item['inventory_item_id'];
                        $quantity = (int)$item['quantity'];
                        $type     = $item['item_type'];
                        $itemBranch = $item['branch'] ?? $branch;

                        $status = 'borrowed';
                        $stockReserved = ($type === 'equipment') ? 1 : 0;

                        // Deduct stock
                        $batchStmt = $pdo->prepare("
                            SELECT id, stock_remaining
                            FROM inventory_batches
                            WHERE item_id = :item_id AND stock_remaining > 0
                              AND (expired_on >= CURDATE() OR expired_on IS NULL)
                            ORDER BY (clinic_branch = :branch) DESC, expired_on ASC, date_arrived ASC
                        ");
                        $batchStmt->execute(['item_id' => $itemId, 'branch' => $itemBranch]);
                        $batches = $batchStmt->fetchAll();

                        $remainingToDeduct = $quantity;
                        foreach ($batches as $b) {
                            if ($remainingToDeduct <= 0) break;
                            $available = (int)$b['stock_remaining'];
                            $consumed  = min($available, $remainingToDeduct);
                            $newStock  = $available - $consumed;

                            $pdo->prepare("UPDATE inventory_batches SET stock_remaining = :stock, status = IF(:stock2=0,'depleted','active') WHERE id = :id")
                                ->execute(['stock' => $newStock, 'stock2' => $newStock, 'id' => $b['id']]);

                            $logNote = ($type === 'supply') ? 'Supply Checked Out (Synced)' : 'Equipment Checked Out (Synced)';
                            $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by, created_at) VALUES (?, 'dispense', ?, ?, ?, ?, ?)")
                                ->execute([$b['id'], -$consumed, $logNote, $profileId, $userId, $timestamp]);

                            $remainingToDeduct -= $consumed;
                        }

                        $pdo->prepare("INSERT INTO borrowed_items (borrowing_id, inventory_item_id, quantity, item_type, status, stock_reserved) VALUES (?, ?, ?, ?, ?, ?)")
                            ->execute([$borrowingId, $itemId, $quantity, $type, $status, $stockReserved]);
                    }

                    $pdo->commit();
                    $results[] = ['uuid' => $uuid, 'success' => true, 'server_id' => $borrowingId, 'booking_code' => $bookingCode];

                } elseif ($action === 'return_borrowing') {
                    $borrowingId = $payload['borrowing_id'] ?? null;
                    $items       = $payload['items'] ?? [];
                    $globalNotes = $payload['notes'] ?? null;

                    if (!$borrowingId || empty($items)) {
                        throw new Exception('Borrowing ID and items required');
                    }

                    foreach ($items as $item) {
                        $biId        = $item['borrowed_item_id'];
                        $qtyReturned = max(0, (int)($item['quantity_returned'] ?? 0));
                        $qtyConsumed = max(0, (int)($item['quantity_consumed'] ?? 0));
                        $itemNotes   = $item['notes'] ?? $globalNotes;

                        $biStmt = $pdo->prepare("
                            SELECT bi.*, b.profile_id, i.id AS inventory_item_id
                            FROM borrowed_items bi
                            JOIN borrowings b ON bi.borrowing_id = b.id
                            JOIN inventory_items i ON bi.inventory_item_id = i.id
                            WHERE bi.id = ?
                        ");
                        $biStmt->execute([$biId]);
                        $bi = $biStmt->fetch(PDO::FETCH_ASSOC);

                        if (!$bi || $bi['status'] === 'returned') continue;

                        $itemType    = $bi['item_type'];
                        $inventoryId = $bi['inventory_item_id'];
                        $profileId   = $bi['profile_id'];

                        if ($qtyReturned > 0) {
                            $batchStmt = $pdo->prepare("
                                SELECT id FROM inventory_batches
                                WHERE item_id = ?
                                ORDER BY (clinic_branch = ?) DESC, status = 'active' DESC, date_arrived DESC, id DESC LIMIT 1
                            ");
                            $batchStmt->execute([$inventoryId, $branch]);
                            $restoreBatch = $batchStmt->fetch(PDO::FETCH_ASSOC);

                            if (!$restoreBatch) {
                                $createBatch = $pdo->prepare("INSERT INTO inventory_batches (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, status) VALUES (?, ?, ?, 0, CURDATE(), 'active')");
                                $createBatch->execute([$inventoryId, $branch, 'RET-' . date('Ymd')]);
                                $restoreBatch = ['id' => $pdo->lastInsertId()];
                            }

                            if ($restoreBatch) {
                                $pdo->prepare("UPDATE inventory_batches SET stock_remaining = stock_remaining + ?, status = 'active' WHERE id = ?")
                                    ->execute([$qtyReturned, $restoreBatch['id']]);

                                $logMsg = ucfirst($itemType) . " Returned from Borrowing (Synced)";
                                $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by, created_at) VALUES (?, 'restock', ?, ?, ?, ?, ?)")
                                    ->execute([$restoreBatch['id'], $qtyReturned, $logMsg, $profileId, $userId, $timestamp]);
                            }
                        }

                        $pdo->prepare("INSERT INTO borrowed_item_returns (borrowed_item_id, quantity_returned, quantity_consumed, notes, processed_by, returned_at) VALUES (?, ?, ?, ?, ?, ?)")
                            ->execute([$biId, $qtyReturned, $qtyConsumed, $itemNotes, $userId, $timestamp]);

                        $pdo->prepare("UPDATE borrowed_items SET status = 'returned' WHERE id = ?")->execute([$biId]);
                    }

                    $pendingStmt = $pdo->prepare("SELECT COUNT(*) FROM borrowed_items WHERE borrowing_id = ? AND status = 'borrowed'");
                    $pendingStmt->execute([$borrowingId]);
                    $pendingCount = (int)$pendingStmt->fetchColumn();

                    if ($pendingCount === 0) {
                        $pdo->prepare("UPDATE borrowings SET status = 'returned', returned_at = ? WHERE id = ?")->execute([$timestamp, $borrowingId]);
                    }

                    $pdo->commit();
                    $results[] = ['uuid' => $uuid, 'success' => true];
                } else {
                    throw new Exception("Unknown action: {$action}");
                }
            } catch (Exception $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log('[CJC-SYNC] Error processing item ' . $uuid . ': ' . $e->getMessage());
                $results[] = ['uuid' => $uuid, 'success' => false, 'error' => $e->getMessage()];
            }
        }

        $this->jsonResponse([
            'success' => true,
            'results' => $results,
            'synced_at' => date('Y-m-d H:i:s')
        ]);
    }
}
