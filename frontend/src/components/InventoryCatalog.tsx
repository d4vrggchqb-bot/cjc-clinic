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
  FiX,
  FiUploadCloud,
  FiFileText,
  FiDownload,
  FiExternalLink,
  FiPaperclip
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
  latest_cert_url?: string | null;
  latest_cert_filename?: string | null;
  latest_cert_type?: string | null;
  latest_calibrated_by?: string | null;
  cert_count?: number;
}

interface EquipmentCalibration {
  id: number;
  item_id: number;
  batch_id?: number | null;
  batch_number?: string | null;
  clinic_branch?: string | null;
  cert_type: 'external_upload' | 'internal_generated';
  calibrated_by: string | null;
  cert_number: string | null;
  calibration_date: string | null;
  due_date: string | null;
  file_url: string | null;
  filename: string | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
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
  last_calibrated?: string | null;
  calibration_due?: string | null;
  calibration_notes?: string | null;
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
  
  // Calibration Management State
  const [showUploadCertItem, setShowUploadCertItem] = useState<InventoryItem | null>(null);
  const [showCalibHistoryItem, setShowCalibHistoryItem] = useState<InventoryItem | null>(null);
  const [calibHistoryList, setCalibHistoryList] = useState<EquipmentCalibration[]>([]);
  const [isLoadingCalibHistory, setIsLoadingCalibHistory] = useState(false);
  const [isSubmittingCalib, setIsSubmittingCalib] = useState(false);

  const [uploadCalibForm, setUploadCalibForm] = useState({
    batch_id: null as number | null,
    calibrated_by: '',
    cert_number: '',
    calibration_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    file: null as File | null
  });

  // Calibration Certificate Generator Form State
  const [showCalibFormItem, setShowCalibFormItem] = useState<InventoryItem | null>(null);
  const [certFormDetails, setCertFormDetails] = useState({
    batch_id: null as number | null,
    equipment_name: '',
    brand_name: '',
    formulation: '',
    date_acquired: '',
    last_calibrated: new Date().toISOString().split('T')[0],
    calibration_due: '',
    control_no: '',
    inspector_name: 'Registered Biomedical Tech / Clinic Nurse',
    inspector_position: 'Cor Jesu College Health Services Clinic',
    notes: ''
  });




  
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
  const [newBatch, setNewBatch] = useState({ item_id: 0, clinic_branch: 'College Clinic', batch_number: '', stock_remaining: 1, date_arrived: '', expired_on: '', last_calibrated: '', calibration_due: '', calibration_notes: '' });
  const [editBatchData, setEditBatchData] = useState({ batch_id: 0, batch_number: '', date_arrived: '', expired_on: '', stock_remaining: 0, last_calibrated: '', calibration_due: '', calibration_notes: '' });

  const [dispenseData, setDispenseData] = useState({ clinic_branch: 'College Clinic', quantity: 1, disposed_to: '', reason: '' });

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

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

  const batchesByItemId = React.useMemo(() => {
    const map = new Map<number, InventoryBatch[]>();
    for (const b of batches) {
      if (selectedBranchFilter !== 'all' && b.clinic_branch !== selectedBranchFilter) {
        continue;
      }
      const list = map.get(b.item_id) || [];
      list.push(b);
      map.set(b.item_id, list);
    }
    return map;
  }, [batches, selectedBranchFilter]);

  const getRemainingStock = (itemId: number) => {
    const itemBatches = batchesByItemId.get(itemId) || [];
    return itemBatches.filter(b => b.status !== 'depleted').reduce((sum, b) => sum + b.stock_remaining, 0);
  };

  const getOverallStock = (item: InventoryItem) => {
    const itemBatches = batchesByItemId.get(item.id) || [];
    if (itemBatches.length === 0) return item.overall_stock || 0;
    const computedOverall = itemBatches.reduce((sum, b) => {
      const bInitial = b.initial_stock !== undefined ? b.initial_stock : (b.stock_remaining + (b.dispensed_qty || 0) + (b.disposed_qty || 0));
      return sum + bInitial;
    }, 0);
    return Math.max(computedOverall, item.overall_stock || 0, getRemainingStock(item.id));
  };

