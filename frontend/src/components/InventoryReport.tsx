import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { useBranch } from '../context/BranchContext';
import { 
  FiSearch, 
  FiFilter, 
  FiDownload, 
  FiPrinter, 
  FiCalendar, 
  FiLock, 
  FiRefreshCw, 
  FiEye, 
  FiX, 
  FiAlertTriangle, 
  FiCheckCircle, 
  FiBox, 
  FiArchive, 
  FiFileText,
  FiChevronDown,
  FiChevronRight
} from 'react-icons/fi';

export interface InventoryItemReport {
  id: number;
  category: 'medicine' | 'supply' | 'equipment';
  generic_name: string;
  brand_name: string | null;
  dosage: string | null;
  formulation: string | null;
  unit: string;
  serial_no: string | null;
  model_no: string | null;
  supplier: string | null;
  alert_threshold: number;
  drawer_stock: number;
  main_stock: number;
  total_stock: number;
  earliest_expiry: string | null;
  computed_status: string;
  status_label: string;
  date_purchased: string | null;
  date_acquired: string | null;
  last_calibrated: string | null;
  calibration_due: string | null;
  calibration_notes: string | null;
  batches?: any[];
  item_no: number;
}

export interface BatchFlatReport {
  item_no: number;
  item_id: number;
  batch_id: number | null;
  medicine_name: string;
  generic_name: string;
  brand_name: string | null;
  dosage: string;
  formulation: string;
  category: string;
  quantity: number;
  unit: string;
  quantity_str: string;
  drawer_stock: number;
  main_stock: number;
  batch_number: string;
  lot_number: string;
  expiry_date: string;
  expiry_date_full: string | null;
  date_arrived: string | null;
  status: string;
  remarks: string;
  branch: string;
}

export interface EquipmentFlatReport {
  item_no: number;
  item_id: number;
  description: string;
  qty: number;
  unit: string;
  brand: string;
  model_no: string;
  serial_no: string;
  supplier: string;
  date_purchased: string;
  remarks: string;
  last_calibrated: string | null;
  calibration_due: string | null;
  branch: string;
}

