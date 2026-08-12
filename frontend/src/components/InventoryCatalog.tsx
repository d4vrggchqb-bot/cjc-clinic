import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  FiPlus, 
  FiBox, 
  FiAlertCircle, 
  FiChevronDown, 
  FiChevronUp, 
  FiPlusCircle, 
  FiMinusCircle, 
  FiEdit3, 
  FiPrinter, 
  FiCheckCircle,
  FiClock,
  FiTool,
  FiSearch,
  FiFilter,
  FiEye,
  FiTrash2,
  FiArchive,
  FiActivity,
  FiX
} from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

interface InventoryItem {
  id: number;
  category: string;
  brand_name: string | null;
  generic_name: string;
  dosage: string | null;
  formulation: string | null;
  alert_threshold: number;
  overall_stock?: number;
  remaining_stock?: number;
  date_acquired?: string | null;
  date_purchased?: string | null;
  last_calibrated?: string | null;
  calibration_due?: string | null;
  calibration_notes?: string | null;
}

interface InventoryBatch {
  id: number;
  item_id: number;
  clinic_branch: string;
  batch_number: string | null;
  stock_remaining: number;
  initial_stock?: number;
  dispensed_qty?: number;
  disposed_qty?: number;
  date_arrived: string | null;
  expired_on: string | null;
  status: string;
}

interface BatchLog {
  id: number;
  batch_id: number;
  action_type: 'restock' | 'dispense' | 'dispose' | 'adjust';
  quantity_changed: number;
  disposed_to: string | null;
  patient_name?: string | null;
  processor_name?: string | null;
  created_at: string;
}

interface BatchDetailsData {
  batch: InventoryBatch & { generic_name?: string; brand_name?: string; category?: string; dosage?: string };
  summary: {
    initial_stock: number;
    dispensed_qty: number;
    disposed_qty: number;
    remaining_stock: number;
  };
  logs: BatchLog[];
}

