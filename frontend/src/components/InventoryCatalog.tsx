import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiPlus, FiBox, FiAlertCircle, FiChevronDown, FiChevronUp, FiPlusCircle, FiMinusCircle, FiEdit3, FiPrinter, FiCheckCircle } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';


interface InventoryItem {
  id: number;
  category: string;
  brand_name: string | null;
  generic_name: string;
  dosage: string | null;
  formulation: string | null;
  alert_threshold: number;
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
  date_arrived: string | null;
  expired_on: string | null;
  status: string;
}

const InventoryCatalog: React.FC = () => {
  const { confirm } = useConfirm();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [calibrationCertItem, setCalibrationCertItem] = useState<InventoryItem | null>(null);
  
  // Modals state
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState<number | null>(null); // item_id
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [showDispense, setShowDispense] = useState<number | null>(null); // item_id
  
  // Form States
  const [newItem, setNewItem] = useState({ category: 'medicine', customCategory: '', brand_name: '', generic_name: '', dosage: '', formulation: '', alert_threshold: 20 });
  const [newBatch, setNewBatch] = useState({ item_id: 0, clinic_branch: 'College Clinic', batch_number: '', stock_remaining: 1, date_arrived: '', expired_on: '' });
  const [editBatchData, setEditBatchData] = useState({ batch_id: 0, batch_number: '', date_arrived: '', expired_on: '', stock_remaining: 0 });
  const [dispenseData, setDispenseData] = useState({ clinic_branch: 'College Clinic', quantity: 1, disposed_to: '', reason: '' });

  const fetchData = async () => {
    try {
      const itemsRes = await apiFetch('/api/index.php?route=inventory&action=items');
      setItems(itemsRes.items || []);
      const batchesRes = await apiFetch('/api/index.php?route=inventory&action=batches');
      setBatches(batchesRes.batches || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const getTotalStock = (itemId: number) => {
    return batches.filter(b => b.item_id === itemId).reduce((sum, b) => sum + b.stock_remaining, 0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center">
          <FiBox className="mr-2" /> Catalog Items
        </h2>
        <div className="flex gap-3">
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-300 text-sm rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:border-red-700"
          >
            <option value="all">All Categories</option>
            <option value="medicine">Medicine</option>
            <option value="supply">Supplies</option>
            <option value="equipment">Equipments</option>
            <option value="other">Others</option>
          </select>
          <button onClick={() => setShowAddItem(true)} className="bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 flex items-center text-sm font-medium shadow-sm transition-colors">
            <FiPlus className="mr-1" /> New Catalog Item
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1 border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Item Name</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Total Stock (All Branches)</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.filter(item => {
              if (categoryFilter === 'all') return true;
              if (categoryFilter === 'other') return !['medicine', 'supply', 'equipment'].includes(item.category);
              return item.category === categoryFilter;
            }).map(item => {
              const totalStock = getTotalStock(item.id);
              const isLowStock = totalStock <= item.alert_threshold;
              const isExpanded = expandedItemId === item.id;
              const itemBatches = batches.filter(b => b.item_id === item.id);

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
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md capitalize">{item.category}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center">
                        <span className={`font-semibold ${isLowStock ? 'text-orange-500' : 'text-emerald-600'}`}>
                          {totalStock}
                        </span>
                        {isLowStock && <FiAlertCircle className="ml-2 text-orange-500" title="Low Stock" />}
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
                      <td colSpan={4} className="p-4">
                        <div className="bg-white rounded-md border border-slate-200 p-3 shadow-inner">
                          <h4 className="text-sm font-semibold mb-2 text-slate-700">Active Batches</h4>
                          {itemBatches.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No active batches for this item.</p>
                          ) : (
                            <table className="w-full text-sm text-left">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-100">
                                  <th className="pb-1">Branch</th>
                                  <th className="pb-1">Batch #</th>
                                  <th className="pb-1">Stock</th>
                                  <th className="pb-1">Arrived</th>
                                  <th className="pb-1">Expiry</th>
                                  <th className="pb-1"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemBatches.map(b => (
                                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                                    <td className="py-2">{b.clinic_branch}</td>
                                    <td className="py-2">{b.batch_number || 'N/A'}</td>
                                    <td className="py-2 font-medium">{b.stock_remaining}</td>
                                    <td className="py-2">{b.date_arrived || 'N/A'}</td>
                                    <td className="py-2 text-red-600">{b.expired_on || 'N/A'}</td>
                                    <td className="py-2 text-right">
                                      <button onClick={() => {
                                        setEditBatchData({
                                          batch_id: b.id,
                                          batch_number: b.batch_number || '',
                                          date_arrived: b.date_arrived || '',
                                          expired_on: b.expired_on || '',
                                          stock_remaining: b.stock_remaining
                                        });
                                        setShowEditBatch(true);
                                      }} className="text-blue-500 hover:text-blue-700 p-1" title="Edit Batch">
                                        <FiEdit3 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
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
                <button type="button" onClick={() => setShowAddItem(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-700 text-white rounded">Save Item</button>
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
