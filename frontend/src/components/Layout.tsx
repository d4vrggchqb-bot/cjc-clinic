import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FiGrid, FiUsers, FiActivity, FiClock, FiBox, FiLogOut, FiSettings, FiFileText, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';


const Layout: React.FC<{ children: React.ReactNode, user?: any }> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const page = location.pathname.substring(1) || 'dashboard';

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of the CJC Clinic System?',
      type: 'info'
    });
    if (!confirmed) return;
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
      <aside className={`${isCollapsed ? 'w-24' : 'w-72'} transition-all duration-300 ease-in-out bg-[#9B101E] flex flex-col shadow-2xl z-20 relative`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 bg-white border border-slate-200 text-[#9B101E] p-1.5 rounded-full shadow-md z-30 hover:bg-slate-50 transition-colors"
        >
          {isCollapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
        </button>

        <div className={`pt-10 pb-6 ${isCollapsed ? 'px-2' : 'px-6'} flex flex-col items-center border-b border-white/20 mx-4 transition-all duration-300`}>
          <img 
            src="/assets/logo.png" 
            alt="CJC Logo" 
            className={`${isCollapsed ? 'w-12 h-12' : 'w-20 h-20'} bg-white rounded-full object-contain p-1 shadow-md mb-4 transition-all duration-300`}
          />
          {!isCollapsed && (
            <div className="flex flex-col items-center opacity-100 transition-opacity duration-300">
              <h1 className="text-[1.35rem] font-bold text-white tracking-wide mb-1 flex items-start gap-0.5 whitespace-nowrap">
                CJC-Clinic<span className="text-[1rem] font-bold">+</span>
              </h1>
              <p className="text-[0.65rem] text-white/90 text-center uppercase tracking-wider font-medium">
                Clinic Patient Records System and Inventory
              </p>
            </div>
          )}
        </div>

        {/* User Profile Widget (Minimalist) */}
        {user && (
          <div className={`mx-4 mt-2 p-2 bg-black/10 rounded-lg flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} border border-white/5 shadow-inner transition-all duration-300`}>
            <div className="w-8 h-8 flex-shrink-0 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm border border-white/10" title={user.name || user.username}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 opacity-100 transition-opacity duration-300">
                <span className="text-white text-[0.75rem] font-bold truncate tracking-wide">{user.name || user.username}</span>
                <span className="text-white/70 text-[0.65rem] truncate capitalize mt-0.5">
                  {user.role} {user.clinic_branch ? ` • ${user.clinic_branch}` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const isActive = page === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/${item.id}`)}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3.5 px-4'} py-3 rounded-md transition-all duration-200 border ${
                  isActive 
                    ? 'bg-white border-white text-[#9B101E] font-bold shadow-md' 
                    : 'bg-[#AB1A2A] border-[#C32C3E] text-white hover:bg-[#B71F30] font-semibold text-opacity-90 hover:text-opacity-100'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#9B101E]' : 'text-white/80'}`} strokeWidth={isActive ? 3 : 2.5} />
                {!isCollapsed && <span className="text-[0.8rem] tracking-wider whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 mt-auto">
          <button
            onClick={() => navigate('/settings')}
            title={isCollapsed ? 'Settings' : ''}
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-4'} w-full py-2.5 mb-2 text-[0.8rem] rounded-md transition-colors uppercase tracking-wider font-semibold ${
              page === 'settings' 
                ? 'bg-white text-[#9B101E] shadow-sm' 
                : 'text-[#9B101E] bg-white/90 hover:bg-white hover:shadow-sm'
            }`}
          >
            <FiSettings className="w-5 h-5" strokeWidth={2.5} />
            {!isCollapsed && <span>Settings</span>}
          </button>
          <button 
            onClick={handleLogout} 
            title={isCollapsed ? 'Sign Out' : ''}
            className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-4'} justify-center w-full py-3 text-[0.8rem] text-white/80 hover:text-white hover:bg-black/10 rounded-md transition-colors uppercase tracking-wider font-semibold`}
          >
            <FiLogOut className="w-5 h-5 opacity-80" strokeWidth={2.5} />
            {!isCollapsed && <span>Sign Out</span>}
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
    </div>
  );
};

export default Layout;

