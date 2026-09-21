import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiX, FiSearch, FiArrowRight, FiCheckCircle, FiAlertCircle, FiInbox } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

export interface TransferBatchItem {
  batch_id: number;
  generic_name: string;
  brand_name?: string | null;
  dosage?: string | null;
  lot_number?: string | null;
  batch_number?: string | null;
  main_stock: number;
  drawer_stock: number;
  expired_on?: string | null;
}

interface TransferToDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedBatchId?: number | null;
  clinicBranch?: string;
}

interface SelectedTransferRow {
  selected: boolean;
  qty: number;
}

const isBatchExpired = (expiredOn?: string | null): boolean => {
  if (!expiredOn) return false;
  const parts = expiredOn.split('-');
  if (parts.length === 3) {
    const expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    expDate.setHours(23, 59, 59, 999);
    return expDate.getTime() < Date.now();
  }
  return false;
};

const getBatchStatus = (b: TransferBatchItem): { isDisabled: boolean; reason: 'expired' | 'out_of_stock' | null } => {
  if (isBatchExpired(b.expired_on)) {
    return { isDisabled: true, reason: 'expired' };
  }
  if ((b.main_stock ?? 0) <= 0) {
    return { isDisabled: true, reason: 'out_of_stock' };
  }
  return { isDisabled: false, reason: null };
};

