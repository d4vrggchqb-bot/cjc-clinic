import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  FiClock, 
  FiAlertTriangle, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiSearch, 
  FiFilter, 
  FiRefreshCw, 
  FiArrowRight,
  FiTrash2,
  FiPackage,
  FiInbox
} from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';
import { useBranch } from '../context/BranchContext';
import TransferToDrawerModal from './TransferToDrawerModal';

export interface ExpirationItem {
  batch_id: number;
  item_id: number;
  batch_number: string;
  lot_number: string;
  stock_remaining: number;
  main_stock: number;
  drawer_stock: number;
  expired_on: string;
  clinic_branch: string;
  restock_semester: string | null;
  school_year: string | null;
  days_until_expiration: number;
  generic_name: string;
  brand_name: string | null;
  dosage: string | null;
  unit: string | null;
  category: string;
}

interface ExpirationStats {
  expiring_6_months: number;
  expiring_3_months: number;
  expiring_1_month: number;
  expired_medicines: number;
}

interface ExpirationWatchProps {
  onTransferClick?: (item: ExpirationItem) => void;
}

const ExpirationWatch: React.FC<ExpirationWatchProps> = ({ onTransferClick }) => {
  const { confirm } = useConfirm();
  const { userBranch, isSuperAdmin, selectedBranch } = useBranch();

  const initialBranchFilter = isSuperAdmin
    ? (selectedBranch === 'All Branches' ? 'all' : (selectedBranch || userBranch || 'all'))
    : (userBranch || 'College Clinic');

  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [stats, setStats] = useState<ExpirationStats>({
    expiring_6_months: 0,
    expiring_3_months: 0,
    expiring_1_month: 0,
    expired_medicines: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>(initialBranchFilter);

  useEffect(() => {
    if (!isSuperAdmin) {
      setBranchFilter(userBranch || 'College Clinic');
    } else if (selectedBranch) {
      setBranchFilter(selectedBranch === 'All Branches' ? 'all' : selectedBranch);
    }
  }, [userBranch, selectedBranch, isSuperAdmin]);

  // Disposal Modal State
  const [disposeBatch, setDisposeBatch] = useState<ExpirationItem | null>(null);
  const [disposeQty, setDisposeQty] = useState(1);
  const [disposeReason, setDisposeReason] = useState('Expired medicine removal');
  const [disposeLocation, setDisposeLocation] = useState<'main' | 'drawer'>('main');
  const [isDisposing, setIsDisposing] = useState(false);

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferBatchId, setTransferBatchId] = useState<number | null>(null);

  const handleOpenTransfer = (item: ExpirationItem) => {
    if (onTransferClick) {
      onTransferClick(item);
    } else {
      setTransferBatchId(item.batch_id);
      setTransferModalOpen(true);
    }
  };

  const fetchExpirationData = async () => {
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'all' ? `&branch=${encodeURIComponent(branchFilter)}` : '';
      const res = await apiFetch(`/api/index.php?route=inventory&action=expiration_watch${branchParam}`);
      if (res.success) {
        setStats(res.stats || {
          expiring_6_months: 0,
          expiring_3_months: 0,
          expiring_1_month: 0,
          expired_medicines: 0
        });
        setItems(res.items || []);
      }
    } catch (err) {
      console.error('Failed to load expiration watch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpirationData();
  }, [branchFilter]);

  const getRemainingTimeBadge = (days: number) => {
    if (days <= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          EXPIRED ({Math.abs(days)}d ago)
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <FiAlertTriangle className="text-amber-600 text-xs" />
          Expiring in {days} day{days !== 1 ? 's' : ''}
        </span>
      );
    }
    if (days <= 90) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
          <FiClock className="text-yellow-600 text-xs" />
          Expiring in {days} days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
        <FiClock className="text-sky-500 text-xs" />
        Expiring in {days} days
      </span>
    );
  };

  const filteredItems = items.filter(item => {
    const term = search.toLowerCase();
    const matchesSearch = 
      item.generic_name.toLowerCase().includes(term) ||
      (item.brand_name && item.brand_name.toLowerCase().includes(term)) ||
      (item.lot_number && item.lot_number.toLowerCase().includes(term)) ||
      (item.dosage && item.dosage.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (semesterFilter !== 'all' && item.restock_semester !== semesterFilter) {
      return false;
    }

    if (statusFilter === 'expired') return item.days_until_expiration <= 0;
    if (statusFilter === '1_month') return item.days_until_expiration > 0 && item.days_until_expiration <= 30;
    if (statusFilter === '3_months') return item.days_until_expiration > 0 && item.days_until_expiration <= 90;
    if (statusFilter === '6_months') return item.days_until_expiration > 0 && item.days_until_expiration <= 180;

    return true;
  });

  const handleOpenDispose = (item: ExpirationItem) => {
    setDisposeBatch(item);
    if (item.drawer_stock > 0) {
      setDisposeLocation('drawer');
      setDisposeQty(item.drawer_stock);
    } else {
      setDisposeLocation('main');
      setDisposeQty(item.main_stock);
    }
  };

  const handleConfirmDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposeBatch) return;

    const maxStock = disposeLocation === 'drawer' ? disposeBatch.drawer_stock : disposeBatch.main_stock;
    if (disposeQty <= 0 || disposeQty > maxStock) {
      alert(`Invalid disposal quantity. Maximum available in ${disposeLocation} is ${maxStock}.`);
      return;
    }

    const confirmed = await confirm({
      title: 'Confirm Medical Waste Disposal',
      message: `Are you sure you want to log disposal of ${disposeQty} units of ${disposeBatch.generic_name} from ${disposeLocation} stock? This cannot be undone.`,
      confirmLabel: 'Confirm Disposal',
      danger: true
    });
    if (!confirmed) return;

    setIsDisposing(true);
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=dispose_batch_stock', {
        method: 'POST',
        body: JSON.stringify({
          batch_id: disposeBatch.batch_id,
          quantity: disposeQty,
          reason: disposeReason,
          disposed_to: `Hazardous Waste (${disposeLocation} pool)`
        })
      });
      if (res.success) {
        setDisposeBatch(null);
        fetchExpirationData();
      } else {
        alert(res.error || 'Failed to dispose batch stock.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while disposing.');
    } finally {
      setIsDisposing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* 4 Summary Cards matching Existing Clinic Workflow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Expiring within 6 Months */}
        <div 
          onClick={() => setStatusFilter(statusFilter === '6_months' ? 'all' : '6_months')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
            statusFilter === '6_months' 
              ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-200' 
              : 'bg-white border-slate-200 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
              Expiring in 6 Mos
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
              <FiClock className="text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800">{stats.expiring_6_months}</span>
            <span className="text-xs font-medium text-slate-500">batches</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Batches expiring within 180 days</p>
        </div>

        {/* Card 2: Expiring within 3 Months */}
        <div 
          onClick={() => setStatusFilter(statusFilter === '3_months' ? 'all' : '3_months')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
            statusFilter === '3_months' 
              ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200' 
              : 'bg-white border-slate-200 hover:border-yellow-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-700">
              Expiring in 3 Mos
            </span>
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
              <FiClock className="text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800">{stats.expiring_3_months}</span>
            <span className="text-xs font-medium text-slate-500">batches</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Batches expiring within 90 days</p>
        </div>

        {/* Card 3: Expiring within 1 Month */}
        <div 
          onClick={() => setStatusFilter(statusFilter === '1_month' ? 'all' : '1_month')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
            statusFilter === '1_month' 
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' 
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Expiring in 1 Mo
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <FiAlertTriangle className="text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800">{stats.expiring_1_month}</span>
            <span className="text-xs font-medium text-slate-500">batches</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">High priority alert: &lt; 30 days left</p>
        </div>

        {/* Card 4: Expired Medicines */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
            statusFilter === 'expired' 
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' 
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Expired Medicines
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
              <FiAlertCircle className="text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600">{stats.expired_medicines}</span>
            <span className="text-xs font-medium text-rose-400">batches</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Must be cleared from clinic immediately</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by medicine name, dosage, or lot number..."
            className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-[#A5192D]"
          >
            <option value="all">All Timelines</option>
            <option value="expired">Expired Only</option>
            <option value="1_month">Expiring in 1 Month</option>
            <option value="3_months">Expiring in 3 Months</option>
            <option value="6_months">Expiring in 6 Months</option>
          </select>

          {/* Semester Filter */}
          <select
            value={semesterFilter}
            onChange={e => setSemesterFilter(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-[#A5192D]"
          >
            <option value="all">All Semesters</option>
            <option value="1st Semester">1st Semester</option>
            <option value="2nd Semester">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            disabled={!isSuperAdmin}
            className={`py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#A5192D] ${
              !isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-slate-700'
            }`}
          >
            {isSuperAdmin ? (
              <>
                <option value="all">🏢 All Branches</option>
                <option value="College Clinic">🏢 College Clinic</option>
                <option value="Basic Education Clinic">🏢 Basic Education Clinic</option>
                <option value="Power Campus Clinic">🏢 Power Campus Clinic</option>
              </>
            ) : (
              <option value={userBranch || 'College Clinic'}>🏢 {userBranch || 'College Clinic'}</option>
            )}
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchExpirationData}
            title="Refresh list"
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors"
          >
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin text-[#A5192D]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expiration List Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-left text-xs sm:text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Medicine Details</th>
              <th className="py-3 px-3">LOT / Batch No.</th>
              <th className="py-3 px-3">Restock Period</th>
              <th className="py-3 px-3">Expiration Date</th>
              <th className="py-3 px-3">Remaining Time</th>
              <th className="py-3 px-3 text-center">Drawer</th>
              <th className="py-3 px-3 text-center">Main</th>
              <th className="py-3 px-3 text-center">Total</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <FiRefreshCw className="inline-block animate-spin text-xl mb-2 text-[#A5192D]" />
                  <p>Analyzing expiration timelines...</p>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <FiCheckCircle className="inline-block text-2xl text-emerald-500 mb-2" />
                  <p className="font-medium text-slate-600">No batches match the selected criteria.</p>
                  <p className="text-xs text-slate-400">All supplies are within safe consumption thresholds.</p>
                </td>
              </tr>
            ) : (
              filteredItems.map(item => (
                <tr 
                  key={item.batch_id} 
                  className={`hover:bg-slate-50/80 transition-colors ${
                    item.days_until_expiration <= 0 ? 'bg-rose-50/30' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">
                      {item.generic_name}
                      {item.dosage && <span className="ml-1.5 text-xs font-normal text-slate-500">({item.dosage})</span>}
                    </div>
                    {item.brand_name && (
                      <div className="text-xs text-slate-400 font-mono">Brand: {item.brand_name}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs font-medium text-slate-700">
                    {item.lot_number || item.batch_number || 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    <div>{item.restock_semester || '1st Semester'}</div>
                    <div className="text-[11px] text-slate-400">{item.school_year || '2025-2026'}</div>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                    {item.expired_on}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getRemainingTimeBadge(item.days_until_expiration)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
                      {item.drawer_stock}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-xs">
                      {item.main_stock}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-800">
                    {item.stock_remaining}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {!isSuperAdmin ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {/* If expired or near expiry, offer Dispose */}
                        <button
                          onClick={() => handleOpenDispose(item)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                          title="Dispose expired or contaminated batch stock"
                        >
                          <FiTrash2 className="text-xs" />
                          <span>Dispose</span>
                        </button>

                        {/* If item has main_stock and not expired, allow quick transfer */}
                        {item.main_stock > 0 && item.days_until_expiration > 0 && (
                          <button
                            onClick={() => handleOpenTransfer(item)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                            title="Transfer available unexpired stock to Drawer"
                          >
                            <FiArrowRight className="text-xs text-[#A5192D]" />
                            <span>Drawer</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">View Only</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Disposal Modal */}
      {disposeBatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FiTrash2 className="text-rose-600" /> Dispose Medicine Batch Stock
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Safely log disposal of expired, contaminated, or damaged stock for compliance auditing.
            </p>

            <form onSubmit={handleConfirmDispose} className="mt-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="font-semibold text-slate-700">{disposeBatch.generic_name} {disposeBatch.dosage}</div>
                <div className="text-slate-500 font-mono mt-0.5">LOT: {disposeBatch.lot_number} | Exp: {disposeBatch.expired_on}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select Source Pool</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDisposeLocation('drawer');
                      setDisposeQty(Math.min(disposeQty, disposeBatch.drawer_stock || 1));
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      disposeLocation === 'drawer'
                        ? 'bg-[#A5192D]/10 border-[#A5192D] text-[#A5192D]'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Drawer ({disposeBatch.drawer_stock} pcs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisposeLocation('main');
                      setDisposeQty(Math.min(disposeQty, disposeBatch.main_stock || 1));
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      disposeLocation === 'main'
                        ? 'bg-[#A5192D]/10 border-[#A5192D] text-[#A5192D]'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Main Stock ({disposeBatch.main_stock} pcs)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantity to Dispose</label>
                <input
                  type="number"
                  min={1}
                  max={disposeLocation === 'drawer' ? disposeBatch.drawer_stock : disposeBatch.main_stock}
                  value={disposeQty}
                  onChange={e => setDisposeQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Disposal Reason / Remarks</label>
                <input
                  type="text"
                  value={disposeReason}
                  onChange={e => setDisposeReason(e.target.value)}
                  placeholder="e.g. Expired unconsumed stock, damaged packaging"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisposeBatch(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisposing}
                  className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isDisposing ? 'Processing...' : 'Confirm Disposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer to Drawer Modal */}
      <TransferToDrawerModal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          setTransferBatchId(null);
        }}
        onSuccess={() => {
          fetchExpirationData();
        }}
        preselectedBatchId={transferBatchId}
        clinicBranch={branchFilter !== 'all' ? branchFilter : (userBranch || 'College Clinic')}
      />
    </div>
  );
};

export default ExpirationWatch;
