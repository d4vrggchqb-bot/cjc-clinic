import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiPlus, FiCheckCircle } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';


interface PurchaseOrder {
  id: number;
  category: 'medicine' | 'supply' | 'equipment';
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
    generic_name: '', 
    brand_name: '', 
    dosage: '',
    clinic_branch: 'College Clinic',
    supplier: '',
    quantity_ordered: 1,
    expected_delivery_date: ''
  });

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
    await apiFetch('/api/index.php?route=inventory&action=add_purchase', { method: 'POST', body: JSON.stringify(newOrder) });
    setShowAdd(false);
    setNewOrder({ 
      category: 'medicine', generic_name: '', brand_name: '', dosage: '',
      clinic_branch: 'College Clinic', supplier: '', quantity_ordered: 1, expected_delivery_date: ''
    });
    fetchOrders();
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    const confirmed = await confirm({
      title: 'Update Status',
      message: `Are you sure you want to update the status to ${status}?`,
      type: 'warning'
    });
    if (!confirmed) return;
    await apiFetch('/api/index.php?route=inventory&action=update_purchase', { method: 'POST', body: JSON.stringify({ id, status }) });
    fetchOrders();
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
      alert('Order received and successfully added to Catalog & Batches!');
      setShowReceive(null);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error receiving order');
    }
  };

  const handleDraftFromLowStock = async () => {
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=low_stock');
      if (res.low_stock && res.low_stock.length > 0) {
        // Pre-populate with the first low stock item
        const item = res.low_stock[0];
        setNewOrder(prev => ({
          ...prev,
          category: item.category,
          generic_name: item.generic_name,
          brand_name: item.brand_name || '',
          dosage: item.dosage || '',
          quantity_ordered: item.alert_threshold > 0 ? item.alert_threshold * 2 : 100 // suggest a good quantity
        }));
        setShowAdd(true);
      } else {
        alert('No items are currently below their alert threshold!');
      }
    } catch (e) {
      console.error(e);
      alert('Error fetching low stock items.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Purchase Orders</h2>
        <div className="flex gap-2">
          <button onClick={handleDraftFromLowStock} className="bg-orange-100 text-orange-800 px-4 py-2 rounded-md hover:bg-orange-200 flex items-center text-sm font-medium transition-colors">
            Draft from Low Stock
          </button>
          <button onClick={() => setShowAdd(true)} className="bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 flex items-center text-sm font-medium">
            <FiPlus className="mr-1" /> New Order
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1 border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Item details</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Supplier</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Branch</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Ordered</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Expected</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <div className="font-medium text-slate-800">{order.generic_name}</div>
                  <div className="text-xs text-slate-500">
                    <span className="capitalize">{order.category}</span>
                    {order.brand_name ? ` • ${order.brand_name}` : ''} 
                    {order.dosage ? ` • ${order.dosage}` : ''}
                  </div>
                </td>
                <td className="p-3 text-slate-600 text-sm">{order.supplier || 'N/A'}</td>
                <td className="p-3 text-slate-600 text-sm">{order.clinic_branch}</td>
                <td className="p-3 font-medium">{order.quantity_ordered}</td>
                <td className="p-3 text-slate-600 text-sm">{order.expected_delivery_date || 'N/A'}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded-md capitalize ${
                    order.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                    order.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {order.status === 'pending' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'approved')} className="text-blue-600 hover:underline text-sm mr-3 font-medium">Approve</button>
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
                    }} className="text-emerald-600 hover:underline text-sm mr-3 font-medium">Receive Items</button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NEW ORDER MODAL */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Request New Order</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select className="w-full border p-2 rounded" value={newOrder.category} onChange={e => setNewOrder({...newOrder, category: e.target.value as any})}>
                    <option value="medicine">Medicine</option>
                    <option value="supply">Supply</option>
                    <option value="equipment">Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Clinic Branch</label>
                  <select className="w-full border p-2 rounded" value={newOrder.clinic_branch} onChange={e => setNewOrder({...newOrder, clinic_branch: e.target.value})}>
                    <option value="College Clinic">College Clinic</option>
                    <option value="BED Clinic">BED Clinic</option>
                    <option value="Power Campus Clinic">Power Campus Clinic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Generic Name <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full border p-2 rounded" value={newOrder.generic_name} onChange={e => setNewOrder({...newOrder, generic_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Brand Name</label>
                  <input type="text" className="w-full border p-2 rounded" value={newOrder.brand_name} onChange={e => setNewOrder({...newOrder, brand_name: e.target.value})} />
                </div>
                {newOrder.category === 'medicine' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Dosage (e.g. 500mg)</label>
                    <input type="text" className="w-full border p-2 rounded" value={newOrder.dosage} onChange={e => setNewOrder({...newOrder, dosage: e.target.value})} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity Ordered <span className="text-red-500">*</span></label>
                  <input required type="number" min="1" className="w-full border p-2 rounded" value={newOrder.quantity_ordered} onChange={e => setNewOrder({...newOrder, quantity_ordered: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <input type="text" className="w-full border p-2 rounded" value={newOrder.supplier} onChange={e => setNewOrder({...newOrder, supplier: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Delivery Date</label>
                  <input type="date" className="w-full border p-2 rounded" value={newOrder.expected_delivery_date} onChange={e => setNewOrder({...newOrder, expected_delivery_date: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-700 text-white rounded font-medium">Submit Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE ORDER MODAL */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-2">Receive Order</h3>
            <p className="text-sm text-slate-500 mb-4">
              Receiving this order will automatically push <strong>{showReceive.generic_name}</strong> to the Catalog & Batches for <strong>{showReceive.clinic_branch}</strong>.
            </p>
            <form onSubmit={handleReceive} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Actual Quantity Received <span className="text-red-500">*</span></label>
                <input required type="number" min="1" className="w-full border p-2 rounded" value={receiveData.actual_quantity} onChange={e => setReceiveData({...receiveData, actual_quantity: parseInt(e.target.value)})} />
                <p className="text-xs text-slate-400 mt-1">Originally ordered: {showReceive.quantity_ordered}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Batch / Lot Number</label>
                <input type="text" className="w-full border p-2 rounded" value={receiveData.batch_number} onChange={e => setReceiveData({...receiveData, batch_number: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiry Date <span className="text-red-500">*</span></label>
                <input required type="date" className="w-full border p-2 rounded" value={receiveData.expiry_date} onChange={e => setReceiveData({...receiveData, expiry_date: e.target.value})} />
                <p className="text-xs text-slate-400 mt-1">Required for FEFO auto-dispense logic.</p>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button type="button" onClick={() => setShowReceive(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">Receive into Inventory</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
