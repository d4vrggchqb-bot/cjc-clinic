import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, clearCsrfToken } from '../utils/api';
import { FiGrid, FiUsers, FiActivity, FiClock, FiBox, FiLogOut, FiSettings, FiFileText, FiChevronLeft, FiChevronRight, FiCalendar, FiMenu, FiX } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

const Layout: React.FC<{ children: React.ReactNode, user?: any }> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
      clearCsrfToken();
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
    { id: 'borrowings', label: 'EQUIPMENT BOOKING', icon: FiCalendar },
    { id: 'reports', label: 'REPORTS', icon: FiFileText }
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F7F8FA] font-sans overflow-hidden">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-[#9B101E] text-white flex items-center justify-between px-4 py-3 shadow-lg z-30 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src="/assets/logo.png" alt="CJC Logo" className="w-9 h-9 bg-white rounded-full object-contain p-0.5 shadow-sm" />
          <div>
            <h1 className="text-base font-bold tracking-wide flex items-center gap-0.5 leading-tight">
              CJC-Clinic<span className="text-xs font-bold">+</span>
            </h1>
            <p className="text-[0.6rem] text-white/80 uppercase tracking-wider font-semibold leading-tight">Patient & Inventory System</p>
          </div>
        </div>
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)} 
          aria-label="Toggle Navigation"
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          {isMobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${isCollapsed ? 'md:w-24' : 'md:w-72'} w-72
        transition-all duration-300 ease-in-out bg-[#9B101E] flex flex-col shadow-2xl md:z-50
      `}>
        {/* Desktop Toggle Button (Hidden on Mobile) */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block absolute -right-3 top-8 bg-white border border-slate-200 text-[#9B101E] p-1.5 rounded-full shadow-md z-30 hover:bg-slate-50 transition-colors"
        >
          {isCollapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
        </button>

        {/* Mobile Close Button in Sidebar */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden absolute right-4 top-4 text-white/80 hover:text-white bg-black/10 p-2 rounded-lg"
        >
          <FiX size={20} />
        </button>

        <div className={`pt-8 md:pt-10 pb-6 ${isCollapsed ? 'md:px-2' : 'px-6'} flex flex-col items-center border-b border-white/20 mx-4 transition-all duration-300`}>
          <img 
            src="/assets/logo.png" 
            alt="CJC Logo" 
            className={`${isCollapsed ? 'md:w-12 md:h-12 w-16 h-16' : 'w-20 h-20'} bg-white rounded-full object-contain p-1 shadow-md mb-3 transition-all duration-300`}
          />
          {(!isCollapsed || isMobileOpen) && (
            <div className={`flex flex-col items-center opacity-100 transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : ''}`}>
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
          <div className={`mx-4 mt-2 p-2 bg-black/10 rounded-lg flex items-center ${isCollapsed ? 'md:justify-center' : 'gap-3'} border border-white/5 shadow-inner transition-all duration-300`}>
            <div className="w-8 h-8 flex-shrink-0 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm border border-white/10" title={user.name || user.username}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className={`flex flex-col min-w-0 opacity-100 transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : ''}`}>
                <span className="text-white text-[0.75rem] font-bold truncate tracking-wide">{user.name || user.username}</span>
                <span className="text-white/70 text-[0.65rem] truncate capitalize mt-0.5">
                  {user.role} {user.clinic_branch ? ` • ${user.clinic_branch}` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const isActive = page === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(`/${item.id}`);
                  setIsMobileOpen(false);
                }}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-2 px-4 gap-3.5' : 'gap-3.5 px-4'} py-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-white/10 border border-white/20 text-white font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur-sm' 
                    : 'bg-transparent border border-transparent text-white hover:bg-white/10 hover:text-white font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-white/90'}`} strokeWidth={isActive ? 3 : 2.5} />
                <span className={`text-[0.8rem] tracking-wider whitespace-nowrap ${isCollapsed ? 'md:hidden block' : 'block'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 mt-auto border-t border-white/10">
          <button
            onClick={() => {
              navigate('/settings');
              setIsMobileOpen(false);
            }}
            title={isCollapsed ? 'Settings' : ''}
            className={`flex items-center ${isCollapsed ? 'md:justify-center md:px-2 px-4 gap-2.5' : 'gap-2.5 px-4'} w-full py-2.5 mb-2 text-[0.8rem] rounded-xl transition-all duration-300 uppercase tracking-wider font-semibold ${
              page === 'settings' 
                ? 'bg-white/10 border border-white/20 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur-sm' 
                : 'text-white bg-transparent border border-transparent hover:bg-white/10 hover:text-white'
            }`}
          >
            <FiSettings className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
            <span className={isCollapsed ? 'md:hidden block' : 'block'}>Settings</span>
          </button>
          <button 
            onClick={() => {
              setIsMobileOpen(false);
              handleLogout();
            }} 
            title={isCollapsed ? 'Sign Out' : ''}
            className={`flex items-center ${isCollapsed ? 'md:justify-center md:px-2 px-4 gap-2.5' : 'gap-2.5 px-4'} w-full py-2.5 text-[0.8rem] text-white hover:text-white hover:bg-black/20 rounded-xl transition-all duration-300 uppercase tracking-wider font-semibold`}
          >
            <FiLogOut className="w-5 h-5 flex-shrink-0 opacity-90" strokeWidth={2.5} />
            <span className={isCollapsed ? 'md:hidden block' : 'block'}>Sign Out</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#f8fafc]">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-slate-100 to-transparent -z-10"></div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

