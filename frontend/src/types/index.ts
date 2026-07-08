// ─── Patient profile ──────────────────────────────────────────────────────────
// Note: health_history and vital_stats are PHI — they are intentionally omitted
// from the list API and therefore excluded from this type. Use a dedicated
// detail endpoint (with role-gating) if those fields are ever needed in the UI.
export interface Profile {
  id: number;
  profile_type: 'student' | 'employee';
  name: string;
  contact: string;
  program_department: string;
  blood_type: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface Medicine {
  id: number;
  category: 'medicine' | 'supply' | 'equipment';
  brand_name: string;
  generic_name: string | null;
  stock: number;
  expired_on: string | null;  // ISO date string or null
  status: string;             // open-ended: 'active', 'low-stock', 'expired', etc.
}

// transit_status is open-ended — the PHP side may store custom strings
export interface RequestTimeline {
  id: number;
  item_name: string;
  requested_date: string;     // ISO date string
  transit_status: string;     // e.g. 'pending', 'in transit', 'delivered', custom values
  delivery_date: string | null;
  manifest_details: string | null;
}

// ─── Authentication ───────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
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

// ─── Pagination metadata (returned by patients, inventory, visitation APIs) ───
export interface Pagination {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

// ─── Consultation / visitation ────────────────────────────────────────────────
export interface ConsultationSession {
  id: number;
  patient_name: string;   // COALESCE'd from profiles.name on the API side
  complaint: string;
  assigned_to: string;
  status: string;         // 'active' | 'in-progress' | 'waiting' | 'pending'
  created_at: string;     // ISO datetime string
}

export interface VisitRecord {
  id: number;
  patient_name: string;
  complaint: string;
  assigned_to: string;
  department: string;
  status: string;
  created_at: string;     // ISO datetime string
}
