// ─── Patient profile ──────────────────────────────────────────────────────────
export interface Profile {
  id: number;
  profile_type: 'student' | 'employee' | 'guest';
  patient_id_number?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  middle_initial?: string;
  birthdate?: string;
  gender?: string;
  contact: string;
  program_department: string;
  college_dept?: string;
  year_level?: string;
  course?: string;
  blood_type: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  emergency_relation?: string;
  health_history?: string;
  vital_stats?: string;
  created_at?: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: number;
  category: 'medicine' | 'supply' | 'equipment' | string;
  brand_name: string;
  generic_name: string;
  dosage?: string;
  formulation?: string;
  unit_of_measure?: string;
  alert_threshold: number;
  overall_stock?: number;
  date_acquired?: string;
  date_purchased?: string;
  last_calibrated?: string;
  calibration_due?: string;
  calibration_notes?: string;
  created_at?: string;
}

export interface InventoryBatch {
  id: number;
  item_id: number;
  clinic_branch: string;
  batch_number: string;
  stock_remaining: number;
  initial_stock?: number;
  dispensed_qty?: number;
  disposed_qty?: number;
  date_arrived: string;
  expired_on: string;
  status: 'active' | 'low-stock' | 'expired' | 'depleted' | string;
  last_calibrated?: string;
  calibration_due?: string;
  calibration_notes?: string;
}

export interface Medicine {
  id: number;
  category: 'medicine' | 'supply' | 'equipment';
  brand_name: string;
  generic_name: string | null;
  stock: number;
  expired_on: string | null;
  status: string;
}

// ─── Timeline / Purchase Orders ───────────────────────────────────────────────
export interface RequestTimeline {
  id: number;
  item_name: string;
  requested_date: string;
  transit_status: string;
  delivery_date: string | null;
  manifest_details: string | null;
}

// ─── Authentication ───────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  name: string;
  role: 'Superadmin' | 'Admin' | 'Staff' | string;
  clinic_branch?: string;
}

// ─── Inventory metrics (from api/inventory.php) ───────────────────────────────
export interface InventoryMetrics {
  low_stock: number;
  expired: number;
  total_items: number;
  active_consultations?: number;
  today_visits?: number;
  medcert_count?: number;
}

// ─── Pagination metadata ───────────────────────────────────────────────────────
export interface Pagination {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

// ─── Consultation / Visitation ────────────────────────────────────────────────
export interface ConsultationSession {
  id: number;
  profile_id?: number;
  patient_name: string;
  complaint: string;
  diagnosis?: string;
  treatment?: string;
  assigned_to: string;
  status: 'active' | 'in-progress' | 'waiting' | 'pending' | 'completed' | string;
  clinic_branch?: string;
  time_in?: string;
  time_out?: string;
  created_at: string;
}

export interface VisitRecord {
  id: number;
  patient_name: string;
  complaint: string;
  assigned_to: string;
  department: string;
  status: string;
  created_at: string;
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export interface AppointmentRecord {
  id: number;
  profile_id: number;
  appointment_code?: string;
  patient_name?: string;
  appointment_date: string;
  appointment_time: string;
  purpose: string;
  clinic_branch: string;
  group_name?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show' | string;
  created_at?: string;
}

// ─── Equipment Borrowing ──────────────────────────────────────────────────────
export interface BorrowingRecord {
  id: number;
  booking_code?: string;
  profile_id: number;
  borrower_name?: string;
  purpose: string;
  status: 'pending' | 'active' | 'returned' | 'cancelled' | string;
  clinic_branch?: string;
  borrowed_at?: string;
  returned_at?: string | null;
  items?: Array<{
    id: number;
    item_id: number;
    generic_name?: string;
    quantity: number;
    returned_quantity?: number;
  }>;
}

// ─── Medical Certificates ─────────────────────────────────────────────────────
export interface MedcertRecord {
  id: number;
  profile_id: number;
  patient_name: string;
  issued_to: string;
  diagnosis: string;
  recommendation: string;
  valid_until: string | null;
  issued_by: string;
  qr_code_url?: string;
  created_at: string;
}