const getDaysDifference = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const InventoryCatalog: React.FC = () => {
  const { confirm } = useConfirm();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  
  // Filter States
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'near_expiry' | 'calibration_due' | 'low_stock'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [calibrationCertItem, setCalibrationCertItem] = useState<InventoryItem | null>(null);
  
  // Modals state
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState<InventoryItem | null>(null);
  const [showAddBatch, setShowAddBatch] = useState<number | null>(null); // item_id
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [showDispense, setShowDispense] = useState<number | null>(null); // item_id
  
  // Batch Audit Details Modal State
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<BatchDetailsData | null>(null);
  const [isLoadingBatchDetails, setIsLoadingBatchDetails] = useState(false);

  // Batch Stock Disposal Modal State
  const [showDisposeModal, setShowDisposeModal] = useState<InventoryBatch | null>(null);
  const [disposeForm, setDisposeForm] = useState({ quantity: 1, reason: 'Expired / Unconsumed Disposal', disposed_to: 'CJC Hazardous Medical Waste Bin' });

  // Form States
  const [newItem, setNewItem] = useState({ category: 'medicine', customCategory: '', brand_name: '', generic_name: '', dosage: '', formulation: '', alert_threshold: 20 });
  const [editItemForm, setEditItemForm] = useState<InventoryItem | null>(null);
  const [newBatch, setNewBatch] = useState({ item_id: 0, clinic_branch: 'College Clinic', batch_number: '', stock_remaining: 1, date_arrived: '', expired_on: '' });
  const [editBatchData, setEditBatchData] = useState({ batch_id: 0, batch_number: '', date_arrived: '', expired_on: '', stock_remaining: 0 });
  const [dispenseData, setDispenseData] = useState({ clinic_branch: 'College Clinic', quantity: 1, disposed_to: '', reason: '' });

  const fetchData = async () => {
    try {
      const itemsRes = await apiFetch('/api/index.php?route=inventory&action=items');
      setItems(itemsRes.items || []);
      const batchesRes = await apiFetch('/api/index.php?route=inventory&action=batches&include_all=1');
      setBatches(batchesRes.batches || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRemainingStock = (itemId: number) => {
    return batches.filter(b => b.item_id === itemId && b.status !== 'depleted').reduce((sum, b) => sum + b.stock_remaining, 0);
  };

  const getOverallStock = (item: InventoryItem) => {
    const itemBatches = batches.filter(b => b.item_id === item.id);
    if (itemBatches.length === 0) return item.overall_stock || 0;
    const computedOverall = itemBatches.reduce((sum, b) => {
      const bInitial = b.initial_stock !== undefined ? b.initial_stock : (b.stock_remaining + (b.dispensed_qty || 0) + (b.disposed_qty || 0));
      return sum + bInitial;
    }, 0);
    return Math.max(computedOverall, item.overall_stock || 0, getRemainingStock(item.id));
  };

  const getEarliestExpiringBatch = (itemId: number) => {
    const activeBatches = batches.filter(b => b.item_id === itemId && b.stock_remaining > 0 && b.expired_on);
    if (activeBatches.length === 0) return null;
    return activeBatches.reduce((earliest, b) => {
      if (!earliest || (b.expired_on && b.expired_on < earliest.expired_on!)) {
        return b;
      }
      return earliest;
    }, activeBatches[0]);
  };

  const isItemNearlyExpired = (item: InventoryItem) => {
    const earliest = getEarliestExpiringBatch(item.id);
    if (!earliest || !earliest.expired_on) return false;
    const diff = getDaysDifference(earliest.expired_on);
    return diff !== null && diff <= 60;
  };

  const isItemCalibrationDue = (item: InventoryItem) => {
    if (!item.calibration_due && item.category !== 'equipment') return false;
    if (!item.calibration_due) return false;
    const diff = getDaysDifference(item.calibration_due);
    return diff !== null && diff <= 30;
  };

  const isItemLowStock = (item: InventoryItem) => {
    return getRemainingStock(item.id) <= item.alert_threshold;
  };

  // Live filter counters
  const counts = {
    all: items.length,
    nearExpiry: items.filter(isItemNearlyExpired).length,
    calibrationDue: items.filter(isItemCalibrationDue).length,
    lowStock: items.filter(isItemLowStock).length
  };

  const handleOpenBatchDetails = async (batchId: number) => {
    setIsLoadingBatchDetails(true);
    setShowBatchDetailsModal(true);
    try {
      const res = await apiFetch(`/api/index.php?route=inventory&action=batch_details&batch_id=${batchId}`);
      if (res.success) {
        setSelectedBatchDetails(res);
      } else {
        alert(res.error || 'Failed to fetch batch audit details');
        setShowBatchDetailsModal(false);
      }
    } catch (e) {
      console.error(e);
      alert('Error loading batch details');
      setShowBatchDetailsModal(false);
    } finally {
      setIsLoadingBatchDetails(false);
    }
  };

  const handleDisposeStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDisposeModal) return;

    const confirmed = await confirm({
      title: 'Dispose Unconsumed / Expired Stock',
      message: `Are you sure you want to dispose ${disposeForm.quantity} unit(s) of batch #${showDisposeModal.batch_number || showDisposeModal.id}?`,
      type: 'warning'
    });
    if (!confirmed) return;

    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=dispose_batch', {
        method: 'POST',
        body: JSON.stringify({
          batch_id: showDisposeModal.id,
          quantity: disposeForm.quantity,
          reason: disposeForm.reason,
          disposed_to: disposeForm.disposed_to || disposeForm.reason
        })
      });
      if (res.success) {
        alert(res.message || 'Stock disposed successfully');
        setShowDisposeModal(null);
        if (showBatchDetailsModal && selectedBatchDetails?.batch.id === showDisposeModal.id) {
          handleOpenBatchDetails(showDisposeModal.id);
        }
        fetchData();
      } else {
        alert(res.message || 'Failed to dispose stock');
      }
    } catch (err: any) {
      alert(err.message || 'Error disposing stock');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalCategory = newItem.category;
    if (finalCategory === 'other') {
      if (!newItem.customCategory || !newItem.customCategory.trim()) {
        alert('Please specify the category.');
        return;
      }
      finalCategory = newItem.customCategory.trim();
    }

    const payload = {
      ...newItem,
      category: finalCategory
    };

    const confirmed = await confirm({
      title: 'Save Item',
      message: 'Are you sure you want to save this new item to the catalog?',
      type: 'info'
    });
    if (!confirmed) return;
    try {
      await apiFetch('/api/index.php?route=inventory&action=add_item', { method: 'POST', body: JSON.stringify(payload) });
      setShowAddItem(false);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Failed to save item. An error occurred.');
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItemForm) return;

    const confirmed = await confirm({
      title: 'Update Catalog Item',
      message: 'Are you sure you want to update this item details & calibration info?',
      type: 'info'
    });
    if (!confirmed) return;

    try {
      await apiFetch('/api/index.php?route=inventory&action=update_item', {
        method: 'POST',
        body: JSON.stringify(editItemForm)
      });
      setShowEditItem(null);
      setEditItemForm(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating item');
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddBatch) return;
    const confirmed = await confirm({
      title: 'Add Batch',
      message: 'Are you sure you want to add this batch?',
      type: 'info'
    });
    if (!confirmed) return;
    await apiFetch('/api/index.php?route=inventory&action=add_batch', { 
      method: 'POST', 
      body: JSON.stringify({ ...newBatch, item_id: showAddBatch }) 
    });
    setShowAddBatch(null);
    setNewBatch({ item_id: 0, clinic_branch: 'College Clinic', batch_number: '', stock_remaining: 1, date_arrived: '', expired_on: '' });
    fetchData();
  };

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/index.php?route=inventory&action=edit_batch', { method: 'POST', body: JSON.stringify(editBatchData) });
      setShowEditBatch(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error editing batch');
    }
  };

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDispense) return;
    const confirmed = await confirm({
      title: 'Dispense Item',
      message: 'Are you sure you want to dispense this item?',
      type: 'warning'
    });
    if (!confirmed) return;
    try {
      const finalDisposedTo = dispenseData.reason.trim() ? `${dispenseData.disposed_to} - ${dispenseData.reason}` : dispenseData.disposed_to;
      await apiFetch('/api/index.php?route=inventory&action=dispense', { 
        method: 'POST', 
        body: JSON.stringify({ ...dispenseData, disposed_to: finalDisposedTo, item_id: showDispense }) 
      });
      alert('Dispensed successfully (FEFO logic applied)!');
      setShowDispense(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error dispensing');
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedItemId(prev => prev === id ? null : id);
  };

  // Filtered items computation
  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'other') {
        if (['medicine', 'supply', 'equipment'].includes(item.category)) return false;
      } else if (item.category !== categoryFilter) {
        return false;
      }
    }

    if (statusFilter === 'low_stock' && !isItemLowStock(item)) return false;
    if (statusFilter === 'near_expiry' && !isItemNearlyExpired(item)) return false;
    if (statusFilter === 'calibration_due' && !isItemCalibrationDue(item)) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesGeneric = (item.generic_name || '').toLowerCase().includes(term);
      const matchesBrand = (item.brand_name || '').toLowerCase().includes(term);
      const matchesDosage = (item.dosage || '').toLowerCase().includes(term);
      const matchesFormulation = (item.formulation || '').toLowerCase().includes(term);
      const matchesNotes = (item.calibration_notes || '').toLowerCase().includes(term);
      if (!matchesGeneric && !matchesBrand && !matchesDosage && !matchesFormulation && !matchesNotes) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center">
          <FiBox className="mr-2" /> Catalog Items
        </h2>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-red-700 bg-white"
            />
          </div>
          
          {/* Category Dropdown */}
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-300 text-sm rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:border-red-700 bg-white"
          >
            <option value="all">All Categories</option>
            <option value="medicine">Medicine</option>
            <option value="supply">Supplies</option>
            <option value="equipment">Equipments</option>
            <option value="other">Others</option>
          </select>

          <button onClick={() => setShowAddItem(true)} className="bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 flex items-center text-sm font-medium shadow-sm transition-colors shrink-0">
            <FiPlus className="mr-1" /> New Catalog Item
          </button>
        </div>
      </div>

      {/* Quick Filter Status Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        <span className="text-slate-500 flex items-center gap-1 mr-1 text-slate-400">
          <FiFilter size={14} /> Filter Status:
        </span>
        
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter === 'all'
              ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Items ({counts.all})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('near_expiry')}
          className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter === 'near_expiry'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : counts.nearExpiry > 0
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FiClock size={13} /> Nearly Expired ({counts.nearExpiry})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('calibration_due')}
          className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter === 'calibration_due'
              ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
              : counts.calibrationDue > 0
              ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 font-bold'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FiTool size={13} /> Calibration Due ({counts.calibrationDue})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('low_stock')}
          className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter === 'low_stock'
              ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
              : counts.lowStock > 0
              ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 font-bold'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FiAlertCircle size={13} /> Low Stock ({counts.lowStock})
        </button>
      </div>

      {/* Catalog Table */}
      <div className="overflow-auto flex-1 border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Item Name</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Overall Stock</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Remaining Stock</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Alert / Status</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 italic text-sm">
                  No catalog items found matching the selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const overallStock = getOverallStock(item);
                const remainingStock = getRemainingStock(item.id);
                const isLowStock = isItemLowStock(item);
                const isExpanded = expandedItemId === item.id;
                const itemBatches = batches.filter(b => b.item_id === item.id);
                
                const earliestBatch = getEarliestExpiringBatch(item.id);
                const expiryDiffDays = earliestBatch ? getDaysDifference(earliestBatch.expired_on) : null;
                
                const isEquipment = item.category === 'equipment' || !!item.calibration_due;
                const calibDiffDays = getDaysDifference(item.calibration_due);

                return (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleExpand(item.id)}>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{item.generic_name}</div>
                        <div className="text-xs text-slate-500">
                          {item.brand_name || 'No Brand'} 
                          {item.dosage ? ` - ${item.dosage}` : ''}
                          {item.formulation ? ` (${item.formulation})` : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md capitalize font-medium">{item.category}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-700 text-sm">
                          {overallStock}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <span className={`font-bold text-sm ${isLowStock ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {remainingStock}
                          </span>
                          {isLowStock && <FiAlertCircle className="ml-1.5 text-orange-500" title="Low Stock Alert" />}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {/* Expiry Status Badge */}
                          {earliestBatch && expiryDiffDays !== null && (
                            expiryDiffDays <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                <FiClock size={11} /> Expired ({earliestBatch.expired_on})
                              </span>
                            ) : expiryDiffDays <= 60 ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                <FiClock size={11} /> Expiring in {expiryDiffDays}d
                              </span>
                            ) : null
                          )}

                          {/* Calibration Status Badge */}
                          {isEquipment && calibDiffDays !== null && (
                            calibDiffDays <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 inline-flex items-center gap-1">
                                <FiTool size={11} /> Calib. Overdue ({item.calibration_due})
                              </span>
                            ) : calibDiffDays <= 30 ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                <FiTool size={11} /> Calib. Due in {calibDiffDays}d
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                <FiCheckCircle size={11} /> Calibrated
                              </span>
                            )
                          )}

                          {/* Default status when everything is fine */}
                          {(!earliestBatch || expiryDiffDays === null || expiryDiffDays > 60) && (!isEquipment || calibDiffDays === null) && !isLowStock && (
                            <span className="text-slate-400 text-xs italic">Normal</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {item.category === 'equipment' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCalibrationCertItem(item); }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-bold mr-1 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Print Annual Calibration Certificate"
                          >
                            <FiPrinter size={12} /> Cert
                          </button>
                        )}

                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setShowEditItem(item); 
                            setEditItemForm({ ...item }); 
                          }} 
                          className="text-slate-600 hover:text-slate-900 p-1 mx-1" 
                          title="Edit Item Details & Calibration"
                        >
                          <FiEdit3 size={16} />
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); setShowAddBatch(item.id); }} className="text-emerald-600 hover:text-emerald-800 p-1 mx-1" title="Restock (Add Batch)">
                          <FiPlusCircle size={18} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowDispense(item.id); }} className="text-blue-600 hover:text-blue-800 p-1 mx-1" title="Dispense (FEFO)">
                          <FiMinusCircle size={18} />
                        </button>
                        {isExpanded ? <FiChevronUp className="inline ml-2" /> : <FiChevronDown className="inline ml-2" />}
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <td colSpan={6} className="p-4">
                          <div className="bg-white rounded-md border border-slate-200 p-3 shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <FiArchive /> Batch Audit & Stock History
                              </h4>
                              {isEquipment && (
                                <div className="text-xs text-slate-500">
                                  <span className="font-medium">Last Calibrated:</span> {item.last_calibrated || 'N/A'} | <span className="font-medium">Next Due:</span> {item.calibration_due || 'N/A'}
                                </div>
                              )}
                            </div>
                            {itemBatches.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">No batches recorded for this item yet.</p>
                            ) : (
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-100 bg-slate-50/50">
                                    <th className="p-2">Branch</th>
                                    <th className="p-2">Batch #</th>
                                    <th className="p-2 text-center">Initial Stock</th>
                                    <th className="p-2 text-center">Dispensed</th>
                                    <th className="p-2 text-center">Expired / Disposed</th>
                                    <th className="p-2 text-center">Remaining</th>
                                    <th className="p-2">Arrived</th>
                                    <th className="p-2">Expiry</th>
                                    <th className="p-2">Status</th>
                                    <th className="p-2 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemBatches.map(b => {
                                    const bDiff = getDaysDifference(b.expired_on);
                                    const isBatchExpired = bDiff !== null && bDiff <= 0;
                                    const isBatchNear = bDiff !== null && bDiff > 0 && bDiff <= 60;
                                    const dispensed = b.dispensed_qty || 0;
                                    const disposed = b.disposed_qty || 0;
                                    const initial = b.initial_stock !== undefined ? b.initial_stock : (b.stock_remaining + dispensed + disposed);

                                    return (
                                      <tr 
                                        key={b.id} 
                                        onClick={() => handleOpenBatchDetails(b.id)}
                                        className="border-b border-slate-100 hover:bg-slate-100/80 transition-colors cursor-pointer"
                                        title="Click to view detailed batch trace audit & disposal logs"
                                      >
                                        <td className="p-2 font-medium">{b.clinic_branch}</td>
                                        <td className="p-2 font-mono font-bold text-slate-700">#{b.batch_number || b.id}</td>
                                        <td className="p-2 text-center font-medium text-slate-600">{initial}</td>
                                        <td className="p-2 text-center font-bold text-blue-600">{dispensed}</td>
                                        <td className="p-2 text-center font-bold text-rose-600">{disposed}</td>
                                        <td className="p-2 text-center font-bold text-slate-900">{b.stock_remaining}</td>
                                        <td className="p-2 text-slate-500">{b.date_arrived || 'N/A'}</td>
                                        <td className="p-2">
                                          <span className={isBatchExpired ? 'text-rose-600 font-bold' : isBatchNear ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                                            {b.expired_on || 'N/A'}
                                          </span>
                                        </td>
                                        <td className="p-2">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                            b.stock_remaining === 0 || b.status === 'depleted'
                                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                              : isBatchExpired || b.status === 'expired'
                                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}>
                                            {b.stock_remaining === 0 ? 'depleted' : b.status}
                                          </span>
                                        </td>
                                        <td className="p-2 text-right space-x-1" onClick={e => e.stopPropagation()}>
                                          <button 
                                            type="button"
                                            onClick={() => handleOpenBatchDetails(b.id)}
                                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                                            title="View Full Batch Trace Audit & Logs"
                                          >
                                            <FiEye size={12} /> Details
                                          </button>

                                          {b.stock_remaining > 0 && (
                                            <button 
                                              type="button"
                                              onClick={() => {
                                                setShowDisposeModal(b);
                                                setDisposeForm({ quantity: b.stock_remaining, reason: 'Expired / Unconsumed Disposal', disposed_to: 'CJC Hazardous Medical Waste Bin' });
                                              }}
                                              className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                                              title="Dispose Unconsumed / Expired Stock"
                                            >
                                              <FiTrash2 size={12} /> Dispose
                                            </button>
                                          )}

                                          <button onClick={() => {
                                            setEditBatchData({
                                              batch_id: b.id,
                                              batch_number: b.batch_number || '',
                                              date_arrived: b.date_arrived || '',
                                              expired_on: b.expired_on || '',
                                              stock_remaining: b.stock_remaining
                                            });
                                            setShowEditBatch(true);
                                          }} className="text-slate-500 hover:text-slate-800 p-1" title="Edit Batch">
                                            <FiEdit3 size={13} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Batch Details & Audit Modal */}
      {showBatchDetailsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FiActivity className="text-blue-400 text-lg" />
                <div>
                  <h3 className="font-bold text-base leading-tight">Batch Audit & Traceability Report</h3>
                  <p className="text-xs text-slate-300">Detailed consumption, disposal, and transaction log</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowBatchDetailsModal(false); setSelectedBatchDetails(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {isLoadingBatchDetails ? (
                <div className="py-12 text-center text-slate-500 font-medium animate-pulse">
                  Loading batch traceability details...
                </div>
              ) : selectedBatchDetails ? (
                <>
                  {/* Batch Banner Header */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Batch Number</span>
                      <h4 className="text-lg font-black text-slate-900 font-mono">#{selectedBatchDetails.batch.batch_number || selectedBatchDetails.batch.id}</h4>
                      <p className="text-xs text-slate-600 font-medium">
                        {selectedBatchDetails.batch.generic_name} {selectedBatchDetails.batch.brand_name ? `(${selectedBatchDetails.batch.brand_name})` : ''} 
                        {selectedBatchDetails.batch.dosage ? ` - ${selectedBatchDetails.batch.dosage}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-xs space-y-1">
                      <div><span className="text-slate-500">Branch:</span> <strong className="text-slate-800">{selectedBatchDetails.batch.clinic_branch}</strong></div>
                      <div><span className="text-slate-500">Arrived:</span> <strong className="text-slate-800">{selectedBatchDetails.batch.date_arrived || 'N/A'}</strong></div>
                      <div><span className="text-slate-500">Expiry Date:</span> <strong className="text-rose-700 font-bold">{selectedBatchDetails.batch.expired_on || 'N/A'}</strong></div>
                    </div>
                  </div>

                  {/* 4 Metric Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase block">Initial Received</span>
                      <strong className="text-xl font-black text-slate-800">{selectedBatchDetails.summary.initial_stock}</strong>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Total units restocked</span>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                      <span className="text-[11px] font-semibold text-blue-700 uppercase block">Total Dispensed</span>
                      <strong className="text-xl font-black text-blue-700">{selectedBatchDetails.summary.dispensed_qty}</strong>
                      <span className="text-[10px] text-blue-500 block mt-0.5">Consumed by patients</span>
                    </div>

                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                      <span className="text-[11px] font-semibold text-rose-700 uppercase block">Expired / Disposed</span>
                      <strong className="text-xl font-black text-rose-700">{selectedBatchDetails.summary.disposed_qty}</strong>
                      <span className="text-[10px] text-rose-500 block mt-0.5">Unconsumed / Disposed</span>
                    </div>

                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Current Stock</span>
                      <strong className="text-xl font-black text-emerald-700">{selectedBatchDetails.summary.remaining_stock}</strong>
                      <span className="text-[10px] text-emerald-500 block mt-0.5">Active remaining</span>
                    </div>
                  </div>

                  {/* Disposal Destination Alert Box */}
                  {selectedBatchDetails.summary.disposed_qty > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-1">
                      <h5 className="font-bold flex items-center gap-1.5 text-amber-800">
                        <FiTrash2 className="text-amber-600" /> Disposal Logged & Verified
                      </h5>
                      <p className="text-amber-700">
                        {selectedBatchDetails.summary.disposed_qty} unit(s) of this batch were expired/unconsumed and moved to disposal.
                      </p>
                      {selectedBatchDetails.logs.filter(l => l.action_type === 'dispose').map((l, idx) => (
                        <div key={idx} className="bg-white/80 p-2 rounded border border-amber-200/60 text-slate-800 font-mono text-[11px] mt-1">
                          <span className="text-slate-500">{l.created_at}:</span> <strong>{Math.abs(l.quantity_changed)} units</strong> → Disposed To / Reason: <span className="text-rose-700 font-bold">{l.disposed_to || 'Hazardous Waste Bin'}</span> (By: {l.processor_name || 'Staff'})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Transaction History Log Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FiClock /> Audit Log History ({selectedBatchDetails.logs.length})
                    </h4>
                    {selectedBatchDetails.logs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg text-center">No transaction logs recorded for this batch.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                            <tr>
                              <th className="p-2.5">Date & Time</th>
                              <th className="p-2.5">Action</th>
                              <th className="p-2.5 text-center">Quantity</th>
                              <th className="p-2.5">Recipient / Disposed To / Details</th>
                              <th className="p-2.5 text-right">Processed By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedBatchDetails.logs.map(log => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-500 font-mono text-[11px]">{log.created_at}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                    log.action_type === 'restock' ? 'bg-emerald-100 text-emerald-800' :
                                    log.action_type === 'dispense' ? 'bg-blue-100 text-blue-800' :
                                    log.action_type === 'dispose' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {log.action_type}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center font-bold font-mono">
                                  <span className={log.quantity_changed > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                    {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-700">
                                  {log.disposed_to || log.patient_name || 'Stock Adjustment'}
                                </td>
                                <td className="p-2.5 text-right text-slate-500 font-medium">
                                  {log.processor_name || 'System'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {selectedBatchDetails && selectedBatchDetails.batch.stock_remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowDisposeModal(selectedBatchDetails.batch);
                    setDisposeForm({ quantity: selectedBatchDetails.batch.stock_remaining, reason: 'Expired / Unconsumed Disposal', disposed_to: 'CJC Hazardous Medical Waste Bin' });
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <FiTrash2 /> Dispose Unconsumed Stock
                </button>
              ) : <div></div>}

              <button
                type="button"
                onClick={() => { setShowBatchDetailsModal(false); setSelectedBatchDetails(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispose Unconsumed Stock Modal */}
      {showDisposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <FiTrash2 className="text-xl" />
              <h3 className="text-lg font-bold">Dispose Expired / Unconsumed Stock</h3>
            </div>
            <p className="text-xs text-slate-500">
              Log stock disposal for batch <strong className="text-slate-800 font-mono">#{showDisposeModal.batch_number || showDisposeModal.id}</strong>. This will deduct stock and record disposal details.
            </p>

            <form onSubmit={handleDisposeStock} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Quantity to Dispose <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  max={showDisposeModal.stock_remaining} 
                  className="w-full border p-2 rounded text-sm" 
                  value={disposeForm.quantity} 
                  onChange={e => setDisposeForm({ ...disposeForm, quantity: parseInt(e.target.value) || 1 })} 
                />
                <span className="text-[11px] text-slate-400">Available remaining: {showDisposeModal.stock_remaining}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Disposal Reason / Remarks</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border p-2 rounded text-sm" 
                  value={disposeForm.reason} 
                  onChange={e => setDisposeForm({ ...disposeForm, reason: e.target.value })} 
                  placeholder="e.g. Expired Medicine, Damaged Packaging" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Disposal Destination / Location <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="text" 
                  className="w-full border p-2 rounded text-sm" 
                  value={disposeForm.disposed_to} 
                  onChange={e => setDisposeForm({ ...disposeForm, disposed_to: e.target.value })} 
                  placeholder="e.g. CJC Biohazard Medical Waste Bin, Supplier Return" 
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setShowDisposeModal(null)} className="px-4 py-2 border rounded text-xs">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold">Confirm Disposal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Add New Catalog Item</h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select className="w-full border p-2 rounded" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value as any})}>
                  <option value="medicine">Medicine</option>
                  <option value="supply">Supply</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Others</option>
                </select>
              </div>
              {newItem.category === 'other' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Specify Category <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full border p-2 rounded" value={newItem.customCategory || ''} onChange={e => setNewItem({...newItem, customCategory: e.target.value})} placeholder="Please specify category" />
                </div>
              )}
              {/* Conditional Fields based on Category */}
              {newItem.category === 'medicine' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Generic Name <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full border p-2 rounded" value={newItem.generic_name} onChange={e => setNewItem({...newItem, generic_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Brand Name <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full border p-2 rounded" value={newItem.brand_name} onChange={e => setNewItem({...newItem, brand_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dosage (e.g. 500mg)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.dosage} onChange={e => setNewItem({...newItem, dosage: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Formulation / Unit (e.g. Tablet, Syrup, Box)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.formulation} onChange={e => setNewItem({...newItem, formulation: e.target.value})} />
                  </div>
                </>
              )}

              {newItem.category === 'supply' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Supply Name <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full border p-2 rounded" value={newItem.generic_name} onChange={e => setNewItem({...newItem, generic_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Brand Name (Optional)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.brand_name} onChange={e => setNewItem({...newItem, brand_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unit / Measurement (e.g. Box, Pcs, Roll)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.formulation} onChange={e => setNewItem({...newItem, formulation: e.target.value})} />
                  </div>
                </>
              )}

              {newItem.category === 'equipment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Equipment / Apparatus Name <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full border p-2 rounded" value={newItem.generic_name} onChange={e => setNewItem({...newItem, generic_name: e.target.value})} placeholder="e.g. Digital BP Apparatus, Otoscope" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Brand / Model (Optional)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.brand_name || ''} onChange={e => setNewItem({...newItem, brand_name: e.target.value})} placeholder="e.g. Omron HEM-7120" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Date Purchased</label>
                      <input type="date" className="w-full border p-2 rounded text-xs" value={newItem.date_purchased || ''} onChange={e => setNewItem({...newItem, date_purchased: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Date Acquired</label>
                      <input type="date" className="w-full border p-2 rounded text-xs" value={newItem.date_acquired || ''} onChange={e => setNewItem({...newItem, date_acquired: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Last Calibrated</label>
                      <input type="date" className="w-full border p-2 rounded text-xs" value={newItem.last_calibrated || ''} onChange={e => setNewItem({...newItem, last_calibrated: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Next Calibration Due</label>
                      <input type="date" className="w-full border p-2 rounded text-xs" value={newItem.calibration_due || ''} onChange={e => setNewItem({...newItem, calibration_due: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Calibration Notes / Cert No.</label>
                    <input type="text" className="w-full border p-2 rounded text-xs" value={newItem.calibration_notes || ''} onChange={e => setNewItem({...newItem, calibration_notes: e.target.value})} placeholder="e.g. Calibrated by Biomedical Tech, Cert #CAL-2026-88" />
                  </div>
                </>
              )}

              {newItem.category === 'other' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Item Name <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full border p-2 rounded" value={newItem.generic_name} onChange={e => setNewItem({...newItem, generic_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description / Brand (Optional)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.brand_name} onChange={e => setNewItem({...newItem, brand_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unit / Measurement (Optional)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.formulation} onChange={e => setNewItem({...newItem, formulation: e.target.value})} />
                  </div>
                </>
              )}
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" onClick={() => setShowAddItem(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-700 text-white rounded text-sm font-medium">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item & Calibration Modal */}
      {showEditItem && editItemForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Edit Item Details & Calibration</h3>
            <form onSubmit={handleUpdateItem} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Generic / Item Name <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full border p-2 rounded text-sm" value={editItemForm.generic_name} onChange={e => setEditItemForm({...editItemForm, generic_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Brand Name</label>
                <input type="text" className="w-full border p-2 rounded text-sm" value={editItemForm.brand_name || ''} onChange={e => setEditItemForm({...editItemForm, brand_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Dosage</label>
                  <input type="text" className="w-full border p-2 rounded text-xs" value={editItemForm.dosage || ''} onChange={e => setEditItemForm({...editItemForm, dosage: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Formulation / Unit</label>
                  <input type="text" className="w-full border p-2 rounded text-xs" value={editItemForm.formulation || ''} onChange={e => setEditItemForm({...editItemForm, formulation: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Low Stock Alert Threshold</label>
                <input type="number" min="0" className="w-full border p-2 rounded text-xs" value={editItemForm.alert_threshold} onChange={e => setEditItemForm({...editItemForm, alert_threshold: parseInt(e.target.value) || 0})} />
              </div>

              {/* Equipment Calibration Section */}
              <div className="border-t pt-3 mt-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1">
                  <FiTool className="text-blue-600" /> Equipment Calibration Info
                </h4>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Last Calibrated</label>
                    <input type="date" className="w-full border p-2 rounded text-xs" value={editItemForm.last_calibrated || ''} onChange={e => setEditItemForm({...editItemForm, last_calibrated: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Calibration Due</label>
                    <input type="date" className="w-full border p-2 rounded text-xs" value={editItemForm.calibration_due || ''} onChange={e => setEditItemForm({...editItemForm, calibration_due: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Calibration Notes / Cert Details</label>
                  <textarea rows={2} className="w-full border p-2 rounded text-xs" value={editItemForm.calibration_notes || ''} onChange={e => setEditItemForm({...editItemForm, calibration_notes: e.target.value})} placeholder="Calibration certificate # or technician notes..." />
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-4 pt-2 border-t">
                <button type="button" onClick={() => { setShowEditItem(null); setEditItemForm(null); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Restock (Add Batch)</h3>
            <form onSubmit={handleAddBatch} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Clinic Branch</label>
                <select className="w-full border p-2 rounded" value={newBatch.clinic_branch} onChange={e => setNewBatch({...newBatch, clinic_branch: e.target.value})}>
                  <option value="College Clinic">College Clinic</option>
                  <option value="BED Clinic">BED Clinic</option>
                  <option value="Power Campus Clinic">Power Campus Clinic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity <span className="text-red-500">*</span></label>
                <input required type="number" min="1" className="w-full border p-2 rounded" value={newBatch.stock_remaining} onChange={e => setNewBatch({...newBatch, stock_remaining: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Batch Number</label>
                <input type="text" className="w-full border p-2 rounded" value={newBatch.batch_number} onChange={e => setNewBatch({...newBatch, batch_number: e.target.value})} />
              </div>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Date Arrived</label>
                  <input type="date" className="w-full border p-2 rounded" value={newBatch.date_arrived} onChange={e => setNewBatch({...newBatch, date_arrived: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Expiry Date</label>
                  <input type="date" className="w-full border p-2 rounded" value={newBatch.expired_on} onChange={e => setNewBatch({...newBatch, expired_on: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" onClick={() => setShowAddBatch(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">Add Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {showDispense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Dispense Item (FEFO)</h3>
            <p className="text-xs text-slate-500 mb-4">The system will automatically deduct from the batch that expires first in the selected clinic.</p>
            <form onSubmit={handleDispense} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">From Clinic Branch</label>
                <select className="w-full border p-2 rounded" value={dispenseData.clinic_branch} onChange={e => setDispenseData({...dispenseData, clinic_branch: e.target.value})}>
                  <option value="College Clinic">College Clinic</option>
                  <option value="BED Clinic">BED Clinic</option>
                  <option value="Power Campus Clinic">Power Campus Clinic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity to Dispense <span className="text-red-500">*</span></label>
                <input required type="number" min="1" className="w-full border p-2 rounded" value={dispenseData.quantity} onChange={e => setDispenseData({...dispenseData, quantity: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Disposed To (Patient Name) <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g. John Doe" className="w-full border p-2 rounded" value={dispenseData.disposed_to} onChange={e => setDispenseData({...dispenseData, disposed_to: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                <input type="text" placeholder="e.g. Headache, Fever" className="w-full border p-2 rounded" value={dispenseData.reason} onChange={e => setDispenseData({...dispenseData, reason: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" onClick={() => setShowDispense(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Dispense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {showEditBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Edit Batch</h3>
            <form onSubmit={handleEditBatch} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Batch Number</label>
                <input type="text" className="w-full border p-2 rounded" value={editBatchData.batch_number} onChange={e => setEditBatchData({...editBatchData, batch_number: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock Remaining <span className="text-red-500">*</span></label>
                <input required type="number" min="0" className="w-full border p-2 rounded" value={editBatchData.stock_remaining} onChange={e => setEditBatchData({...editBatchData, stock_remaining: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Arrived</label>
                <input type="date" className="w-full border p-2 rounded" value={editBatchData.date_arrived} onChange={e => setEditBatchData({...editBatchData, date_arrived: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiry Date</label>
                <input type="date" className="w-full border p-2 rounded" value={editBatchData.expired_on} onChange={e => setEditBatchData({...editBatchData, expired_on: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" onClick={() => setShowEditBatch(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Annual Calibration Certificate Modal */}
      {calibrationCertItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center no-print">
              <span className="font-bold text-sm flex items-center gap-2">
                <FiCheckCircle className="text-emerald-400" /> Printable Equipment Calibration Certificate
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <FiPrinter /> Print Certificate
                </button>
                <button
                  onClick={() => setCalibrationCertItem(null)}
                  className="text-slate-400 hover:text-white font-bold text-xl px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 overflow-y-auto bg-white text-slate-800 space-y-6">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h2 className="text-xl font-black uppercase text-[#8c1526]">Cor Jesu College Health Services Clinic</h2>
                <p className="text-xs text-slate-600 uppercase tracking-widest">Biomedical Equipment & Medical Apparatus Inspection</p>
                <h1 className="text-2xl font-serif font-black uppercase tracking-wider text-slate-900 mt-4">Annual Calibration Certificate</h1>
                <p className="text-xs text-slate-500 font-mono">Cert No: CAL-{new Date().getFullYear()}-{String(calibrationCertItem.id).padStart(5, '0')}</p>
              </div>

              {/* Apparatus Details */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <h3 className="font-extrabold uppercase tracking-wider text-slate-700">Apparatus Information</h3>
                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div><span className="text-slate-500">Equipment Name:</span> <strong className="text-slate-900 font-bold">{calibrationCertItem.generic_name}</strong></div>
                  <div><span className="text-slate-500">Brand / Model:</span> <strong className="text-slate-900 font-bold">{calibrationCertItem.brand_name || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">Date Acquired:</span> <strong className="text-slate-900 font-bold">{calibrationCertItem.date_acquired || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">Date Purchased:</span> <strong className="text-slate-900 font-bold">{calibrationCertItem.date_purchased || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">Last Calibrated:</span> <strong className="text-emerald-700 font-bold">{calibrationCertItem.last_calibrated || new Date().toISOString().split('T')[0]}</strong></div>
                  <div><span className="text-slate-500">Next Calibration Due:</span> <strong className="text-amber-700 font-bold">{calibrationCertItem.calibration_due || 'N/A'}</strong></div>
                </div>
              </div>

              {/* Inspection Status Banner */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-900 space-y-1">
                <h4 className="font-bold uppercase tracking-wide flex items-center gap-1.5 text-emerald-800">
                  <FiCheckCircle className="text-emerald-600" /> Calibration Status: PASSED & VERIFIED
                </h4>
                <p className="text-emerald-700">
                  This apparatus has undergone standard biomedical inspection and functionality testing. It meets accuracy and clinical precision standards for health services administration.
                </p>
                {calibrationCertItem.calibration_notes && (
                  <p className="font-medium text-slate-700 pt-1">
                    <span className="text-slate-500">Notes / Remarks:</span> {calibrationCertItem.calibration_notes}
                  </p>
                )}
              </div>

              {/* Signatures Footer */}
              <div className="pt-10 flex justify-between items-end text-xs">
                <div className="w-40 h-20 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-center p-2 text-slate-400 text-[10px] uppercase font-bold">
                  Clinic Seal & Stamp
                </div>
                <div className="text-center w-64">
                  <div className="border-b-2 border-slate-900 mb-1 pb-1 font-bold text-slate-900 uppercase">Registered Biomedical Tech / Nurse</div>
                  <div className="text-[10px] text-slate-500">Cor Jesu College Health Services</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryCatalog;
