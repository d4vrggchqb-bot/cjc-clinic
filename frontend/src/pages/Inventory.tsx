import React, { useState } from 'react';
import { FiEye } from 'react-icons/fi';
import { useBranch } from '../context/BranchContext';
import InventoryCatalog from '../components/InventoryCatalog';
import PurchaseOrders from '../components/PurchaseOrders';
import ExpirationWatch from '../components/ExpirationWatch';
import InventoryAuditTrail from '../components/InventoryAuditTrail';
import InventoryReport from '../components/InventoryReport';

const Inventory: React.FC = () => {
  const { isSuperAdmin } = useBranch();
  const [activeTab, setActiveTab] = useState<'catalog' | 'expiration' | 'audit' | 'orders' | 'reports'>('catalog');

  return (
    <div className="px-5 py-5 w-full h-full flex flex-col">
      {isSuperAdmin && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 px-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-800 shadow-xs">
          <div className="flex items-center gap-2">
            <FiEye className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Superadmin View & Reports Mode:</strong> You have system-wide stock visibility and reporting capabilities across all branches. Inventory transactions (dispensing, restocking, transfers, disposal) are reserved for Clinic staff.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
          >
            Go to Reports
          </button>
        </div>
      )}

      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Catalog & Stocks
        </button>
        <button
          onClick={() => setActiveTab('expiration')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'expiration'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Expiration Watch
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Inventory Reports
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-6 overflow-hidden flex flex-col">
        {activeTab === 'catalog' && <InventoryCatalog />}
        {activeTab === 'expiration' && <ExpirationWatch />}
        {activeTab === 'audit' && <InventoryAuditTrail />}
        {activeTab === 'orders' && <PurchaseOrders />}
        {activeTab === 'reports' && <InventoryReport />}
      </div>
    </div>
  );
};

export default Inventory;