const TransferToDrawerModal: React.FC<TransferToDrawerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedBatchId,
  clinicBranch
}) => {
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState<TransferBatchItem[]>([]);
  const [search, setSearch] = useState('');
  const [transferSelections, setTransferSelections] = useState<Record<number, SelectedTransferRow>>({});

  useEffect(() => {
    if (isOpen) {
      loadBatches();
    }
  }, [isOpen, clinicBranch]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const branchParam = clinicBranch && clinicBranch !== 'all' ? `&branch=${encodeURIComponent(clinicBranch)}` : '';
      const res = await apiFetch(`/api/index.php?route=inventory&action=batches&include_all=1${branchParam}`);
      const rawBatches = res.batches || [];
      
      // Load all batches so staff see active, expired, and out-of-stock items clearly
      const available: TransferBatchItem[] = rawBatches.map((b: any) => ({
        batch_id: b.id,
        generic_name: b.generic_name || 'Unnamed Item',
        brand_name: b.brand_name,
        dosage: b.dosage,
        lot_number: b.lot_number || b.batch_number,
        batch_number: b.batch_number,
        main_stock: b.main_stock !== undefined ? b.main_stock : b.stock_remaining,
        drawer_stock: b.drawer_stock || 0,
        expired_on: b.expired_on
      }));

      setBatches(available);

      // Initialize transfer rows: only allow preselection if batch is NOT disabled
      const initMap: Record<number, SelectedTransferRow> = {};
      available.forEach(b => {
        const { isDisabled } = getBatchStatus(b);
        const isPreselected = !isDisabled && preselectedBatchId === b.batch_id;
        initMap[b.batch_id] = {
          selected: isPreselected,
          qty: isPreselected ? Math.min(10, b.main_stock) : 0
        };
      });
      setTransferSelections(initMap);
    } catch (err) {
      console.error('Failed to load batches for transfer:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredBatches = batches.filter(b => {
    const term = search.toLowerCase();
    return (
      b.generic_name.toLowerCase().includes(term) ||
      (b.brand_name && b.brand_name.toLowerCase().includes(term)) ||
      (b.dosage && b.dosage.toLowerCase().includes(term)) ||
      (b.lot_number && b.lot_number.toLowerCase().includes(term))
    );
  });

  const handleToggleSelect = (b: TransferBatchItem) => {
    const { isDisabled } = getBatchStatus(b);
    if (isDisabled) return; // Disallow selecting expired or out-of-stock batches

    setTransferSelections(prev => {
      const current = prev[b.batch_id] || { selected: false, qty: 0 };
      const nextSelected = !current.selected;
      return {
        ...prev,
        [b.batch_id]: {
          selected: nextSelected,
          qty: nextSelected ? (current.qty > 0 ? current.qty : Math.min(1, b.main_stock)) : 0
        }
      };
    });
  };

  const handleQtyChange = (b: TransferBatchItem, value: string) => {
    const { isDisabled } = getBatchStatus(b);
    if (isDisabled) return;

    const val = parseInt(value, 10);
    const safeVal = isNaN(val) ? 0 : Math.max(0, Math.min(val, b.main_stock));
    setTransferSelections(prev => ({
      ...prev,
      [b.batch_id]: {
        selected: prev[b.batch_id]?.selected ?? true,
        qty: safeVal
      }
    }));
  };

  const selectedEntries = Object.entries(transferSelections)
    .filter(([batchIdStr, data]) => {
      if (!data.selected || data.qty <= 0) return false;
      const b = batches.find(item => item.batch_id === parseInt(batchIdStr, 10));
      return b && !getBatchStatus(b).isDisabled;
    });

  const totalSelectedItems = selectedEntries.length;
  const totalUnits = selectedEntries.reduce((acc, [_, data]) => acc + data.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSelectedItems === 0) {
      alert('Please select at least one valid medicine with available main stock to transfer.');
      return;
    }

    const confirmed = await confirm({
      title: 'Confirm Transfer to Drawer',
      message: `Are you sure you want to transfer ${totalUnits} total unit(s) across ${totalSelectedItems} item(s) to Drawer Inventory?`,
      confirmLabel: 'Transfer Now'
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const transferItems = selectedEntries.map(([batchIdStr, data]) => ({
        batch_id: parseInt(batchIdStr, 10),
        quantity: data.qty
      }));

      const res = await apiFetch('/api/index.php?route=inventory&action=transfer_to_drawer', {
        method: 'POST',
        body: JSON.stringify({
          transfers: transferItems
        })
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert(res.error || 'Failed to transfer items to Drawer.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred during transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header matching Clinic Page 3 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FiInbox className="text-[#A5192D]" /> Transfer to Drawer Inventory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select medicines and enter quantities to transfer from Main Inventory to Drawer Inventory.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter available main stock by medicine name, dosage, or lot number..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#A5192D] transition-all"
            />
          </div>
        </div>

        {/* Transfer Table List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div className="animate-spin w-8 h-8 border-2 border-[#A5192D] border-t-transparent rounded-full mx-auto mb-2" />
              Loading main inventory batches...
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FiCheckCircle className="text-3xl text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No inventory batches found</p>
              <p className="text-xs text-slate-400 mt-1">No batches match the current filter or search criteria.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">Select</th>
                    <th className="py-2.5 px-3">Medicine & Dosage</th>
                    <th className="py-2.5 px-3">LOT / Expiry</th>
                    <th className="py-2.5 px-3 text-center">In Main</th>
                    <th className="py-2.5 px-3 text-center">In Drawer</th>
                    <th className="py-2.5 px-3 text-center w-28">Transfer Qty</th>
                    <th className="py-2.5 px-3 text-center">Remaining Main</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map(b => {
                    const { isDisabled, reason } = getBatchStatus(b);
                    const selData = transferSelections[b.batch_id] || { selected: false, qty: 0 };
                    const isSelected = !isDisabled && selData.selected;
                    const transferQty = isDisabled ? 0 : selData.qty;
                    const remainingInMain = Math.max(0, b.main_stock - transferQty);

                    return (
                      <tr
                        key={b.batch_id}
                        className={`transition-colors ${
                          isDisabled
                            ? 'bg-slate-100/75 opacity-60 text-slate-400 cursor-not-allowed select-none'
                            : isSelected
                            ? 'bg-red-50/20'
                            : 'hover:bg-slate-50'
                        }`}
                        title={
                          reason === 'expired'
                            ? `Batch #${b.lot_number || b.batch_number || b.batch_id} is expired and cannot be transferred.`
                            : reason === 'out_of_stock'
                            ? 'No stock remaining in Main Inventory.'
                            : undefined
                        }
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => handleToggleSelect(b)}
                            className={`rounded border-slate-300 text-[#A5192D] focus:ring-[#A5192D] ${
                              isDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className={`font-semibold ${isDisabled ? 'text-slate-500' : 'text-slate-800'}`}>
                            {b.generic_name}
                            {b.dosage && <span className="ml-1 text-xs font-normal text-slate-400">({b.dosage})</span>}
                          </div>
                          {b.brand_name && (
                            <div className="text-[11px] text-slate-400">Brand: {b.brand_name}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          <div className="font-mono text-slate-600">{b.lot_number || 'N/A'}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {b.expired_on && (
                              <span className={reason === 'expired' ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                                Exp: {b.expired_on}
                              </span>
                            )}
                            {reason === 'expired' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 shadow-xs">
                                EXPIRED
                              </span>
                            )}
                            {reason === 'out_of_stock' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 border border-slate-300">
                                NO MAIN STOCK
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`font-bold px-2 py-0.5 rounded text-xs border ${
                            b.main_stock <= 0
                              ? 'text-slate-400 bg-slate-100 border-slate-200'
                              : 'text-blue-700 bg-blue-50 border-blue-100'
                          }`}>
                            {b.main_stock}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs">
                            {b.drawer_stock}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, b.main_stock)}
                            value={isDisabled ? 0 : transferQty}
                            disabled={isDisabled || !isSelected}
                            onChange={e => handleQtyChange(b, e.target.value)}
                            className="w-20 px-2 py-1 text-center font-bold text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D] disabled:bg-slate-100/80 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {isDisabled ? (
                            <span className="text-slate-300 text-xs italic">Disabled</span>
                          ) : isSelected ? (
                            <span className={remainingInMain === 0 ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                              {remainingInMain} pcs
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer matching Page 3 */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-600 flex items-center gap-2">
            <span className="font-semibold text-slate-800">{totalSelectedItems}</span> medicine(s) selected
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-[#A5192D]">{totalUnits}</span> total units ready to transfer
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || totalSelectedItems === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#A5192D] hover:bg-[#8c1526] rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiArrowRight className="text-sm" />
              {submitting ? 'Transferring...' : 'Confirm Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferToDrawerModal;