  const getEarliestExpiringBatch = (itemId: number) => {
    const itemBatches = batchesByItemId.get(itemId) || [];
    const activeBatches = itemBatches.filter(b => b.stock_remaining > 0 && b.expired_on);
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
    if (item.category !== 'equipment' || !item.calibration_due) return false;
    const diff = getDaysDifference(item.calibration_due);
    return diff !== null && diff <= 30;
  };

  const isItemLowStock = (item: InventoryItem) => {
    return getRemainingStock(item.id) <= item.alert_threshold;
  };

  // Live filter counters memoized
  const counts = React.useMemo(() => ({
    all: items.length,
    nearExpiry: items.filter(isItemNearlyExpired).length,
    calibrationDue: items.filter(isItemCalibrationDue).length,
    lowStock: items.filter(isItemLowStock).length
  }), [items, batchesByItemId]);

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


  const fetchCalibHistory = async (itemId: number) => {
    setIsLoadingCalibHistory(true);
    try {
      const res = await apiFetch(`/api/index.php?route=inventory&action=get_calibrations&item_id=${itemId}`);
      if (res.success && res.calibrations) {
        setCalibHistoryList(res.calibrations);
      }
    } catch (e) {
      console.error('Failed to load calibration history', e);
    } finally {
      setIsLoadingCalibHistory(false);
    }
  };

  const handleOpenCalibHistory = (item: InventoryItem) => {
    setShowCalibHistoryItem(item);
    fetchCalibHistory(item.id);
  };

