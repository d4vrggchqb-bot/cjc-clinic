import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiPackage, FiUser, FiPlus, FiBox, FiBriefcase, FiSearch } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

const Borrowings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkedOut' | 'newBooking' | 'history'>('checkedOut');
  
  return (
    <div className="p-8 w-full max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Equipment Booking</h1>
          <p className="text-slate-500 font-medium text-sm">Manage borrowing of clinic equipment and supplies</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('checkedOut')}
            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
              activeTab === 'checkedOut' ? 'bg-white text-[#A5192D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Checked Out Equipment
          </button>
          <button
            onClick={() => setActiveTab('newBooking')}
            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
              activeTab === 'newBooking' ? 'bg-white text-[#A5192D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            New Booking Form
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
              activeTab === 'history' ? 'bg-white text-[#A5192D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Booking History
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'checkedOut' && <CheckedOutList />}
        {activeTab === 'newBooking' && <NewBookingForm onSuccess={() => setActiveTab('checkedOut')} />}
        {activeTab === 'history' && <BookingHistoryList />}
      </div>
    </div>
  );
};

const CheckedOutList: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm } = useConfirm();

  const fetchCheckedOut = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/index.php?route=borrowings&action=checked_out');
      setItems(res.checked_out || []);
    } catch (e) {
      toast.error('Failed to load checked out equipment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckedOut();
  }, []);

  const handleReturn = async (borrowedItemId: number) => {
    const isConfirmed = await confirm({
      title: 'Return Equipment',
      message: 'Mark this equipment as returned?',
      type: 'info'
    });
    
    if (!isConfirmed) return;
    
    try {
      await apiFetch('/api/index.php?route=borrowings&action=return_item', {
        method: 'POST',
        body: JSON.stringify({ borrowed_item_id: borrowedItemId })
      });
      toast.success('Equipment returned successfully');
      fetchCheckedOut();
    } catch (e) {
      toast.error('Failed to return item');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-6 h-full overflow-y-auto">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-20">
          <FiPackage size={48} className="mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-slate-700">No equipment currently checked out</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.borrowed_item_id} className="border border-slate-200 rounded-lg p-5 flex flex-col hover:border-slate-300 transition-colors bg-slate-50/50">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-[#A5192D] font-bold">
                  <FiBox />
                  <span>{item.brand_name ? `${item.brand_name} (${item.generic_name})` : item.generic_name}</span>
                </div>
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">Qty: {item.quantity}</span>
              </div>
              
              <div className="text-sm text-slate-600 space-y-1 mb-4 flex-1">
                <div className="flex items-center gap-2">
                  <FiUser className="text-slate-400" />
                  <span className="font-medium text-slate-800">{item.first_name} {item.last_name}</span>
                </div>
                <p className="pl-6 text-xs text-slate-500">{item.course} {item.year_level}</p>
                
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p><span className="font-semibold">Purpose:</span> {item.purpose}</p>
                  <p className="text-xs text-slate-400 mt-1">Borrowed: {new Date(item.item_created).toLocaleString()}</p>
                </div>
              </div>
              
              <button
                onClick={() => handleReturn(item.borrowed_item_id)}
                className="w-full py-2 bg-white border-2 border-[#A5192D] text-[#A5192D] hover:bg-[#A5192D] hover:text-white rounded-md font-bold transition-colors flex items-center justify-center gap-2"
              >
                <FiCheckCircle /> Mark as Returned
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NewBookingForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { confirm } = useConfirm();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<{item_id: number, quantity: number, type: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredProfiles, setFilteredProfiles] = useState<any[]>([]);

  const handleSelectProfile = (profile: any) => {
    setSelectedProfile(profile.id);
    setSearchTerm(`${profile.first_name} ${profile.last_name}`);
    setShowDropdown(false);
  };

  // Initial load for inventory only, profiles load dynamically
  useEffect(() => {
    apiFetch('/api/index.php?route=inventory&action=items')
      .then(res => {
        setInventory(res.items || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load inventory');
        setLoading(false);
      });
  }, []);

  // Debounced search for profiles
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 1 && !selectedProfile) {
        apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(searchTerm)}&per_page=20`)
          .then(res => {
            setFilteredProfiles(res.profiles || []);
          })
          .catch(console.error);
      } else if (searchTerm.length === 0) {
        setFilteredProfiles([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedProfile]);

  const handleAddItem = (item: any) => {
    if (selectedItems.some(i => i.item_id === item.id)) return;
    if (item.total_stock <= 0) {
      confirm({
        title: 'Out of Stock',
        message: `${item.brand_name || item.generic_name} is currently out of stock.`,
        type: 'danger',
        confirmText: 'Okay',
        hideCancel: true
      });
      return;
    }
    setSelectedItems(prev => [...prev, {
      item_id: item.id,
      quantity: 1,
      type: item.category === 'equipment' ? 'equipment' : 'supply'
    }]);
  };

  const handleQuickAddMedicalKit = () => {
    // Defines common keywords for items that would belong in a Medical Kit
    const medKitKeywords = ['alcohol', 'betadine', 'cotton', 'bandage', 'thermometer', 'first aid', 'kit'];
    const itemsToAdd: any[] = [];
    
    inventory.forEach(item => {
      const name = (item.generic_name + ' ' + item.brand_name).toLowerCase();
      if (medKitKeywords.some(kw => name.includes(kw)) && item.total_stock > 0) {
        if (!selectedItems.some(i => i.item_id === item.id) && !itemsToAdd.some(i => i.item_id === item.id)) {
           itemsToAdd.push({
             item_id: item.id,
             quantity: 1,
             type: item.category === 'equipment' ? 'equipment' : 'supply'
           });
        }
      }
    });

    if (itemsToAdd.length > 0) {
      setSelectedItems(prev => [...prev, ...itemsToAdd]);
      toast.success(`Added ${itemsToAdd.length} Medical Kit items to cart!`);
      if (!purpose) setPurpose('Intramurals / Sports Event');
    } else {
      toast.error('No available Medical Kit items found in inventory.');
    }
  };

  const handleRemoveItem = (id: number) => {
    setSelectedItems(selectedItems.filter(i => i.item_id !== id));
  };

  const handleQuantityChange = (id: number, delta: number) => {
    const itemData = inventory.find(i => i.id === id);
    if (!itemData) return;
    
    setSelectedItems(selectedItems.map(i => {
      if (i.item_id === id) {
        let newQ = Math.max(1, i.quantity + delta);
        if (newQ > itemData.total_stock) {
          confirm({
            title: 'Stock Limit Reached',
            message: `You cannot add more. We only have ${itemData.total_stock} of ${itemData.brand_name || itemData.generic_name} in stock!`,
            type: 'warning',
            confirmText: 'Okay',
            hideCancel: true
          });
          newQ = itemData.total_stock;
        }
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return toast.error('Please select a borrower');
    if (!purpose.trim()) return toast.error('Please enter the purpose');
    if (selectedItems.length === 0) return toast.error('Please select at least one item');
    
    setSubmitting(true);
    try {
      await apiFetch('/api/index.php?route=borrowings&action=submit', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: selectedProfile,
          purpose,
          expected_return_date: expectedReturnDate || null,
          items: selectedItems.map(i => ({
            inventory_item_id: i.item_id,
            quantity: i.quantity,
            item_type: i.type
          }))
        })
      });
      toast.success('Borrowing request submitted successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading form...</div>;

  return (
    <form onSubmit={handleSubmit} className="p-8 h-full overflow-y-auto bg-slate-50/30">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Section 1: Borrower Information */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">1. Borrower Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Search Profile (Student/Staff)</label>
              <input
                type="text"
                placeholder="Type a name to search..."
                className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setSelectedProfile('');
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
              
              {showDropdown && filteredProfiles.length > 0 && !selectedProfile && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredProfiles.map(p => (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors"
                      onClick={() => handleSelectProfile(p)}
                    >
                      <div className="font-semibold text-slate-800">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="uppercase font-bold tracking-wider">{p.profile_type}</span>
                        {p.course && <span>• {p.course} {p.year_level}</span>}
                        {p.department && <span>• {p.department}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showDropdown && searchTerm.length > 0 && filteredProfiles.length === 0 && !selectedProfile && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-3 text-sm text-slate-500 text-center">
                  No profiles found matching "{searchTerm}"
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose of Borrowing</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Intramurals, First Aid, Class Demo"
                    required
                    className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['Intramurals', 'Field Trip', 'Class Activity', 'PE Class'].map(preset => (
                      <button 
                        key={preset} type="button" 
                        onClick={() => setPurpose(preset)} 
                        className={`text-[10px] px-2 py-1 rounded-md border font-bold transition-colors ${purpose === preset ? 'bg-[#A5192D] text-white border-[#A5192D]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Expected Return Date</label>
                <input
                  type="datetime-local"
                  className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors text-sm"
                  value={expectedReturnDate}
                  onChange={e => setExpectedReturnDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Equipment Selection */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-2 gap-4">
            <h2 className="text-xl font-bold text-slate-800">2. Equipment & Supplies</h2>
            <button
              type="button"
              onClick={handleQuickAddMedicalKit}
              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <FiBriefcase className="w-4 h-4" />
              + Quick Add Medical Kit
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Catalog list */}
            <div className="lg:w-1/2 flex flex-col">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Available Catalog</h3>
              <div className="mb-3 relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search available items..."
                  className="w-full border border-slate-300 pl-9 p-2 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors text-sm"
                  value={catalogSearchTerm}
                  onChange={e => setCatalogSearchTerm(e.target.value)}
                />
              </div>
              <div className="border border-slate-200 rounded-md h-[300px] overflow-y-auto flex-1">
                {inventory
                  .filter(item => {
                    if (!catalogSearchTerm) return true;
                    const matchStr = `${item.generic_name} ${item.brand_name} ${item.category}`.toLowerCase();
                    return matchStr.includes(catalogSearchTerm.toLowerCase());
                  })
                  .map(item => {
                  const isSelected = selectedItems.some(i => i.item_id === item.id);
                  const isOutOfStock = Number(item.total_stock) <= 0;
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${isOutOfStock ? 'bg-slate-50/50' : ''}`}>
                      <div>
                        <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {item.brand_name || item.generic_name}
                          <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        </p>
                        <div className="mt-1.5">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase tracking-wide">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wide">
                              {Number(item.total_stock)} In Stock
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddItem(item)}
                        disabled={isSelected || isOutOfStock}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          isSelected 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : isOutOfStock
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                              : 'bg-[#A5192D] text-white hover:bg-[#8B1424] shadow-sm active:scale-95'
                        }`}
                      >
                        {isSelected ? 'Added' : isOutOfStock ? 'Empty' : 'Select'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Selected items */}
            <div className="lg:w-1/2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Selected Items</h3>
              {selectedItems.length === 0 ? (
                <div className="h-[300px] border-2 border-dashed border-slate-200 rounded-md flex items-center justify-center text-slate-400">
                  Select items from the catalog
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map(sItem => {
                    const itemData = inventory.find(i => i.id === sItem.item_id);
                    return (
                      <div key={sItem.item_id} className="bg-slate-50 border border-slate-200 p-3 rounded-md flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{itemData?.brand_name || itemData?.generic_name}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400">{sItem.type === 'equipment' ? 'To be returned' : 'Consumable'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white border border-slate-200 rounded-md">
                            <button type="button" onClick={() => handleQuantityChange(sItem.item_id, -1)} className="px-2 py-1 text-slate-500 hover:text-slate-800">-</button>
                            <span className="w-8 text-center font-bold text-sm">{sItem.quantity}</span>
                            <button type="button" onClick={() => handleQuantityChange(sItem.item_id, 1)} className="px-2 py-1 text-slate-500 hover:text-slate-800">+</button>
                          </div>
                          <button type="button" onClick={() => handleRemoveItem(sItem.item_id)} className="text-red-500 hover:text-red-700 font-bold text-sm">
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Agreement */}
        <section className="bg-slate-100 p-6 rounded-xl border border-slate-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" required className="mt-1 w-5 h-5 accent-[#A5192D]" />
            <span className="text-sm text-slate-700 leading-relaxed">
              <strong>I agree to the terms and conditions.</strong> The borrower is responsible for returning all equipment in the same condition as when borrowed. Any equipment that is lost or damaged while in your possession must be replaced or the cost of repair/replacement must be reimbursed to the clinic. Consumable supplies will be permanently dispensed.
            </span>
          </label>
        </section>

        <div className="flex justify-end pt-4 pb-12">
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#A5192D] text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-[#8B1424] transition-colors shadow-md disabled:opacity-70 flex items-center gap-2"
          >
            {submitting ? 'Submitting...' : 'Submit Booking Request'}
          </button>
        </div>

      </div>
    </form>
  );
};

const BookingHistoryList: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/index.php?route=borrowings&action=recent_history')
      .then(res => {
        setHistory(res.history || []);
        setLoading(false);
      })
      .catch(e => {
        toast.error('Failed to load borrowing history');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading history...</div>;

  return (
    <div className="p-6 h-full overflow-y-auto">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-20">
          <FiBox size={48} className="mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-slate-700">No booking history available</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-5 flex flex-col md:flex-row md:items-start gap-4 hover:border-slate-300 transition-colors bg-slate-50/50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FiUser className="text-slate-400" />
                  <span className="font-bold text-slate-700">{record.first_name} {record.last_name}</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold ml-2 uppercase">
                    {record.profile_type}
                  </span>
                </div>
                {record.course && (
                  <p className="text-sm text-slate-500 ml-6">{record.course}</p>
                )}
                <div className="mt-3 ml-6">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Purpose</p>
                  <p className="text-sm text-slate-600 bg-white p-2 border border-slate-100 rounded-md inline-block min-w-[200px]">{record.purpose}</p>
                </div>
              </div>
              
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Items Borrowed / Dispensed</p>
                <div className="space-y-2">
                  {record.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-white p-2 border border-slate-100 rounded-md shadow-sm">
                      <span className="font-medium text-slate-700">{item.generic_name} <span className="text-slate-400 text-xs">x{item.quantity}</span></span>
                      {item.status === 'borrowed' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">ACTIVE</span>}
                      {item.status === 'returned' && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">RETURNED</span>}
                      {item.status === 'dispensed' && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">DISPENSED</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-right text-xs text-slate-400 font-medium ml-auto whitespace-nowrap">
                {new Date(record.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Borrowings;
