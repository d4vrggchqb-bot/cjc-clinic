import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  FiFileText, 
  FiSearch, 
  FiFilter, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiRefreshCw, 
  FiClock, 
  FiArrowRight,
  FiUser,
  FiBox,
  FiCheckCircle,
  FiTrash2,
  FiEdit3,
  FiCheck
} from 'react-icons/fi';
import { useBranch } from '../context/BranchContext';

export interface AuditLogEntry {
  id: number;
  batch_id: number;
  action_type: string;
  quantity_changed: number;
  source_location: string | null;
  target_location: string | null;
  disposed_to: string | null;
  created_at: string;
  batch_number: string;
  lot_number: string | null;
  clinic_branch: string;
  stock_remaining: number;
  main_stock: number;
  drawer_stock: number;
  item_id: number;
  generic_name: string;
  brand_name: string | null;
  dosage: string | null;
  unit: string | null;
  staff_name: string;
  staff_role: string | null;
  patient_name: string | null;
  patient_id_number: string | null;
}

const InventoryAuditTrail: React.FC = () => {
  const { userBranch, isSuperAdmin, selectedBranch } = useBranch();
  const initialBranchFilter = isSuperAdmin
    ? (selectedBranch === 'All Branches' ? 'all' : (selectedBranch || userBranch || 'all'))
    : (userBranch || 'College Clinic');

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState(initialBranchFilter);

  useEffect(() => {
    if (!isSuperAdmin) {
      setBranchFilter(userBranch || 'College Clinic');
    } else if (selectedBranch) {
      setBranchFilter(selectedBranch === 'All Branches' ? 'all' : selectedBranch);
    }
  }, [userBranch, selectedBranch, isSuperAdmin]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter !== 'all') params.append('branch', branchFilter);
      if (actionFilter !== 'all') params.append('action_filter', actionFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await apiFetch(`/api/index.php?route=inventory&action=audit_trail&${params.toString()}`);
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, branchFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'dispense':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <FiTrendingDown className="text-amber-600" />
            Dispensed
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FiArrowRight className="text-blue-600" />
            Transferred
          </span>
        );
      case 'restock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FiTrendingUp className="text-emerald-600" />
            Restocked
          </span>
        );
      case 'edit':
      case 'adjust':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <FiEdit3 className="text-purple-600" />
            Adjusted
          </span>
        );
      case 'dispose':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <FiTrash2 className="text-rose-600" />
            Disposed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const renderMovementFlow = (log: AuditLogEntry) => {
    if (log.action_type === 'transfer') {
      return (
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">Main Stock</span>
          <FiArrowRight className="text-blue-500 text-xs" />
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Drawer Stock</span>
        </div>
      );
    }
    if (log.action_type === 'dispense') {
      return (
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
            {log.source_location === 'main' ? 'Main' : 'Drawer'}
          </span>
          <FiArrowRight className="text-amber-500 text-xs" />
          <span className="text-slate-700 truncate max-w-[140px]">
            {log.patient_name || 'Patient'}
          </span>
        </div>
      );
    }
    if (log.action_type === 'restock') {
      return (
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className="text-slate-400">Restock</span>
          <FiArrowRight className="text-emerald-500 text-xs" />
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">Main Stock</span>
        </div>
      );
    }
    if (log.action_type === 'dispose') {
      return (
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Stock</span>
          <FiArrowRight className="text-rose-500 text-xs" />
          <span className="text-rose-700 truncate max-w-[140px]">{log.disposed_to || 'Hazardous Bin'}</span>
        </div>
      );
    }
    return (
      <span className="text-xs text-slate-500 font-mono">
        {log.disposed_to || 'System adjustment'}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FiFileText className="text-[#A5192D]" /> Inventory Audit Trail & Movements
          </h2>
          <p className="text-xs text-slate-500">
            Chronological record of all stock transfers, consultation dispensing, restocks, and medical disposals.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by medicine, lot number, staff, or recipient..."
            className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action Filter */}
          <div className="flex bg-white p-0.5 border border-slate-200 rounded-lg">
            {(['all', 'dispense', 'transfer', 'restock', 'dispose'] as const).map(action => (
              <button
                key={action}
                type="button"
                onClick={() => setActionFilter(action)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  actionFilter === action
                    ? 'bg-[#A5192D] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {action === 'all' ? 'All' : action}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchLogs}
            title="Refresh logs"
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors"
          >
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin text-[#A5192D]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-left text-xs sm:text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-3">Action</th>
              <th className="py-3 px-4">Medicine / Supply</th>
              <th className="py-3 px-3">LOT / Batch</th>
              <th className="py-3 px-3 text-center">Qty Changed</th>
              <th className="py-3 px-3">Movement Path</th>
              <th className="py-3 px-4">Recipient / Notes</th>
              <th className="py-3 px-4">Performed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <FiRefreshCw className="inline-block animate-spin text-xl mb-2 text-[#A5192D]" />
                  <p>Loading audit trail...</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <FiCheckCircle className="inline-block text-2xl text-slate-400 mb-2" />
                  <p className="font-medium text-slate-600">No activity logs found.</p>
                  <p className="text-xs text-slate-400">Try adjusting your search terms or filters.</p>
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                    {new Date(log.created_at).toLocaleString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getActionBadge(log.action_type)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">
                      {log.generic_name}
                      {log.dosage && <span className="ml-1 text-xs font-normal text-slate-500">({log.dosage})</span>}
                    </div>
                    {log.brand_name && (
                      <div className="text-[11px] text-slate-400">Brand: {log.brand_name}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {log.lot_number || log.batch_number || 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className={`inline-block font-bold px-2 py-0.5 rounded text-xs ${
                      log.action_type === 'restock' 
                        ? 'bg-emerald-50 text-emerald-700'
                        : log.action_type === 'transfer'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {log.action_type === 'restock' ? `+${log.quantity_changed}` : log.quantity_changed} {log.unit || 'pcs'}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {renderMovementFlow(log)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {log.patient_name ? (
                      <div>
                        <span className="font-semibold text-slate-800">{log.patient_name}</span>
                        {log.patient_id_number && (
                          <span className="ml-1 text-slate-400 font-mono text-[11px]">({log.patient_id_number})</span>
                        )}
                      </div>
                    ) : log.disposed_to ? (
                      <span className="italic text-slate-500">{log.disposed_to}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <FiUser className="text-[10px]" />
                      </div>
                      <span>{log.staff_name}</span>
                    </div>
                    {log.staff_role && (
                      <div className="text-[10px] text-slate-400 pl-6.5">{log.staff_role}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryAuditTrail;
