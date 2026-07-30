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

  const getPageInfo = () => {
    switch (page) {
      case 'dashboard': return { title: 'Dashboard', subtitle: 'Overview of clinic activity' };
      case 'patients': return { title: 'Patient List', subtitle: 'Manage student and employee profiles' };
      case 'consultation': return { title: 'Consultations', subtitle: 'Active patient queues and medical records' };
      case 'appointments': return { title: 'Appointments', subtitle: 'Manage scheduled visits and follow-ups' };
      case 'inventory': return { title: 'Inventory Management', subtitle: 'Track medicines, supplies, and equipments' };
      case 'borrowings': return { title: 'Equipment Booking', subtitle: 'Manage borrowed clinic equipments' };
      case 'reports': return { title: 'Reports & Analytics', subtitle: 'View clinic statistics and export data' };
      case 'settings': return { title: 'Settings', subtitle: 'Manage clinic configuration, accounts, and preferences' };
      default: return { title: '', subtitle: '' };
    }
  };
  const pageInfo = getPageInfo();

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
    { id: 'inventory', label: 'INVENTORY', icon: FiBox, roles: ['Superadmin', 'Admin', 'Doctor', 'Nurse'] },
    { id: 'borrowings', label: 'EQUIPMENT BOOKING', icon: FiCalendar },
    { id: 'reports', label: 'REPORTS', icon: FiFileText, roles: ['Superadmin', 'Admin'] }
  ].filter(item => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#FDFBF7] font-sans overflow-hidden">
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
        

      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#FDFBF7]">
        
        {/* Top Header Actions (Settings & Logout) */}
        <header className="h-auto min-h-[5rem] py-3 sm:py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex justify-between items-center px-4 sm:px-8 gap-4 shrink-0 z-20 shadow-sm relative w-full">
          
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-[28px] font-bold text-[#A5192D] tracking-tight leading-tight">
                {pageInfo.title}
              </h1>
              {user && user.role !== 'Superadmin' && user.clinic_branch && (
                <span className="bg-[#C01D38]/10 text-[#C01D38] border border-[#C01D38]/20 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tracking-wide uppercase whitespace-nowrap">
                  {user.clinic_branch}
                </span>
              )}
            </div>
            <p className="text-[12px] sm:text-[14px] text-slate-500 font-semibold leading-tight hidden sm:block mt-0.5">
              {pageInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="mr-3 text-slate-500 text-[12px] font-medium hidden lg:block">
                Welcome back, <span className="font-bold text-slate-700">{user.name || user.username}</span>
              </div>
            )}
            {user && ['Superadmin', 'Admin'].includes(user.role) && (
              <button
                onClick={() => navigate('/settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                  page === 'settings' ? 'text-[#C01D38] bg-red-50' : 'text-slate-600 hover:text-[#C01D38] hover:bg-red-50'
                }`}
              >
                <FiSettings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            )}
            
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <FiLogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Subtle decorative background gradient */}
        <div className="absolute top-14 left-0 right-0 h-64 bg-gradient-to-b from-[#F5F0E6] to-transparent -z-10"></div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