  const handleOpenCalibCertForm = (item: InventoryItem, selectedBatch?: InventoryBatch) => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setCertFormDetails({
      batch_id: selectedBatch ? selectedBatch.id : null,
      equipment_name: item.generic_name,
      brand_name: item.brand_name || '',
      formulation: item.formulation || 'Standard Clinical Grade',
      date_acquired: item.date_acquired || '',
      last_calibrated: selectedBatch?.last_calibrated || item.last_calibrated || new Date().toISOString().split('T')[0],
      calibration_due: selectedBatch?.calibration_due || item.calibration_due || nextYear.toISOString().split('T')[0],
      control_no: `CAL-${new Date().getFullYear()}-${selectedBatch ? ('B' + selectedBatch.id) : String(item.id).padStart(5, '0')}`,
      inspector_name: item.latest_calibrated_by || 'Registered Biomedical Tech / Clinic Nurse',
      inspector_position: 'Cor Jesu College Health Services Clinic',
      notes: selectedBatch?.calibration_notes || item.calibration_notes || ''
    });
    setShowCalibFormItem(item);
  };

  const handleGeneratePreviewFromForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCalibFormItem) return;
    setCalibrationCertItem(showCalibFormItem);
    setShowCalibFormItem(null);
  };

  const handleOpenUploadCert = (item: InventoryItem, selectedBatch?: InventoryBatch) => {
    setShowUploadCertItem(item);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setUploadCalibForm({
      batch_id: selectedBatch ? selectedBatch.id : null,
      calibrated_by: item.latest_calibrated_by || '',
      cert_number: '',
      calibration_date: selectedBatch?.last_calibrated || item.last_calibrated || new Date().toISOString().split('T')[0],
      due_date: selectedBatch?.calibration_due || item.calibration_due || nextYear.toISOString().split('T')[0],
      notes: selectedBatch?.calibration_notes || '',
      file: null
    });
  };

  const handleUploadCalibSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showUploadCertItem || !uploadCalibForm.file) {
      await confirm({
        title: 'Missing File',
        message: 'Please select a calibration certificate file to upload.',
        type: 'warning',
        confirmText: 'OK',
        hideCancel: true
      });
      return;
    }

    setIsSubmittingCalib(true);
    try {
      const formData = new FormData();
      formData.append('item_id', String(showUploadCertItem.id));
      if (uploadCalibForm.batch_id) {
        formData.append('batch_id', String(uploadCalibForm.batch_id));
      }
      formData.append('calibrated_by', uploadCalibForm.calibrated_by);
      formData.append('cert_number', uploadCalibForm.cert_number);
      formData.append('calibration_date', uploadCalibForm.calibration_date);
      formData.append('due_date', uploadCalibForm.due_date);
      formData.append('notes', uploadCalibForm.notes);
      formData.append('cert_file', uploadCalibForm.file);

      const res = await apiFetch('/api/index.php?route=inventory&action=upload_calibration', {
        method: 'POST',
        body: formData
      });

      if (res.success) {
        setShowUploadCertItem(null);
        await confirm({
          title: 'Success',
          message: 'Calibration certificate uploaded successfully!',
          type: 'success',
          confirmText: 'OK',
          hideCancel: true
        });
        fetchData();
      } else {
        await confirm({
          title: 'Upload Failed',
          message: res.message || 'Failed to upload calibration certificate.',
          type: 'danger',
          confirmText: 'OK',
          hideCancel: true
        });
      }
    } catch (err: any) {
      await confirm({
        title: 'Upload Error',
        message: 'Error uploading certificate: ' + (err.message || 'Network error'),
        type: 'danger',
        confirmText: 'OK',
        hideCancel: true
      });
    } finally {
      setIsSubmittingCalib(false);
    }
  };

  const handleRecordInternalCert = async (item: InventoryItem) => {
    try {
      await apiFetch('/api/index.php?route=inventory&action=record_calibration', {
        method: 'POST',
        body: JSON.stringify({
          item_id: item.id,
          batch_id: certFormDetails.batch_id || null,
          calibrated_by: certFormDetails.inspector_name || 'CJC Health Services Clinic',
          cert_number: certFormDetails.control_no || `CAL-${new Date().getFullYear()}-${String(item.id).padStart(5, '0')}`,
          calibration_date: certFormDetails.last_calibrated || item.last_calibrated || new Date().toISOString().split('T')[0],
          due_date: certFormDetails.calibration_due || item.calibration_due || '',
          notes: certFormDetails.notes || item.calibration_notes || 'Generated CJC Calibration Certificate'
        })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };



  const handleDeleteCalibRecord = async (id: number, itemId: number) => {
    const isConfirmed = await confirm({
      title: 'Delete Calibration Record',
      message: 'Are you sure you want to delete this calibration record?',
      confirmText: 'Delete',
      type: 'danger'
    });

    if (!isConfirmed) return;

    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=delete_calibration', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      if (res.success) {
        fetchCalibHistory(itemId);
        fetchData();
      }
    } catch (e) {
      console.error(e);
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
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=add_batch', { 
        method: 'POST', 
        body: JSON.stringify({ ...newBatch, item_id: showAddBatch }) 
      });
      if (res && res.success !== false) {
        setShowAddBatch(null);
        setNewBatch({ item_id: 0, clinic_branch: 'College Clinic', batch_number: '', stock_remaining: 1, date_arrived: '', expired_on: '', last_calibrated: '', calibration_due: '', calibration_notes: '' });
        fetchData();
      } else {
        alert(res?.message || 'Failed to add batch.');
      }
    } catch (err: any) {
      alert(err?.message || 'Network error adding batch.');
    }
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

  // Filtered items computation memoized
  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
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
  }, [items, categoryFilter, statusFilter, searchTerm, batchesByItemId]);

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
          
          {/* Branch Filter Dropdown */}
          <select 
            value={selectedBranchFilter} 
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="border border-slate-300 text-sm rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:border-red-700 bg-white font-medium"
            title="Filter stock by clinic branch"
          >
            <option value="all">🏢 All Branches (Combined)</option>
            <option value="College Clinic">College Clinic</option>
            <option value="Basic Education Clinic">Basic Education Clinic</option>
            <option value="Power Campus Clinic">Power Campus Clinic</option>
          </select>

          {/* Category Dropdown */}
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-300 text-sm rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:border-red-700 bg-white font-medium"
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
                const itemBatches = batchesByItemId.get(item.id) || [];
                
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
                          <div className="inline-flex items-center gap-1 mr-1">
                            {/* Upload External Cert Button */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenUploadCert(item); }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Upload Calibration Certificate from External Calibrator"
                            >
                              <FiUploadCloud size={12} /> Upload
                            </button>

                            {/* Generate Internal CJC Cert Button */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenCalibCertForm(item); }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Fill details and generate official CJC Calibration Certificate"
                            >
                              <FiPrinter size={12} /> CJC Cert
                            </button>


                            {/* Calibration History / View Certs Button */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenCalibHistory(item); }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="View Calibration History & Uploaded Files"
                            >
                              <FiFileText size={12} /> History {item.cert_count ? `(${item.cert_count})` : ''}
                            </button>
                          </div>
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
                                           {isEquipment && (
                                             <>
                                               <button
                                                 type="button"
                                                 onClick={() => handleOpenUploadCert(item, b)}
                                                 className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                                 title={`Upload Calibration Cert for Batch #${b.batch_number || b.id}`}
                                               >
                                                 <FiUploadCloud size={11} /> Calib
                                               </button>
                                               <button
                                                 type="button"
                                                 onClick={() => handleOpenCalibCertForm(item, b)}
                                                 className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                                 title={`Generate CJC Calibration Cert for Batch #${b.batch_number || b.id}`}
                                               >
                                                 <FiPrinter size={11} /> Cert
                                               </button>
                                             </>
                                           )}

                                           <button 
                                             type="button"
                                             onClick={() => handleOpenBatchDetails(b.id)}
                                             className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                             title="View Full Batch Trace Audit & Logs"
                                           >
                                             <FiEye size={11} /> Details
                                           </button>

                                           {b.stock_remaining > 0 && (
                                             <button 
                                               type="button"
                                               onClick={() => {
                                                 setShowDisposeModal(b);
                                                 setDisposeForm({ quantity: b.stock_remaining, reason: 'Expired / Unconsumed Disposal', disposed_to: 'CJC Hazardous Medical Waste Bin' });
                                               }}
                                               className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                               title="Dispose Unconsumed / Expired Stock"
                                             >
                                               <FiTrash2 size={11} /> Dispose
                                             </button>
                                           )}

                                           <button onClick={() => {
                                             setEditBatchData({
                                               batch_id: b.id,
                                               batch_number: b.batch_number || '',
                                               date_arrived: b.date_arrived || '',
                                               expired_on: b.expired_on || '',
                                               stock_remaining: b.stock_remaining,
                                               last_calibrated: b.last_calibrated || '',
                                               calibration_due: b.calibration_due || '',
                                               calibration_notes: b.calibration_notes || ''
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
                    <label className="block text-sm font-medium mb-1">Brand Name (Optional)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newItem.brand_name} onChange={e => setNewItem({...newItem, brand_name: e.target.value})} placeholder="e.g. Biogesic (Optional)" />
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

      {/* Fill Out Calibration Certificate Details Modal */}
      {showCalibFormItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <FiEdit3 className="text-emerald-400" /> Fill Out Calibration Certificate Details
              </span>
              <button
                onClick={() => setShowCalibFormItem(null)}
                className="text-slate-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGeneratePreviewFromForm} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-emerald-950">
                <div className="font-bold text-sm text-emerald-900">{showCalibFormItem.generic_name}</div>
                <div className="text-emerald-700 text-[11px] mt-0.5">Customize the apparatus details and inspector information to be printed on the official CJC Calibration Certificate.</div>
              </div>

              {batches.filter(b => b.item_id === showCalibFormItem.id).length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block text-slate-800 font-bold mb-1">Target Batch Unit (Optional)</label>
                  <select
                    value={certFormDetails.batch_id || ''}
                    onChange={e => {
                      const selectedBId = e.target.value ? Number(e.target.value) : null;
                      const selectedB = batches.find(b => b.id === selectedBId);
                      setCertFormDetails({
                        ...certFormDetails,
                        batch_id: selectedBId,
                        control_no: `CAL-${new Date().getFullYear()}-${selectedBId ? ('B' + selectedBId) : String(showCalibFormItem.id).padStart(5, '0')}`,
                        last_calibrated: selectedB?.last_calibrated || certFormDetails.last_calibrated,
                        calibration_due: selectedB?.calibration_due || certFormDetails.calibration_due,
                        notes: selectedB?.calibration_notes || certFormDetails.notes
                      });
                    }}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs bg-white"
                  >
                    <option value="">-- Entire Equipment Category (All Batches) --</option>
                    {batches.filter(b => b.item_id === showCalibFormItem.id).map(b => (
                      <option key={b.id} value={b.id}>
                        Batch #{b.batch_number || b.id} - {b.clinic_branch} (Remaining Stock: {b.stock_remaining})
                      </option>
                    ))}
                  </select>
                </div>
              )}


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Equipment Name*</label>
                  <input
                    type="text"
                    required
                    value={certFormDetails.equipment_name}
                    onChange={e => setCertFormDetails({ ...certFormDetails, equipment_name: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Brand / Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Omron / HE-7120"
                    value={certFormDetails.brand_name}
                    onChange={e => setCertFormDetails({ ...certFormDetails, brand_name: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Formulation / Specification</label>
                  <input
                    type="text"
                    value={certFormDetails.formulation}
                    onChange={e => setCertFormDetails({ ...certFormDetails, formulation: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Control / Cert Number*</label>
                  <input
                    type="text"
                    required
                    value={certFormDetails.control_no}
                    onChange={e => setCertFormDetails({ ...certFormDetails, control_no: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date Acquired</label>
                  <input
                    type="date"
                    value={certFormDetails.date_acquired}
                    onChange={e => setCertFormDetails({ ...certFormDetails, date_acquired: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Last Calibrated*</label>
                  <input
                    type="date"
                    required
                    value={certFormDetails.last_calibrated}
                    onChange={e => setCertFormDetails({ ...certFormDetails, last_calibrated: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Next Due Date</label>
                  <input
                    type="date"
                    value={certFormDetails.calibration_due}
                    onChange={e => setCertFormDetails({ ...certFormDetails, calibration_due: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Inspector / Nurse Name</label>
                  <input
                    type="text"
                    value={certFormDetails.inspector_name}
                    onChange={e => setCertFormDetails({ ...certFormDetails, inspector_name: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Inspector Designation</label>
                  <input
                    type="text"
                    value={certFormDetails.inspector_position}
                    onChange={e => setCertFormDetails({ ...certFormDetails, inspector_position: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Inspector Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Apparatus meets accuracy and clinical precision standards..."
                  value={certFormDetails.notes}
                  onChange={e => setCertFormDetails({ ...certFormDetails, notes: e.target.value })}
                  className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCalibFormItem(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md"
                >
                  <FiPrinter size={14} /> Preview & Print Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Annual Printable CJC Calibration Certificate Modal */}
      {calibrationCertItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center no-print">
              <span className="font-bold text-sm flex items-center gap-2">
                <FiCheckCircle className="text-emerald-400" /> Official CJC Equipment Calibration Certificate
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleRecordInternalCert(calibrationCertItem);
                    window.print();
                  }}
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

            {/* Printable Document Sheet (A4 Letterhead Format) */}
            <div className="p-10 overflow-y-auto bg-white text-slate-900 space-y-6 font-serif border border-slate-200 print:border-none print:p-6">
              
              {/* Header Image Background with Document Control Box Overlay */}
              <div className="mb-4 relative">
                <img src="/med_cert_header.png" alt="CJC Header" className="w-full h-auto" />

                {/* Document Control Overlay Box - Exact CJC MedCert Style */}
                <div className="absolute top-[5%] right-[0%] bottom-[41%] w-[17%] z-10 overflow-visible">
                  <div className="w-[200%] h-[200%] scale-50 origin-top-left bg-white border-[1px] border-slate-800 flex flex-col justify-evenly px-2 py-1 shadow-sm font-sans leading-none">
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Index No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 text-[14px]">9.9</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Revision No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 text-[14px]">01</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Effective Date:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 whitespace-nowrap tracking-tighter text-[14px]">08/01/2024</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[13px]">Control No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 whitespace-nowrap tracking-tighter text-[13px]">{certFormDetails.control_no || `CAL-${new Date().getFullYear()}`}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title Section */}
              <div className="text-center my-6">
                <h2 className="text-2xl font-black uppercase tracking-widest text-[#8c1526] font-sans underline underline-offset-8">
                  Annual Calibration Certificate
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-2">
                  Cert No: {certFormDetails.control_no || `CAL-${new Date().getFullYear()}-${String(calibrationCertItem.id).padStart(5, '0')}`}
                </p>
              </div>

              {/* Apparatus Details Card */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-300 space-y-4 text-xs font-sans">
                <h3 className="font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                  Biomedical Apparatus Specification
                </h3>
                <div className="grid grid-cols-2 gap-4 text-slate-800">
                  <div><span className="text-slate-500 font-medium">Equipment Name:</span> <strong className="text-slate-900 font-bold uppercase text-sm block">{certFormDetails.equipment_name || calibrationCertItem.generic_name}</strong></div>
                  <div><span className="text-slate-500 font-medium">Brand / Model:</span> <strong className="text-slate-900 font-bold block">{certFormDetails.brand_name || calibrationCertItem.brand_name || 'N/A'}</strong></div>
                  <div><span className="text-slate-500 font-medium">Formulation / Spec:</span> <strong className="text-slate-900 font-bold block">{certFormDetails.formulation || calibrationCertItem.formulation || 'Standard Clinical Grade'}</strong></div>
                  <div><span className="text-slate-500 font-medium">Date Acquired:</span> <strong className="text-slate-900 font-bold block">{certFormDetails.date_acquired || calibrationCertItem.date_acquired || 'N/A'}</strong></div>
                  <div><span className="text-slate-500 font-medium">Inspection / Last Calibrated:</span> <strong className="text-emerald-700 font-bold text-sm block">{certFormDetails.last_calibrated || calibrationCertItem.last_calibrated || new Date().toISOString().split('T')[0]}</strong></div>
                  <div><span className="text-slate-500 font-medium">Next Calibration Recertification Due:</span> <strong className="text-amber-700 font-bold text-sm block">{certFormDetails.calibration_due || calibrationCertItem.calibration_due || 'N/A'}</strong></div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-2xl text-xs text-emerald-950 space-y-1 font-sans">
                <h4 className="font-black uppercase tracking-wider flex items-center gap-2 text-emerald-900 text-sm">
                  <FiCheckCircle className="text-emerald-600" size={16} /> CALIBRATION STATUS: PASSED & VERIFIED
                </h4>
                <p className="text-emerald-800 leading-relaxed">
                  This equipment/apparatus has passed standard biomedical safety checks, diagnostic accuracy verification, and operational readiness inspection in accordance with Cor Jesu College Health Services Clinic protocols.
                </p>
                {(certFormDetails.notes || calibrationCertItem.calibration_notes) && (
                  <p className="font-medium text-slate-800 pt-2 border-t border-emerald-200 mt-2">
                    <span className="text-slate-500 font-bold">Notes / Inspector Remarks:</span> {certFormDetails.notes || calibrationCertItem.calibration_notes}
                  </p>
                )}
              </div>

              {/* Signatures & Seal Section */}
              <div className="pt-10 flex justify-between items-end text-xs font-sans">
                <div className="w-44 h-24 border-2 border-dashed border-slate-400 rounded-2xl flex items-center justify-center text-center p-3 text-slate-400 text-[10px] uppercase font-bold">
                  Official Clinic Seal & Verification Stamp
                </div>
                <div className="text-center w-72">
                  <div className="border-b-2 border-slate-900 mb-1 pb-1 font-bold text-slate-900 uppercase text-xs">
                    {certFormDetails.inspector_name || 'Registered Biomedical Tech / Clinic Nurse'}
                  </div>
                  <div className="text-[11px] text-slate-600 font-semibold">{certFormDetails.inspector_position || 'Cor Jesu College Health Services Clinic'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Digos City, Davao del Sur</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Upload External Calibration Certificate Modal */}
      {showUploadCertItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <FiUploadCloud className="text-blue-400" /> Upload Calibration Certificate
              </span>
              <button
                onClick={() => setShowUploadCertItem(null)}
                className="text-slate-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadCalibSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-blue-900">
                <div className="font-bold text-sm">{showUploadCertItem.generic_name}</div>
                <div className="text-slate-600">{showUploadCertItem.brand_name || 'No Brand Specified'}</div>
              </div>

              {batches.filter(b => b.item_id === showUploadCertItem.id).length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block text-slate-800 font-bold mb-1">Target Batch Unit (Optional)</label>
                  <select
                    value={uploadCalibForm.batch_id || ''}
                    onChange={e => {
                      const selectedBId = e.target.value ? Number(e.target.value) : null;
                      const selectedB = batches.find(b => b.id === selectedBId);
                      setUploadCalibForm({
                        ...uploadCalibForm,
                        batch_id: selectedBId,
                        calibration_date: selectedB?.last_calibrated || uploadCalibForm.calibration_date,
                        due_date: selectedB?.calibration_due || uploadCalibForm.due_date,
                        notes: selectedB?.calibration_notes || uploadCalibForm.notes
                      });
                    }}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs bg-white"
                  >
                    <option value="">-- Entire Equipment Category (All Batches) --</option>
                    {batches.filter(b => b.item_id === showUploadCertItem.id).map(b => (
                      <option key={b.id} value={b.id}>
                        Batch #{b.batch_number || b.id} - {b.clinic_branch} (Remaining Stock: {b.stock_remaining})
                      </option>
                    ))}
                  </select>
                </div>
              )}


              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Certificate File (PDF / Image / DOC)*</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setUploadCalibForm({ ...uploadCalibForm, file: e.target.files?.[0] || null })}
                  className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Calibrated By / Agency</label>
                  <input
                    type="text"
                    placeholder="e.g. BioMedTech Corp / Engr. Santos"
                    value={uploadCalibForm.calibrated_by}
                    onChange={e => setUploadCalibForm({ ...uploadCalibForm, calibrated_by: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cert / Control Number</label>
                  <input
                    type="text"
                    placeholder="e.g. CERT-2026-8891"
                    value={uploadCalibForm.cert_number}
                    onChange={e => setUploadCalibForm({ ...uploadCalibForm, cert_number: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Calibration Date*</label>
                  <input
                    type="date"
                    required
                    value={uploadCalibForm.calibration_date}
                    onChange={e => setUploadCalibForm({ ...uploadCalibForm, calibration_date: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Next Calibration Due Date</label>
                  <input
                    type="date"
                    value={uploadCalibForm.due_date}
                    onChange={e => setUploadCalibForm({ ...uploadCalibForm, due_date: e.target.value })}
                    className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Inspection Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Temperature probe verified within +-0.1C accuracy..."
                  value={uploadCalibForm.notes}
                  onChange={e => setUploadCalibForm({ ...uploadCalibForm, notes: e.target.value })}
                  className="w-full border border-slate-300 p-2 rounded-lg text-xs"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadCertItem(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCalib}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  {isSubmittingCalib ? 'Uploading...' : <><FiUploadCloud /> Upload Certificate</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calibration History & File Attachments Modal */}
      {showCalibHistoryItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="font-bold text-sm flex items-center gap-2">
                  <FiFileText className="text-emerald-400" /> Calibration Records & File Attachments
                </span>
                <span className="text-xs text-slate-300 block">{showCalibHistoryItem.generic_name} ({showCalibHistoryItem.brand_name || 'Equipment'})</span>
              </div>
              <button
                onClick={() => setShowCalibHistoryItem(null)}
                className="text-slate-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Calibration Log ({calibHistoryList.length})</span>
                <button
                  onClick={() => { const item = showCalibHistoryItem; setShowCalibHistoryItem(null); handleOpenUploadCert(item); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <FiUploadCloud size={14} /> Upload New Certificate
                </button>
              </div>

              {isLoadingCalibHistory ? (
                <div className="p-8 text-center text-slate-500 text-xs italic">Loading calibration records...</div>
              ) : calibHistoryList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <FiTool size={28} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-slate-600 text-xs font-bold">No uploaded certificates or calibration records found.</p>
                  <p className="text-slate-400 text-xs mt-1">Upload external certificates issued by calibrators to build a permanent history.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {calibHistoryList.map(calib => (
                    <div key={calib.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 relative group hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${calib.cert_type === 'external_upload' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {calib.cert_type === 'external_upload' ? 'External Vendor Cert' : 'Internal CJC Cert'}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">
                            {calib.calibrated_by || 'Unknown Calibrator'} {calib.cert_number ? `#${calib.cert_number}` : ''}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {calib.file_url && (
                            <a
                              href={calib.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1"
                            >
                              <FiExternalLink size={12} /> View File
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteCalibRecord(calib.id, showCalibHistoryItem.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Delete Record"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                        <div><span className="text-slate-400">Calibrated On:</span> <strong>{calib.calibration_date || 'N/A'}</strong></div>
                        <div><span className="text-slate-400">Next Due:</span> <strong className="text-amber-700">{calib.due_date || 'N/A'}</strong></div>
                        <div><span className="text-slate-400">Logged By:</span> <strong>{calib.uploaded_by || 'Staff'}</strong></div>
                        <div><span className="text-slate-400">Recorded At:</span> <strong>{new Date(calib.created_at).toLocaleDateString()}</strong></div>
                      </div>

                      {calib.notes && (
                        <p className="text-slate-600 italic">
                          <span className="font-bold not-italic text-slate-500">Notes:</span> {calib.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryCatalog;
