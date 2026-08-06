import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  FiFileText, FiCheckCircle, FiTruck, FiPackage, FiBox, 
  FiSearch, FiTrendingUp, FiTrendingDown, FiClock, FiEdit3, 
  FiCheck, FiTag, FiUser, FiMapPin, FiChevronRight, FiRefreshCw, FiChevronDown, FiX
} from 'react-icons/fi';

interface InventoryLog {
  id: number;
  batch_number: string;
  clinic_branch: string;
  generic_name: string;
  category: string;
  action_type: 'restock' | 'dispense' | 'dispose' | 'adjust';
  quantity_changed: number;
  disposed_to: string | null;
  processor_name: string | null;
  created_at: string;
}

const InventoryLogs: React.FC = () => {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<InventoryLog | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const logsRes = await apiFetch('/api/index.php?route=inventory&action=logs');
      const loadedLogs = logsRes.logs || [];
      setLogs(loadedLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'restock': return <FiTrendingUp className="text-emerald-600" />;
      case 'dispense': return <FiTrendingDown className="text-orange-500" />;
      case 'dispose': return <FiTrendingDown className="text-rose-600" />;
      case 'adjust': return <FiEdit3 className="text-blue-600" />;
      default: return <FiClock className="text-slate-500" />;
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'restock': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'dispense': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'dispose': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'adjust': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.generic_name.toLowerCase().includes(search.toLowerCase()) ||
      (log.batch_number && log.batch_number.toLowerCase().includes(search.toLowerCase())) ||
      (log.disposed_to && log.disposed_to.toLowerCase().includes(search.toLowerCase())) ||
      (log.processor_name && log.processor_name.toLowerCase().includes(search.toLowerCase()));
    
    if (actionFilter === 'all') return matchesSearch;
    return matchesSearch && log.action_type === actionFilter;
  });

  const getStepperStatus = (log: InventoryLog) => {
    if (log.action_type === 'dispense') return 5;
    if (log.action_type === 'restock') return 4;
    if (log.action_type === 'adjust') return 3;
    return 2;
  };

  const handleToggleLog = (log: InventoryLog) => {
    if (selectedLog?.id === log.id) {
      setSelectedLog(null); // collapse if tapped again
    } else {
      setSelectedLog(log); // expand tapped log
    }
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FiPackage className="text-[#8c1526]" /> Inventory Audit & Activity Tracking
          </h2>
          <p className="text-xs text-slate-500">Tap any log entry to reveal its complete Shopee-style tracking icons and progress stepper.</p>
        </div>
        <button 
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh Logs
        </button>
      </div>

      {/* Shopee-style Horizontal Progress Stepper Card (Only shown when a log is tapped/selected) */}
      {selectedLog && (
        <div className="bg-white rounded-2xl border-2 border-[#8c1526]/30 shadow-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 relative">
          <button 
            onClick={() => setSelectedLog(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
            title="Close Stepper View"
          >
            <FiX size={16} />
          </button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3 pr-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TRACKING REF:</span>
              <span className="font-mono text-sm font-extrabold text-[#8c1526] bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                {selectedLog.batch_number || `LOG-#${selectedLog.id}`}
              </span>
              <span className="text-xs font-medium text-slate-400">|</span>
              <span className="text-xs font-bold text-slate-700">{selectedLog.generic_name} ({selectedLog.clinic_branch})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">ACTION STATUS:</span>
              <span className={`px-3 py-1 text-xs font-extrabold rounded-full uppercase border ${getActionBadge(selectedLog.action_type)}`}>
                {selectedLog.action_type}
              </span>
            </div>
          </div>

          {/* Stepper Steps (Shopee 5-step visual bar) */}
          <div className="py-4 px-2 sm:px-8">
            <div className="relative flex justify-between items-center">
              {/* Connecting Background Line */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
              {/* Active Progress Line */}
              <div 
                className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
                style={{ width: `${((getStepperStatus(selectedLog) - 1) / 4) * 100}%` }}
              ></div>

              {/* Step 1: Order / Catalog Item Created */}
              <div className="relative z-10 flex flex-col items-center group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  getStepperStatus(selectedLog) >= 1 ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105' : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <FiFileText size={18} />
                </div>
                <span className="mt-2 text-xs font-bold text-slate-800 text-center">Item Registered</span>
                <span className="text-[10px] text-slate-400">Catalog Entry</span>
              </div>

              {/* Step 2: PO Approved */}
              <div className="relative z-10 flex flex-col items-center group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  getStepperStatus(selectedLog) >= 2 ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105' : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <FiCheckCircle size={18} />
                </div>
                <span className="mt-2 text-xs font-bold text-slate-800 text-center">PO Approved</span>
                <span className="text-[10px] text-slate-400">Inventory Verification</span>
              </div>

              {/* Step 3: In Transit / Arrived */}
              <div className="relative z-10 flex flex-col items-center group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  getStepperStatus(selectedLog) >= 3 ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105' : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <FiTruck size={18} />
                </div>
                <span className="mt-2 text-xs font-bold text-slate-800 text-center">Batch Arrived</span>
                <span className="text-[10px] text-slate-400">FEFO Expiry Tracked</span>
              </div>

              {/* Step 4: Restocked to Branch */}
              <div className="relative z-10 flex flex-col items-center group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  getStepperStatus(selectedLog) >= 4 ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105' : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <FiBox size={18} />
                </div>
                <span className="mt-2 text-xs font-bold text-slate-800 text-center">Restocked</span>
                <span className="text-[10px] text-slate-400">{selectedLog.clinic_branch}</span>
              </div>

              {/* Step 5: Completed / Active Dispense */}
              <div className="relative z-10 flex flex-col items-center group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  getStepperStatus(selectedLog) >= 5 ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105' : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <FiCheck size={20} />
                </div>
                <span className="mt-2 text-xs font-bold text-slate-800 text-center">Dispensed / Completed</span>
                <span className="text-[10px] text-slate-400">Active Patient Notes</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-2 border border-slate-100">
            <div className="flex items-center gap-2">
              <FiUser className="text-slate-400" />
              <span>Processed by: <strong className="text-slate-800">{selectedLog.processor_name || 'System Admin'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FiMapPin className="text-slate-400" />
              <span>Location: <strong className="text-slate-800">{selectedLog.clinic_branch}</strong></span>
            </div>
            <div>
              <span className="text-slate-500">Timestamp: </span>
              <strong className="text-slate-800">{new Date(selectedLog.created_at).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by item, batch, processor..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#8c1526] bg-white shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Filter Action:</label>
          <select 
            value={actionFilter} 
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-700 bg-white font-medium focus:outline-none focus:border-[#8c1526]"
          >
            <option value="all">All Actions</option>
            <option value="restock">Restock (+)</option>
            <option value="dispense">Dispense (-)</option>
            <option value="dispose">Dispose (-)</option>
            <option value="adjust">Adjust (±)</option>
          </select>
        </div>
      </div>

      {/* Detailed Vertical Tracking Timeline List */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
            <FiClock /> Delivery & Audit Checkpoints History
          </h3>
          <span className="text-xs text-slate-500 font-medium">Tap any log card to view full tracking icons</span>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading activity checkpoints...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No activity log records found matching your search.</div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                return (
                  <div 
                    key={log.id} 
                    onClick={() => handleToggleLog(log)}
                    className={`relative cursor-pointer group transition-all p-4 rounded-xl border ${
                      isSelected 
                        ? 'bg-rose-50/40 border-[#8c1526] shadow-sm ring-1 ring-[#8c1526]/30' 
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    {/* Circle Indicator (Only shows full icons when tapped/selected) */}
                    <div className={`absolute -left-[31px] sm:-left-[39px] top-4 w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-xs transition-all ${
                      isSelected 
                        ? 'bg-[#8c1526] border-[#8c1526] text-white scale-110' 
                        : 'bg-slate-100 border-slate-300 text-slate-400 group-hover:border-[#8c1526] group-hover:text-[#8c1526]'
                    }`}>
                      {isSelected ? (
                        <FiCheck size={14} />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 group-hover:bg-[#8c1526] transition-colors" />
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500">
                            {new Date(log.created_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase border ${getActionBadge(log.action_type)}`}>
                            {log.action_type}
                          </span>
                          {/* Reveal Icons Badge Prompt */}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                            isSelected 
                              ? 'bg-[#8c1526] text-white' 
                              : 'bg-slate-100 text-slate-600 group-hover:bg-rose-100 group-hover:text-[#8c1526]'
                          }`}>
                            {isSelected ? 'Icons Active' : 'Tap to View Icons'} 
                            {isSelected ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-800 mt-1.5 flex items-center gap-2">
                          <span>
                            {log.action_type === 'restock' ? 'Inventory Restocked into Batch' : 
                             log.action_type === 'dispense' ? 'Dispensed for Medical Treatment' : 
                             log.action_type === 'dispose' ? 'Item Disposed / Discarded' : 'Stock Quantity Adjusted'}
                          </span>
                          <span className="text-[#8c1526] font-extrabold">— {log.generic_name}</span>
                        </h4>

                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {log.disposed_to ? (
                            <>Details / Recipient: <span className="font-semibold text-slate-700">{log.disposed_to}</span> • </>
                          ) : null}
                          Branch: <span className="font-semibold text-slate-700">{log.clinic_branch}</span> • Processed by: <span className="font-semibold text-slate-700">{log.processor_name || 'System Admin'}</span>
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                          {log.batch_number ? `Batch: ${log.batch_number}` : `Ref: LOG-${log.id}`}
                        </span>
                        <span className={`text-sm font-extrabold mt-1 ${log.quantity_changed > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed} units
                        </span>
                      </div>
                    </div>

                    {/* Inline Icon Badge summary when tapped */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-rose-100 flex items-center gap-4 text-xs font-medium text-slate-700 animate-in fade-in duration-200">
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {getActionIcon(log.action_type)} Action: {log.action_type.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <FiUser /> {log.processor_name || 'System Admin'}
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <FiMapPin /> {log.clinic_branch}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryLogs;
