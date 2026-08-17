import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiPlus, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';


interface PurchaseOrder {
  id: number;
  category: string;
  generic_name: string;
  brand_name: string | null;
  dosage: string | null;
  clinic_branch: string;
  supplier: string | null;
  quantity_ordered: number;
  expected_delivery_date: string | null;
  requested_date: string;
  status: 'pending' | 'approved' | 'delivered' | 'cancelled';
}

const PurchaseOrders: React.FC = () => {
  const { confirm } = useConfirm();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showReceive, setShowReceive] = useState<PurchaseOrder | null>(null);

  const [newOrder, setNewOrder] = useState({ 
    category: 'medicine', 
    customCategory: '',
    generic_name: '', 
    brand_name: '', 
    dosage: '',
    formulation: '',
    clinic_branch: 'College Clinic',
    supplier: '',
    quantity_ordered: 1,
    expected_delivery_date: ''
  });

  const resetNewOrder = () => {
    setNewOrder({
      category: 'medicine',
      customCategory: '',
      generic_name: '',
      brand_name: '',
      dosage: '',
      formulation: '',
      clinic_branch: 'College Clinic',
      supplier: '',
      quantity_ordered: 1,
      expected_delivery_date: ''
    });
  };

  const [receiveData, setReceiveData] = useState({
    actual_quantity: 0,
    expiry_date: '',
    batch_number: ''
  });

  const fetchOrders = async () => {
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=purchases');
      setOrders(res.purchases || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalCategory = newOrder.category;
    if (finalCategory === 'other') {
      if (!newOrder.customCategory || !newOrder.customCategory.trim()) {
        toast.error('Please specify the category.');
        return;
      }
      finalCategory = newOrder.customCategory.trim();
    }

    let combinedDosage = newOrder.dosage.trim();
    if (newOrder.formulation.trim()) {
      combinedDosage = combinedDosage ? `${combinedDosage} (${newOrder.formulation.trim()})` : newOrder.formulation.trim();
    }

    const payload = {
      category: finalCategory,
      generic_name: newOrder.generic_name.trim(),
      brand_name: newOrder.brand_name.trim() || null,
      dosage: combinedDosage || null,
      clinic_branch: newOrder.clinic_branch,
      supplier: newOrder.supplier.trim() || null,
      quantity_ordered: newOrder.quantity_ordered,
      expected_delivery_date: newOrder.expected_delivery_date || null
    };

    const confirmed = await confirm({
      title: 'Submit Purchase Order',
      message: 'Are you sure you want to submit this purchase order request?',
      type: 'save'
    });
    if (!confirmed) return;

    try {
      await apiFetch('/api/index.php?route=inventory&action=add_purchase', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Purchase order requested successfully!');
      setShowAdd(false);
      resetNewOrder();
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Error submitting purchase order');
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    const confirmed = await confirm({
      title: 'Update Status',
      message: `Are you sure you want to update the status to ${status}?`,
      type: 'warning'
    });
    if (!confirmed) return;
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=update_purchase', { 
        method: 'POST', 
        body: JSON.stringify({ id, status }) 
      });
      if (res && res.success !== false) {
        toast.success(`Purchase order status updated to ${status}`);
        fetchOrders();
      } else {
        toast.error(res?.message || 'Failed to update purchase order status');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error updating purchase order status');
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceive) return;
    try {
      await apiFetch('/api/index.php?route=inventory&action=update_purchase', { 
        method: 'POST', 
        body: JSON.stringify({ 
          id: showReceive.id, 
          status: 'delivered', 
          ...receiveData 
        }) 
      });
      toast.success('Order received and successfully added to Catalog & Batches!');
      setShowReceive(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Error receiving order');
    }
  };

  const handleDraftFromLowStock = async () => {
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=low_stock');
      if (res.low_stock && res.low_stock.length > 0) {
        const item = res.low_stock[0];
        setNewOrder(prev => ({
          ...prev,
          category: item.category,
          generic_name: item.generic_name,
          brand_name: item.brand_name || '',
          dosage: item.dosage || '',
          quantity_ordered: item.alert_threshold > 0 ? item.alert_threshold * 2 : 100
        }));
        setShowAdd(true);
      } else {
        toast.error('No items are currently below their alert threshold!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error fetching low stock items.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Purchase Orders</h2>
        <div className="flex gap-2">
          <button onClick={handleDraftFromLowStock} className="bg-orange-100 text-orange-800 px-4 py-2 rounded-md hover:bg-orange-200 flex items-center text-sm font-medium transition-colors cursor-pointer">
            Draft from Low Stock
          </button>
          <button onClick={() => setShowAdd(true)} className="bg-[#8c1526] text-white px-4 py-2 rounded-md hover:bg-[#7a1221] flex items-center text-sm font-medium cursor-pointer shadow-sm">
            <FiPlus className="mr-1" /> New Order
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1 border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Item Details & Category</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Supplier</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Branch</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Qty Ordered</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Expected Date</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <div className="font-bold text-slate-800">{order.generic_name}</div>
                  <div className="text-xs text-slate-500">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold capitalize mr-1.5">{order.category}</span>
                    {order.brand_name ? ` Brand: ${order.brand_name}` : ''} 
                    {order.dosage ? ` • ${order.dosage}` : ''}
                  </div>
                </td>
                <td className="p-3 text-slate-600 text-sm font-medium">{order.supplier || 'N/A'}</td>
                <td className="p-3 text-slate-600 text-sm">{order.clinic_branch}</td>
                <td className="p-3 font-bold text-slate-800 text-sm">{order.quantity_ordered}</td>
                <td className="p-3 text-slate-600 text-sm">{order.expected_delivery_date || 'N/A'}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize border ${
                    order.status === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    order.status === 'approved' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                    order.status === 'delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {order.status === 'pending' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'approved')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer mr-2">Approve</button>
                  )}
                  {order.status === 'approved' && (
                    <button onClick={async () => {
                      setReceiveData({ actual_quantity: order.quantity_ordered, expiry_date: '', batch_number: 'Loading...' });
                      setShowReceive(order);
                      try {
                        const res = await apiFetch(`/api/index.php?route=inventory&action=get_next_batch&generic_name=${encodeURIComponent(order.generic_name)}&category=${encodeURIComponent(order.category)}`);
                        if (res.suggested_batch) {
                          setReceiveData(prev => ({ ...prev, batch_number: res.suggested_batch }));
                        }
                      } catch (e) {
                        setReceiveData(prev => ({ ...prev, batch_number: '' }));
                      }
                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer mr-2">Receive Items</button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NEW ORDER MODAL */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Request New Purchase Order</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">✕</button>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white font-medium" value={newOrder.category} onChange={e => setNewOrder({...newOrder, category: e.target.value})}>
                    <option value="medicine">Medicine</option>
                    <option value="supply">Supply</option>
                    <option value="equipment">Equipment</option>
                    <option value="other">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Branch *</label>
                  <select className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white font-medium" value={newOrder.clinic_branch} onChange={e => setNewOrder({...newOrder, clinic_branch: e.target.value})}>
                    <option value="College Clinic">College Clinic</option>
                    <option value="BED Clinic">BED Clinic</option>
                    <option value="Power Campus Clinic">Power Campus Clinic</option>
                  </select>
                </div>
              </div>

              {/* Specify Custom Category */}
              {newOrder.category === 'other' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Specify Category <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#8c1526]" value={newOrder.customCategory} onChange={e => setNewOrder({...newOrder, customCategory: e.target.value})} placeholder="e.g. Lab Reagents, First Aid Kits..." />
                </div>
              )}

              {/* Category Fields matching Catalog & Batches */}
              {newOrder.category === 'medicine' && (
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Medicine Catalog Fields</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Generic Name <span className="text-red-500">*</span></label>
                      <input required type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.generic_name} onChange={e => setNewOrder({...newOrder, generic_name: e.target.value})} placeholder="e.g. Paracetamol" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name (Optional)</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.brand_name} onChange={e => setNewOrder({...newOrder, brand_name: e.target.value})} placeholder="e.g. Biogesic (Optional)" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Dosage (e.g. 500mg)</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.dosage} onChange={e => setNewOrder({...newOrder, dosage: e.target.value})} placeholder="e.g. 500mg" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Formulation / Unit</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.formulation} onChange={e => setNewOrder({...newOrder, formulation: e.target.value})} placeholder="e.g. Tablet, Syrup, Box" />
                    </div>
                  </div>
                </div>
              )}

              {newOrder.category === 'supply' && (
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Supply Catalog Fields</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Supply Name <span className="text-red-500">*</span></label>
                      <input required type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.generic_name} onChange={e => setNewOrder({...newOrder, generic_name: e.target.value})} placeholder="e.g. Cotton Balls, Bandage" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name (Optional)</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.brand_name} onChange={e => setNewOrder({...newOrder, brand_name: e.target.value})} placeholder="e.g. Band-Aid, Medical" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unit / Measurement</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.formulation} onChange={e => setNewOrder({...newOrder, formulation: e.target.value})} placeholder="e.g. Box of 100s, Roll, Pack" />
                    </div>
                  </div>
                </div>
              )}

              {newOrder.category === 'equipment' && (
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Equipment Catalog Fields</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Equipment Name <span className="text-red-500">*</span></label>
                      <input required type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.generic_name} onChange={e => setNewOrder({...newOrder, generic_name: e.target.value})} placeholder="e.g. Sphygmomanometer, Stethoscope" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Model</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.brand_name} onChange={e => setNewOrder({...newOrder, brand_name: e.target.value})} placeholder="e.g. Omron, Littmann Classic III" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Specification / Type</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.formulation} onChange={e => setNewOrder({...newOrder, formulation: e.target.value})} placeholder="e.g. Digital Automatic, Manual Portable" />
                    </div>
                  </div>
                </div>
              )}

              {newOrder.category !== 'medicine' && newOrder.category !== 'supply' && newOrder.category !== 'equipment' && (
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">General Item Fields</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name <span className="text-red-500">*</span></label>
                      <input required type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.generic_name} onChange={e => setNewOrder({...newOrder, generic_name: e.target.value})} placeholder="e.g. Item name" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Details</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.brand_name} onChange={e => setNewOrder({...newOrder, brand_name: e.target.value})} placeholder="e.g. Brand or specs" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unit / Packaging</label>
                      <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] bg-white" value={newOrder.formulation} onChange={e => setNewOrder({...newOrder, formulation: e.target.value})} placeholder="e.g. Box, Piece, Set" />
                    </div>
                  </div>
                </div>
              )}

              {/* Order Quantities & Supplier */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity Ordered <span className="text-red-500">*</span></label>
                  <input required type="number" min="1" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] font-bold text-center" value={newOrder.quantity_ordered} onChange={e => setNewOrder({...newOrder, quantity_ordered: parseInt(e.target.value) || 1})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier</label>
                  <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" value={newOrder.supplier} onChange={e => setNewOrder({...newOrder, supplier: e.target.value})} placeholder="e.g. Zuellig" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Delivery</label>
                  <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" value={newOrder.expected_delivery_date} onChange={e => setNewOrder({...newOrder, expected_delivery_date: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-[#8c1526] hover:bg-[#7a1221] text-white rounded-xl text-xs font-bold shadow-md transition-colors">Submit Purchase Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE ORDER MODAL */}
      {showReceive && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Receive Order</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Receiving this order will automatically push <strong className="text-slate-800">{showReceive.generic_name}</strong> into the Catalog & Batches for <strong className="text-[#8c1526]">{showReceive.clinic_branch}</strong>.
            </p>
            <form onSubmit={handleReceive} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Quantity Received <span className="text-red-500">*</span></label>
                <input required type="number" min="1" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] font-bold text-center" value={receiveData.actual_quantity} onChange={e => setReceiveData({...receiveData, actual_quantity: parseInt(e.target.value) || 1})} />
                <p className="text-[10px] text-slate-400 mt-1">Originally ordered: {showReceive.quantity_ordered}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch / Lot Number</label>
                <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" value={receiveData.batch_number} onChange={e => setReceiveData({...receiveData, batch_number: e.target.value})} placeholder="e.g. BATCH-2026-001" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date <span className="text-red-500">*</span></label>
                <input required type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" value={receiveData.expiry_date} onChange={e => setReceiveData({...receiveData, expiry_date: e.target.value})} />
                <p className="text-[10px] text-slate-400 mt-1">Required for FEFO auto-dispense logic.</p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowReceive(null)} className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors">Receive into Inventory</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