const InventoryReport: React.FC = () => {
  const { userBranch, isSuperAdmin, selectedBranch, setSelectedBranch, availableBranches, currentUser, currentUserName } = useBranch();

  // Branch Scoping:
  // Non-superadmins are strictly restricted to their assigned branch.
  const effectiveBranch = isSuperAdmin 
    ? (selectedBranch === 'All Branches' ? 'all' : (selectedBranch || userBranch || 'all')) 
    : (userBranch || 'College Clinic');

  // Report View Mode:
  // 1. 'medicines' = Form SCR-9.5 College Clinic Medicine/Supplies Inventory Register
  // 2. 'equipment' = Inventory of Equipment/Apparatus Tools and Materials
  // 3. 'all' = Master Inventory Catalog
  const [reportMode, setReportMode] = useState<'medicines' | 'equipment' | 'all'>('medicines');

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [semester, setSemester] = useState<string>('all');
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Data states
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InventoryItemReport[]>([]);
  const [batchesFlat, setBatchesFlat] = useState<BatchFlatReport[]>([]);
  const [equipmentFlat, setEquipmentFlat] = useState<EquipmentFlatReport[]>([]);
  const [summary, setSummary] = useState({
    total_items: 0,
    total_drawer_stock: 0,
    total_main_stock: 0,
    total_stock: 0,
    expiring_count: 0,
    expired_count: 0,
    drawer_low_count: 0,
  });
  const [meta, setMeta] = useState<any>(null);

  // Table expand state for item-level view
  const [expandedItemIds, setExpandedItemIds] = useState<Record<number, boolean>>({});

  // Printable PDF Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Resolve current user for "Prepared by"
  const initialUserName = useMemo(() => {
    if (currentUserName) return currentUserName;
    try {
      const raw = localStorage.getItem('cjc_cached_session_user');
      if (raw) {
        const u = JSON.parse(raw);
        return u?.name || u?.username || '';
      }
    } catch {}
    return '';
  }, [currentUserName]);

  const initialUserTitle = useMemo(() => {
    const role = currentUser?.role;
    if (role === 'Admin' || role === 'Superadmin') return 'Clinic Administrator / In-Charge';
    if (role === 'Nurse') return 'Clinic Nurse / In-Charge';
    if (role === 'Staff') return 'Clinic Staff / In-Charge';
    return 'Clinic In-Charge';
  }, [currentUser]);

  // Custom Signatories for printable documents
  // "prepared by": Current logged-in user
  // "noted by": Physician configured in Settings
  const [preparedByName, setPreparedByName] = useState<string>(initialUserName);
  const [preparedByTitle, setPreparedByTitle] = useState<string>(initialUserTitle);
  const [notedByName, setNotedByName] = useState<string>('');
  const [notedByTitle, setNotedByTitle] = useState<string>('School Physician');

  // Keep preparedByName in sync if user loads asynchronously
  useEffect(() => {
    if (initialUserName && !preparedByName) {
      setPreparedByName(initialUserName);
    }
  }, [initialUserName]);

  // Load Settings to fetch the School Physician configured in Settings > Medical Personnel
  useEffect(() => {
    apiFetch('/api/index.php?route=settings&action=get')
      .then((res: any) => {
        if (res && res.settings && Array.isArray(res.settings.medcert_personnel)) {
          const personnel = res.settings.medcert_personnel;
          if (personnel.length > 0) {
            const physician = personnel.find((p: any) =>
              (p.position && /physician|doctor|md/i.test(p.position)) ||
              (p.name && /md|dr\./i.test(p.name))
            ) || personnel[0];

            if (physician && physician.name) {
              setNotedByName(physician.name);
              if (physician.position) {
                setNotedByTitle(physician.position);
              }
            }
          }
        }
      })
      .catch((err) => console.warn('Could not load settings physician:', err));
  }, []);

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('branch', effectiveBranch);

      // Map reportMode to category parameter if not in 'all' mode
      if (reportMode === 'medicines') {
        params.append('category', category === 'equipment' ? 'all' : (category !== 'all' ? category : 'medicine'));
      } else if (reportMode === 'equipment') {
        params.append('category', 'equipment');
      } else {
        if (category !== 'all') params.append('category', category);
      }

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (semester !== 'all') params.append('semester', semester);
      if (schoolYear !== 'all') params.append('school_year', schoolYear);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (search.trim()) params.append('search', search.trim());

      const res = await apiFetch(`api/index.php?route=inventory&action=inventory_report&${params.toString()}`);
      if (res && res.success) {
        setItems(res.items || []);
        setBatchesFlat(res.batches_flat || []);
        setEquipmentFlat(res.equipment_flat || []);
        setSummary(res.summary || {
          total_items: 0,
          total_drawer_stock: 0,
          total_main_stock: 0,
          total_stock: 0,
          expiring_count: 0,
          expired_count: 0,
          drawer_low_count: 0,
        });
        setMeta(res.meta || {});

        if (res.meta) {
          if (!preparedByName && res.meta.current_user_name) {
            setPreparedByName(res.meta.current_user_name);
          }
          if (res.meta.current_user_role && preparedByTitle === 'Clinic In-Charge') {
            const r = res.meta.current_user_role;
            setPreparedByTitle(r === 'Admin' || r === 'Superadmin' ? 'Clinic Administrator / In-Charge' : `Clinic ${r} / In-Charge`);
          }
          if (!notedByName && res.meta.physician_name) {
            setNotedByName(res.meta.physician_name);
            if (res.meta.physician_title) {
              setNotedByTitle(res.meta.physician_title);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load inventory report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [effectiveBranch, reportMode, category, statusFilter, semester, schoolYear, startDate, endDate]);

  // Quick Date Preset Helpers
  // Cor Jesu College Academic Calendar:
  // 1st Semester: August 1 to December 31
  // 2nd Semester: January 1 to May 31
  // Summer Term: June 1 to July 31
  // School Year: August 1 to July 31
  const applyDatePreset = (preset: 'month' | 'sem1' | 'sem2' | 'summer' | 'sy' | 'all') => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();

    // S.Y. base start year: if August-December, S.Y. starts in currentYear; if Jan-July, S.Y. started in previous year
    const syStartYear = currentMonth >= 8 ? currentYear : currentYear - 1;
    const syEndYear = syStartYear + 1;
    const syString = `${syStartYear}-${syEndYear}`;

    if (preset === 'month') {
      const start = new Date(currentYear, today.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(currentYear, today.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'sem1') {
      // 1st Semester: August 1 to December 31
      setStartDate(`${syStartYear}-08-01`);
      setEndDate(`${syStartYear}-12-31`);
      setSemester('1st Semester');
      setSchoolYear(syString);
    } else if (preset === 'sem2') {
      // 2nd Semester: January 1 to May 31
      setStartDate(`${syEndYear}-01-01`);
      setEndDate(`${syEndYear}-05-31`);
      setSemester('2nd Semester');
      setSchoolYear(syString);
    } else if (preset === 'summer') {
      // Summer: June 1 to July 31
      setStartDate(`${syEndYear}-06-01`);
      setEndDate(`${syEndYear}-07-31`);
      setSemester('Summer');
      setSchoolYear(syString);
    } else if (preset === 'sy') {
      // Full School Year: August 1 to July 31
      setStartDate(`${syStartYear}-08-01`);
      setEndDate(`${syEndYear}-07-31`);
      setSchoolYear(syString);
      setSemester('all');
    } else {
      setStartDate('');
      setEndDate('');
      setSemester('all');
    }
  };

  const toggleItemExpand = (id: number) => {
    setExpandedItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Export to Excel (.csv) with UTF-8 BOM
  const handleExportExcel = () => {
    const branchLabel = effectiveBranch === 'all' ? 'All_Branches' : effectiveBranch.replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];

    if (reportMode === 'equipment') {
      if (equipmentFlat.length === 0) {
        alert('No equipment data available to export for the current filters.');
        return;
      }

      const headers = [
        'Item No.',
        'Description',
        'Quantity',
        'Unit',
        'Brand',
        'Model No.',
        'Serial No.',
        'Supplier',
        'Date Purchased / Fabricated',
        'Remarks',
        'Clinic Branch'
      ];

      const rows = equipmentFlat.map((item, idx) => [
        idx + 1,
        `"${item.description.replace(/"/g, '""')}"`,
        item.qty,
        `"${item.unit}"`,
        `"${item.brand.replace(/"/g, '""')}"`,
        `"${item.model_no.replace(/"/g, '""')}"`,
        `"${item.serial_no.replace(/"/g, '""')}"`,
        `"${item.supplier.replace(/"/g, '""')}"`,
        `"${item.date_purchased}"`,
        `"${item.remarks.replace(/"/g, '""')}"`,
        `"${item.branch}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CJC_Clinic_Equipment_Inventory_${branchLabel}_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Default / Medicines Register SCR-9.5 format
    if (batchesFlat.length === 0 && items.length === 0) {
      alert('No medicine/supplies data available to export for the current filters.');
      return;
    }

    const headers = [
      'Item No.',
      'Medicine / Item Name',
      'Category',
      'Dosage / Strength',
      'Drawer Stock',
      'Main Stock',
      'Total Remaining',
      'Unit',
      'Lot / Batch Number',
      'Expiry Date',
      'Remarks',
      'Clinic Branch'
    ];

    const rows = batchesFlat.map((b, idx) => [
      idx + 1,
      `"${b.medicine_name.replace(/"/g, '""')}"`,
      `"${b.category}"`,
      `"${b.dosage || ''}"`,
      b.drawer_stock,
      b.main_stock,
      b.quantity,
      `"${b.unit}"`,
      `"${b.lot_number}"`,
      `"${b.expiry_date}"`,
      `"${b.remarks.replace(/"/g, '""')}"`,
      `"${b.branch}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CJC_Clinic_SCR9.5_Medicine_Register_${branchLabel}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 overflow-y-auto">
      
      {/* 1. Register Mode Switcher Header */}
      <div className="bg-white border-b border-slate-200 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A5192D]/10 text-[#A5192D] flex items-center justify-center font-bold flex-shrink-0">
            <FiFileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Official Inventory Registers & Reports
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cor Jesu College Clinical Documentation Standards • SCR-9.5 & Equipment Registers
            </p>
          </div>
        </div>

        {/* Segmented Mode Selector */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 text-sm font-semibold gap-1">
          <button
            type="button"
            onClick={() => { setReportMode('medicines'); setCategory('medicine'); }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              reportMode === 'medicines'
                ? 'bg-white text-[#A5192D] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>💊</span> Medicines & Supplies (SCR-9.5)
          </button>
          <button
            type="button"
            onClick={() => { setReportMode('equipment'); setCategory('equipment'); }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              reportMode === 'equipment'
                ? 'bg-white text-[#A5192D] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>🔬</span> Equipment & Apparatus
          </button>
          <button
            type="button"
            onClick={() => { setReportMode('all'); setCategory('all'); }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              reportMode === 'all'
                ? 'bg-white text-[#A5192D] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>📋</span> Master Catalog
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white border-b border-slate-200 px-5 py-4 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                placeholder={reportMode === 'equipment' ? "Search equipment, brand, model, serial..." : "Search generic name, brand, lot..."}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-lg text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Branch Scoping Control */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Branch</label>
            {!isSuperAdmin ? (
              <div 
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-100/90 border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold cursor-not-allowed select-none"
                title="Branch is strictly locked to your assigned clinic location"
              >
                <FiLock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="truncate">{userBranch || 'College Clinic'}</span>
              </div>
            ) : (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D]"
              >
                {Array.from(new Set(['All Branches', ...availableBranches])).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          {/* Category Filter (Disabled in equipment mode) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={reportMode === 'equipment'}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="all">All Categories</option>
              <option value="medicine">Medicines Only</option>
              <option value="supply">Supplies Only</option>
              <option value="equipment">Equipment Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D]"
            >
              <option value="all">All Statuses</option>
              <option value="in_stock">In Stock / Active</option>
              <option value="drawer_low">Drawer Low / Empty</option>
              <option value="expiring_soon">Expiring Soon (≤ 90d)</option>
              <option value="expired">Has Expired Stock</option>
              <option value="depleted">Depleted / Out of Stock</option>
            </select>
          </div>

          {/* Semester Filter (August-December, January-May, June-July) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Semester</label>
            <select
              value={semester}
              onChange={(e) => {
                const s = e.target.value;
                setSemester(s);
                if (s === '1st Semester') {
                  applyDatePreset('sem1');
                } else if (s === '2nd Semester') {
                  applyDatePreset('sem2');
                } else if (s === 'Summer') {
                  applyDatePreset('summer');
                }
              }}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D]"
            >
              <option value="all">All Semesters</option>
              <option value="1st Semester">1st Sem (Aug-Dec)</option>
              <option value="2nd Semester">2nd Sem (Jan-May)</option>
              <option value="Summer">Summer (Jun-Jul)</option>
            </select>
          </div>

          {/* School Year Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">School Year</label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D]"
            >
              <option value="all">All School Years</option>
              <option value="2024-2025">S.Y. 2024-2025</option>
              <option value="2025-2026">S.Y. 2025-2026</option>
              <option value="2026-2027">S.Y. 2026-2027</option>
            </select>
          </div>

        </div>

        {/* Date Range & Actions Sub-row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          {/* Quick Preset Buttons & Custom Date Inputs */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500 font-semibold flex items-center gap-1.5 mr-1">
              <FiCalendar className="w-4 h-4 text-slate-400" /> Range:
            </span>
            <button
              type="button"
              onClick={() => applyDatePreset('month')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('sem1')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
              title="1st Semester: August 1 to December 31"
            >
              1st Sem (Aug-Dec)
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('sem2')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
              title="2nd Semester: January 1 to May 31"
            >
              2nd Sem (Jan-May)
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('summer')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
              title="Summer Term: June 1 to July 31"
            >
              Summer (Jun-Jul)
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('sy')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
              title="Full Academic Year: August 1 to July 31"
            >
              Full S.Y. (Aug-Jul)
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('all')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
            >
              All Time
            </button>

            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20"
              />
              <span className="text-slate-400 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20"
              />
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2.5 self-end lg:self-auto flex-shrink-0">
            <button
              type="button"
              onClick={fetchReport}
              className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh Report Data"
            >
              <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-[#A5192D]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <FiDownload className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-[#A5192D] hover:bg-[#8B1424] text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <FiPrinter className="w-4 h-4 text-amber-300" />
              <span>Export PDF / Print</span>
            </button>
          </div>

        </div>
      </div>

      {/* 3. KPI Metric Summary Cards */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {reportMode === 'equipment' ? 'Total Equipment' : 'Registered Items'}
            </p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FiBox className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 mt-2">{summary.total_items}</p>
          <p className="text-xs text-slate-400 mt-1">
            Branch: <span className="font-semibold text-slate-600">{effectiveBranch === 'all' ? 'All Branches' : effectiveBranch}</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drawer Stock Pool</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FiArchive className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">{summary.total_drawer_stock}</p>
          <p className="text-xs text-slate-400 mt-1">Available for patient dispense</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Main Stockroom</p>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FiBox className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-indigo-700 mt-2">{summary.total_main_stock}</p>
          <p className="text-xs text-slate-400 mt-1">Reserve replenishment stock</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Action Needed</p>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <FiAlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#A5192D] mt-2">
            {summary.expiring_count + summary.expired_count + summary.drawer_low_count}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {summary.expiring_count} expiring • {summary.expired_count} expired • {summary.drawer_low_count} drawer low
          </p>
        </div>
      </div>

      {/* 4. Interactive Live Preview Data Table */}
      <div className="px-5 pb-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          
          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-sm">
            <div className="font-bold text-slate-700 flex items-center gap-2">
              <span>Previewing Records:</span>
              <span className="px-2.5 py-1 bg-[#A5192D]/10 text-[#A5192D] rounded-full font-bold text-xs">
                {reportMode === 'equipment' ? equipmentFlat.length : (reportMode === 'medicines' ? batchesFlat.length : items.length)} entries
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Target Form: <strong className="text-slate-700">{reportMode === 'equipment' ? 'Equipment / Tools Register' : (reportMode === 'medicines' ? 'Form SCR-9.5 Register' : 'Master Catalog')}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                <FiRefreshCw className="w-8 h-8 animate-spin text-[#A5192D] mb-3" />
                <p className="text-xs font-semibold">Generating live report data...</p>
              </div>
            ) : reportMode === 'equipment' ? (
              /* Equipment Table */
              equipmentFlat.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <FiBox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No equipment records matching the active filters.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-xs sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 w-12 text-center">#</th>
                      <th className="px-4 py-3.5 min-w-[180px]">Description</th>
                      <th className="px-4 py-3.5 text-center w-16">Qty.</th>
                      <th className="px-4 py-3.5 text-center w-16">Unit</th>
                      <th className="px-4 py-3.5 min-w-[120px]">Brand</th>
                      <th className="px-4 py-3.5 min-w-[100px]">Model No.</th>
                      <th className="px-4 py-3.5 min-w-[100px]">Serial No.</th>
                      <th className="px-4 py-3.5 min-w-[120px]">Supplier</th>
                      <th className="px-4 py-3.5 min-w-[110px]">Date Purchased</th>
                      <th className="px-4 py-3.5 min-w-[150px]">Remarks / Calibration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {equipmentFlat.map((eq, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{eq.description}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-slate-900 font-mono">{eq.qty}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{eq.unit}</td>
                        <td className="px-4 py-3 text-slate-700">{eq.brand}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{eq.model_no}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{eq.serial_no}</td>
                        <td className="px-4 py-3 text-slate-600">{eq.supplier}</td>
                        <td className="px-4 py-3 text-slate-600">{eq.date_purchased}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className="px-2.5 py-1 bg-slate-100 rounded text-slate-700 font-medium">
                            {eq.remarks}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              /* Medicines & Supplies / SCR-9.5 Table */
              batchesFlat.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <FiArchive className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No medicine or supply batches found matching the selected filters.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-xs sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 w-12 text-center">#</th>
                      <th className="px-4 py-3.5 min-w-[180px]">Medicine / Supply Name</th>
                      <th className="px-4 py-3.5 min-w-[90px]">Category</th>
                      <th className="px-4 py-3.5 min-w-[110px]">Dosage / Strength</th>
                      <th className="px-4 py-3.5 text-center min-w-[100px]">Drawer Inventory</th>
                      <th className="px-4 py-3.5 text-center min-w-[100px]">Main Stockroom</th>
                      <th className="px-4 py-3.5 text-center min-w-[90px]">Total Quantity</th>
                      <th className="px-4 py-3.5 min-w-[100px]">Lot / Batch No.</th>
                      <th className="px-4 py-3.5 min-w-[90px]">Expiry Date</th>
                      <th className="px-4 py-3.5 min-w-[120px]">Status / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchesFlat.map((b, idx) => {
                      const isExpired = b.remarks.includes('Expired');
                      const isExpiring = b.remarks.includes('Expiring');
                      const isDepleted = b.quantity <= 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-extrabold text-slate-800">{b.medicine_name}</div>
                            {b.formulation && (
                              <span className="text-[11px] text-slate-400 font-medium">{b.formulation}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-xs capitalize">
                              {b.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{b.dosage || '—'}</td>
                          
                          {/* Drawer Inventory Pill */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-3 py-1.5 rounded-lg font-mono font-bold text-xs ${
                              b.drawer_stock > 0 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {b.drawer_stock} {b.unit}
                            </span>
                          </td>

                          {/* Main Stock Pill */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-3 py-1.5 rounded-lg font-mono font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {b.main_stock} {b.unit}
                            </span>
                          </td>

                          {/* Total Stock */}
                          <td className="px-4 py-3 text-center font-mono font-extrabold text-slate-900">
                            {b.quantity} {b.unit}
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-600 font-semibold">{b.lot_number}</td>
                          
                          {/* Expiry Date */}
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-1 rounded font-mono font-bold text-xs ${
                              isExpired 
                                ? 'bg-rose-100 text-rose-800' 
                                : isExpiring 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'text-slate-700'
                            }`}>
                              {b.expiry_date}
                            </span>
                          </td>

                          {/* Remarks */}
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1.5 rounded-md text-xs font-semibold ${
                              isExpired 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : isExpiring 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                : isDepleted 
                                ? 'bg-slate-100 text-slate-500' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {b.remarks}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>

        </div>
      </div>

      {/* 5. PDF Print Preview Modal (Faithful to physical Cor Jesu College forms in Landscape) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-start z-50 overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200">
          
          {/* Force Folio Landscape Printing via CSS */}
          <style dangerouslySetInnerHTML={{ __html: `
            @page {
              size: 13in 8.5in; /* Folio / Long Bond (PH) Landscape */
              margin: 8mm 10mm;
            }
            @media print {
              body, html {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background: #ffffff !important;
              }
              .no-print {
                display: none !important;
              }
              #inventory-report-document {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
              tfoot {
                display: table-footer-group;
              }
            }
          ` }} />

          {/* Modal Toolbar (hidden on print) */}
          <div className="no-print bg-slate-900 text-white w-full max-w-[1240px] p-4 rounded-t-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-20 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#A5192D] flex items-center justify-center text-white font-black text-sm">
                PDF
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">
                  Official Document Preview (Landscape) — {reportMode === 'equipment' ? 'Equipment / Tools Register' : (reportMode === 'medicines' ? 'Form SCR-9.5 Medicine Register' : 'Master Catalog')}
                </h3>
                <p className="text-[11px] text-slate-400">Official Cor Jesu College Clinic Printable Format • Formatted in Landscape</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-[#A5192D] hover:bg-[#8B1424] text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <FiPrinter className="w-4 h-4 text-amber-300" /> Print / Save as PDF
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FiDownload className="w-4 h-4" /> Download Excel
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ml-1"
                aria-label="Close preview"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Paper (Landscape width max-w-[1240px]) */}
          <div
            id="inventory-report-document"
            className="bg-white w-full max-w-[1240px] p-8 sm:p-10 rounded-b-2xl shadow-2xl border border-slate-200 space-y-4 text-slate-900 print:shadow-none print:border-none print:w-full print:max-w-none print:p-0"
          >
            {/* 1. Official CJC Header Letterhead - Scaled to Full Landscape/Folio Width */}
            <div className="border-b-2 border-slate-900 pb-2 text-center">
              <img
                src="/cjc_report_header.png?v=3"
                alt="Cor Jesu College Header"
                className="w-full h-auto mb-1.5 block"
              />
              <div className="flex justify-between items-center px-1 text-[11px] font-semibold text-slate-600">
                <span className="uppercase tracking-wider text-[#A5192D] font-bold">
                  {effectiveBranch === 'all' ? 'All Clinic Branches' : effectiveBranch.toUpperCase()}
                </span>
                <span>
                  Report Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* 2. Official Document Title & Metadata Box */}
            {reportMode === 'equipment' ? (
              /* Equipment Register Title - Exactly Matching Physical Form */
              <div className="text-center space-y-1 py-1.5 border-b border-slate-300">
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-slate-900">
                  INVENTORY OF EQUIPMENT/APPARATUS TOOLS AND MATERIALS
                </h1>
                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-xs text-slate-800 font-semibold">
                  <span>S.Y. {schoolYear}</span>
                  <span>•</span>
                  <span>
                    Area: <span className="text-[#A5192D] font-bold uppercase">{effectiveBranch === 'all' ? 'ALL CLINIC BRANCHES' : effectiveBranch}</span>
                  </span>
                  {startDate && endDate && (
                    <>
                      <span>•</span>
                      <span>Period: {startDate} to {endDate}</span>
                    </>
                  )}
                </div>
              </div>
            ) : reportMode === 'medicines' ? (
              /* SCR-9.5 Medicine & Supplies Register Title */
              <div className="space-y-2 py-1.5 border-b border-slate-300">
                <div className="text-center">
                  <h1 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-900">
                    SCR-9.5 {effectiveBranch === 'all' ? 'ALL CLINIC BRANCHES' : effectiveBranch.toUpperCase()} MEDICINE/SUPPLIES INVENTORY REGISTER
                  </h1>
                </div>
                
                {/* Semester & School Year Checkbox row matching physical form */}
                <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-800 px-2 pt-0.5">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-[10px] font-black ${semester === '1st Semester' ? 'bg-slate-900 text-white' : ''}`}>
                        {semester === '1st Semester' ? '✓' : ''}
                      </span>
                      <span>1st Semester <span className="font-normal text-[10px] text-slate-600">(Aug-Dec)</span></span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-[10px] font-black ${semester === '2nd Semester' ? 'bg-slate-900 text-white' : ''}`}>
                        {semester === '2nd Semester' ? '✓' : ''}
                      </span>
                      <span>2nd Semester <span className="font-normal text-[10px] text-slate-600">(Jan-May)</span></span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-[10px] font-black ${semester === 'Summer' ? 'bg-slate-900 text-white' : ''}`}>
                        {semester === 'Summer' ? '✓' : ''}
                      </span>
                      <span>Summer <span className="font-normal text-[10px] text-slate-600">(Jun-Jul)</span></span>
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <span>S.Y. <u className="font-mono">{schoolYear}</u></span>
                    <span>Area: <span className="text-[#A5192D] font-bold uppercase">{effectiveBranch === 'all' ? 'ALL CLINIC BRANCHES' : effectiveBranch}</span></span>
                  </div>
                </div>
              </div>
            ) : (
              /* Master Inventory Catalog Title */
              <div className="text-center space-y-1 py-1.5 border-b border-slate-300">
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-slate-900">
                  MASTER CLINIC INVENTORY CATALOG REGISTER
                </h1>
                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-xs text-slate-800 font-semibold">
                  <span>S.Y. {schoolYear}</span>
                  <span>•</span>
                  <span>
                    Area: <span className="text-[#A5192D] font-bold uppercase">{effectiveBranch === 'all' ? 'ALL CLINIC BRANCHES' : effectiveBranch}</span>
                  </span>
                </div>
              </div>
            )}

            {/* 3. Formal Grid Table (Exact Match to Physical Forms in Landscape) */}
            <div className="overflow-x-auto">
              {reportMode === 'equipment' ? (
                /* Equipment Grid - Exact 10 columns matching physical photo */
                <table className="w-full text-left border-collapse border border-slate-900 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold uppercase tracking-wider text-center border-b border-slate-900">
                      <th className="p-2 border border-slate-900 w-12 text-center">Item No.</th>
                      <th className="p-2 border border-slate-900 text-left min-w-[170px]">Description</th>
                      <th className="p-2 border border-slate-900 w-12 text-center">Qty.</th>
                      <th className="p-2 border border-slate-900 w-12 text-center">Unit</th>
                      <th className="p-2 border border-slate-900 min-w-[100px] text-center">Brand</th>
                      <th className="p-2 border border-slate-900 min-w-[100px] text-center">Model No.</th>
                      <th className="p-2 border border-slate-900 min-w-[100px] text-center">Serial No.</th>
                      <th className="p-2 border border-slate-900 min-w-[110px] text-center">Supplier</th>
                      <th className="p-2 border border-slate-900 min-w-[110px] text-center">Date Purchased/Fabricated</th>
                      <th className="p-2 border border-slate-900 min-w-[140px] text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentFlat.map((eq, i) => (
                      <tr key={i} className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 text-center font-bold font-mono">{i + 1}</td>
                        <td className="p-2 border border-slate-900 font-bold">{eq.description}</td>
                        <td className="p-2 border border-slate-900 text-center font-bold font-mono">{eq.qty}</td>
                        <td className="p-2 border border-slate-900 text-center">{eq.unit || 'Pc'}</td>
                        <td className="p-2 border border-slate-900 text-center">{eq.brand || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-center font-mono">{eq.model_no || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-center font-mono">{eq.serial_no || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-center">{eq.supplier || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-center">{eq.date_purchased || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-left">{eq.remarks || 'Good Condition'}</td>
                      </tr>
                    ))}
                    {equipmentFlat.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-4 text-center text-slate-500 italic border border-slate-900">
                          No equipment records available for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : reportMode === 'medicines' ? (
                /* SCR-9.5 Medicine / Supplies Grid */
                <table className="w-full text-left border-collapse border border-slate-900 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold uppercase tracking-wider text-center border-b border-slate-900">
                      <th className="p-2 border border-slate-900 w-12 text-center">Item No.</th>
                      <th className="p-2 border border-slate-900 text-left min-w-[180px]">Medicine Name / Item Description</th>
                      <th className="p-2 border border-slate-900 text-center min-w-[80px]">Category</th>
                      <th className="p-2 border border-slate-900 text-center min-w-[110px]">Dosage / Formulation</th>
                      <th className="p-2 border border-slate-900 text-center min-w-[130px]">Quantity (Drawer / Main)</th>
                      <th className="p-2 border border-slate-900 text-center w-24">Lot / Batch No.</th>
                      <th className="p-2 border border-slate-900 text-center w-24">Expiry Date</th>
                      <th className="p-2 border border-slate-900 text-left min-w-[140px]">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchesFlat.map((b, i) => (
                      <tr key={i} className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 text-center font-bold font-mono">{i + 1}</td>
                        <td className="p-2 border border-slate-900 font-bold">
                          {b.medicine_name}
                        </td>
                        <td className="p-2 border border-slate-900 text-center capitalize">{b.category}</td>
                        <td className="p-2 border border-slate-900 text-center">
                          {b.dosage ? b.dosage : (b.formulation ? b.formulation : '—')}
                        </td>
                        <td className="p-2 border border-slate-900 text-center font-mono">
                          <strong className="text-slate-900">{b.quantity} {b.unit}</strong>
                          <span className="block text-[10px] text-slate-600">
                            (Drawer: {b.drawer_stock} | Main: {b.main_stock})
                          </span>
                        </td>
                        <td className="p-2 border border-slate-900 text-center font-mono">{b.lot_number || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-center font-bold font-mono">
                          {b.expiry_date}
                        </td>
                        <td className="p-2 border border-slate-900 text-left">
                          {b.remarks}
                        </td>
                      </tr>
                    ))}
                    {batchesFlat.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500 italic border border-slate-900">
                          No medicine or supplies records registered for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* Master Catalog Grid */
                <table className="w-full text-left border-collapse border border-slate-900 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold uppercase tracking-wider text-center border-b border-slate-900">
                      <th className="p-2 border border-slate-900 w-12 text-center">Item No.</th>
                      <th className="p-2 border border-slate-900 text-left min-w-[180px]">Item Description</th>
                      <th className="p-2 border border-slate-900 text-center min-w-[90px]">Category</th>
                      <th className="p-2 border border-slate-900 text-center min-w-[90px]">Total Stock</th>
                      <th className="p-2 border border-slate-900 text-center min-w-[80px]">Unit</th>
                      <th className="p-2 border border-slate-900 min-w-[110px] text-center">Brand / Model</th>
                      <th className="p-2 border border-slate-900 min-w-[110px] text-center">Earliest Expiry</th>
                      <th className="p-2 border border-slate-900 text-left min-w-[130px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 text-center font-bold font-mono">{i + 1}</td>
                        <td className="p-2 border border-slate-900 font-bold">{item.generic_name}</td>
                        <td className="p-2 border border-slate-900 text-center capitalize">{item.category}</td>
                        <td className="p-2 border border-slate-900 text-center font-bold font-mono">{item.total_stock}</td>
                        <td className="p-2 border border-slate-900 text-center">{item.unit}</td>
                        <td className="p-2 border border-slate-900 text-center">{item.brand_name || item.model_no || '----------'}</td>
                        <td className="p-2 border border-slate-900 text-center font-mono">{item.earliest_expiry ? new Date(item.earliest_expiry).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }) : '----------'}</td>
                        <td className="p-2 border border-slate-900 text-left">{item.status_label}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500 italic border border-slate-900">
                          No items registered in catalog.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* 4. Signatory Section (Official Cor Jesu College Signatures) */}
            <div className="pt-8 pb-4 flex justify-between items-end gap-8 text-xs break-inside-avoid">
              <div className="w-1/2 space-y-1">
                <p className="font-bold text-slate-700">Prepared by:</p>
                <div className="pt-8 border-b-2 border-slate-800 text-center">
                  <input
                    type="text"
                    value={preparedByName}
                    onChange={(e) => setPreparedByName(e.target.value)}
                    className="w-full text-center font-bold text-slate-900 uppercase focus:outline-none bg-transparent"
                    placeholder="Clinic Nurse / Staff Name"
                  />
                </div>
                <input
                  type="text"
                  value={preparedByTitle}
                  onChange={(e) => setPreparedByTitle(e.target.value)}
                  className="w-full text-center text-[11px] text-slate-600 font-semibold focus:outline-none bg-transparent"
                  placeholder="Designation / Role"
                />
              </div>

              <div className="w-1/2 space-y-1">
                <p className="font-bold text-slate-700">Noted by:</p>
                <div className="pt-8 border-b-2 border-slate-800 text-center">
                  <input
                    type="text"
                    value={notedByName}
                    onChange={(e) => setNotedByName(e.target.value)}
                    className="w-full text-center font-bold text-slate-900 uppercase focus:outline-none bg-transparent"
                    placeholder="Clinic Physician / Head Name"
                  />
                </div>
                <input
                  type="text"
                  value={notedByTitle}
                  onChange={(e) => setNotedByTitle(e.target.value)}
                  className="w-full text-center text-[11px] text-slate-600 font-semibold focus:outline-none bg-transparent"
                  placeholder="Designation / Role"
                />
              </div>
            </div>

            {/* 5. Document Control Note */}
            <div className="text-[10px] text-slate-400 text-center border-t border-slate-200 pt-2 font-mono">
              CJC-CLINIC+ AUTOMATED OFFICIAL INVENTORY REGISTER • COR JESU COLLEGE, INC. • SACRED HEART AVE, DIGOS CITY
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default InventoryReport;
