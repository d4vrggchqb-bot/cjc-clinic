import React, { useState } from 'react';
import InventoryCatalog from '../components/InventoryCatalog';
import PurchaseOrders from '../components/PurchaseOrders';
import InventoryLogs from '../components/InventoryLogs';
// import InventoryLogs from '../components/InventoryLogs'; // Optional for future

const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'orders' | 'logs'>('catalog');

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Inventory Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">Track medicines, supplies, and equipment per clinic branch.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Catalog & Batches
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
          onClick={() => setActiveTab('logs')}
          className={`py-2.5 sm:py-3 px-4 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-[#A5192D] text-[#A5192D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Activity Logs
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-6 overflow-hidden flex flex-col">
        {activeTab === 'catalog' && <InventoryCatalog />}
        {activeTab === 'orders' && <PurchaseOrders />}
        {activeTab === 'logs' && <InventoryLogs />}
      </div>
    </div>
  );
};

export default Inventory;
