import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FiGrid, FiUsers, FiActivity, FiClock, FiBox, FiLogOut, FiSettings, FiFileText } from 'react-icons/fi';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const page = location.pathname.substring(1) || 'dashboard';
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/index.php?action=logout', { method: 'POST' });
      // Force a full page reload to clear all React state, memory variables, 
      // and most importantly, the cached CSRF token in api.ts
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: FiGrid },
    { id: 'patients', label: 'PATIENT LIST', icon: FiUsers },
    { id: 'consultation', label: 'CONSULTATION', icon: FiActivity },
    { id: 'appointments', label: 'APPOINTMENTS', icon: FiClock },
    { id: 'inventory', label: 'INVENTORY', icon: FiBox },
    { id: 'reports', label: 'REPORTS', icon: FiFileText }
  ];

  return (
    <div className="flex h-screen bg-[#F7F8FA] font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-[#9B101E] flex flex-col shadow-2xl z-20">
        <div className="pt-10 pb-6 px-6 flex flex-col items-center border-b border-white/20 mx-4">
          <img 
            src="/assets/logo.png" 
            alt="CJC Logo" 
            className="w-20 h-20 bg-white rounded-full object-contain p-1 shadow-md mb-4"
          />
          <h1 className="text-[1.35rem] font-bold text-white tracking-wide mb-1 flex items-start gap-0.5">
            CJC-Clinic<span className="text-[1rem] font-bold">+</span>
          </h1>
          <p className="text-[0.65rem] text-white/90 text-center uppercase tracking-wider font-medium">
            Clinic Patient Records System and Inventory
          </p>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const isActive = page === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/${item.id}`)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-md transition-all duration-200 border ${
                  isActive 
                    ? 'bg-white border-white text-[#9B101E] font-bold shadow-md' 
                    : 'bg-[#AB1A2A] border-[#C32C3E] text-white hover:bg-[#B71F30] font-semibold text-opacity-90 hover:text-opacity-100'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#9B101E]' : 'text-white/80'}`} strokeWidth={isActive ? 3 : 2.5} />
                <span className="text-[0.8rem] tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 mt-auto">
          <button
            onClick={() => navigate('/settings')}
            className={`flex items-center gap-2.5 w-full px-4 py-2.5 mb-2 text-[0.8rem] rounded-md transition-colors uppercase tracking-wider font-semibold ${
              page === 'settings' 
                ? 'bg-white text-[#9B101E] shadow-sm' 
                : 'text-[#9B101E] bg-white/90 hover:bg-white hover:shadow-sm'
            }`}
          >
            <FiSettings className="w-4 h-4" strokeWidth={2.5} />
            <span>Settings</span>
          </button>
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className="flex items-center justify-center gap-2.5 w-full px-4 py-3 text-[0.8rem] text-white/80 hover:text-white hover:bg-black/10 rounded-md transition-colors uppercase tracking-wider font-semibold"
          >
            <FiLogOut className="w-4 h-4 opacity-80" strokeWidth={2.5} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-[#F4F6F8] -z-10"></div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-scale-up">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Sign Out</h3>
            <p className="text-slate-500 mb-6 text-sm">
              Are you sure you want to sign out of the CJC Clinic System?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-[#C01D38] hover:bg-[#a0182f] rounded-md transition-colors shadow-sm"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;

