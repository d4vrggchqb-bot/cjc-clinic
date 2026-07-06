export interface Profile {
  id: number;
  profile_type: 'student' | 'employee';
  name: string;
  contact: string;
  program_department: string;
  blood_type: string;
  health_history: string;
  vital_stats: string;
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

export interface RequestTimeline {
  id: number;
  item_name: string;
  requested_date: string;
  transit_status: 'pending' | 'in transit' | 'delivered';
  delivery_date: string | null;
  manifest_details: string | null;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export interface InventoryMetrics {
  low_stock: number;
  expired: number;
  total_items: number;
  active_consultations?: number;
  today_visits?: number;
  medcert_count?: number;
}
