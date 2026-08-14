import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, clearCsrfToken } from '../utils/api';
import { FiGrid, FiUsers, FiActivity, FiClock, FiBox, FiLogOut, FiSettings, FiFileText, FiChevronLeft, FiChevronRight, FiCalendar, FiMenu, FiX, FiRepeat, FiUserCheck, FiLock, FiShield, FiUser, FiTrash2, FiPlus, FiCheck } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';
import { SyncStatusBadge } from './SyncStatusBadge';

interface SavedAccount {
  username: string;
  name?: string;
  role?: string;
  branch?: string;
}

const SAVED_ACCOUNTS_KEY = 'cjc_saved_switch_accounts';

const getSavedAccountsFromStorage = (): SavedAccount[] => {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load saved accounts', e);
  }
  return [];
};

const saveAccountToStorage = (acc: { username: string; name?: string; role?: string; clinic_branch?: string; branch?: string }): SavedAccount[] => {
  if (!acc.username) return getSavedAccountsFromStorage();
  try {
    const list = getSavedAccountsFromStorage();
    const existingIdx = list.findIndex(a => a.username.toLowerCase() === acc.username.toLowerCase());
    const newItem: SavedAccount = {
      username: acc.username,
      name: acc.name || acc.username,
      role: acc.role || 'Staff',
      branch: acc.clinic_branch || acc.branch || 'College Clinic'
    };
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...newItem };
    } else {
      list.push(newItem);
    }
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Failed to save account', e);
    return getSavedAccountsFromStorage();
  }
};

const Layout: React.FC<{ children: React.ReactNode, user?: any }> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cjc_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(getSavedAccountsFromStorage);
  const [switchUsername, setSwitchUsername] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switchLoading, setSwitchLoading] = useState(false);

  useEffect(() => {
    if (user && user.username) {
      const updated = saveAccountToStorage(user);
      setSavedAccounts(updated);
    }
  }, [user]);

  const handleRemoveSavedAccount = (usernameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.username.toLowerCase() !== usernameToRemove.toLowerCase());
    setSavedAccounts(updated);
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save updated list', err);
    }
  };

  const page = location.pathname.substring(1) || 'dashboard';

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cjc_sidebar_collapsed', String(next));
      } catch (e) {
        console.error('Failed to save sidebar state', e);
      }
      return next;
    });
  };

  const getPageInfo = () => {
    switch (page) {
      case 'dashboard': return { title: 'Clinic Dashboard', subtitle: 'Overview of daily queue, admissions, and stats' };
      case 'patients': return { title: 'Patient Profiles', subtitle: 'Manage student, employee, and guest records' };
      case 'consultation': return { title: 'Consultations & Queue', subtitle: 'Record medical findings, diagnoses, and prescriptions' };
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

  const handleSwitchAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchUsername.trim() || !switchPassword.trim()) {
      setSwitchError('Please provide username and password.');
      return;
    }
    setSwitchLoading(true);
    setSwitchError('');

    try {
      await apiFetch('/api/index.php?action=logout', { method: 'POST' });
      clearCsrfToken();

      const res = await apiFetch('/api/index.php?action=login', {
        method: 'POST',
        body: JSON.stringify({ username: switchUsername.trim(), password: switchPassword.trim() })
      });

      if (res.success) {
        if (res.user) {
          saveAccountToStorage(res.user);
        } else {
          saveAccountToStorage({ username: switchUsername.trim() });
        }
        window.location.href = '/dashboard';
      } else {
        setSwitchError(res.error || 'Invalid credentials. Failed to switch account.');
        setSwitchLoading(false);
      }
    } catch (err) {
      console.error('Switch account error:', err);
      setSwitchError('Failed to execute account switch.');
      setSwitchLoading(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: FiGrid },
    { id: 'patients', label: 'PATIENT LIST', icon: FiUsers, roles: ['Admin', 'Staff', 'Doctor', 'Nurse'] },
    { id: 'consultation', label: 'CONSULTATION', icon: FiActivity, roles: ['Admin', 'Staff', 'Doctor', 'Nurse'] },
    { id: 'appointments', label: 'APPOINTMENTS', icon: FiClock, roles: ['Admin', 'Staff', 'Doctor', 'Nurse'] },
    { id: 'inventory', label: 'INVENTORY', icon: FiBox, roles: ['Admin', 'Staff', 'Doctor', 'Nurse'] },
    { id: 'borrowings', label: 'EQUIPMENT BOOKING', icon: FiCalendar, roles: ['Admin', 'Staff', 'Doctor', 'Nurse'] },
    { id: 'reports', label: 'REPORTS', icon: FiFileText, roles: ['Superadmin', 'Admin', 'Staff', 'Doctor', 'Nurse'] },
    { id: 'settings', label: 'SYSTEM SETTINGS', icon: FiSettings, roles: ['Superadmin'] }
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
          onClick={() => setIsMobileOpen(true)}
          className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <FiMenu size={22} />
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        ${isCollapsed ? 'md:w-[4.8rem]' : 'md:w-64'} w-72
        bg-[#9B101E] text-white flex flex-col shadow-2xl transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <button 
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3.5 top-7 bg-white text-[#9B101E] p-1.5 rounded-full shadow-md hover:bg-red-50 border border-slate-200 transition-colors z-20 cursor-pointer"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <FiChevronRight size={14} strokeWidth={3} /> : <FiChevronLeft size={14} strokeWidth={3} />}
        </button>

        <button 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden absolute right-4 top-4 text-white/80 hover:text-white bg-black/10 p-2 rounded-lg"
        >
          <FiX size={20} />
        </button>

        <div className={`pt-6 pb-5 ${isCollapsed ? 'md:px-2' : 'px-5'} flex flex-col items-center border-b border-white/20 mx-3 transition-all duration-300`}>
          <img 
            src="/assets/logo.png" 
            alt="CJC Logo" 
            className={`${isCollapsed ? 'md:w-10 md:h-10 w-16 h-16' : 'w-16 h-16 sm:w-20 sm:h-20'} bg-white rounded-full object-contain p-1 shadow-md mb-2 transition-all duration-300`}
          />
          {(!isCollapsed || isMobileOpen) && (
            <div className={`flex flex-col items-center opacity-100 transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : ''}`}>
              <h1 className="text-[1.25rem] sm:text-[1.35rem] font-bold text-white tracking-wide mb-0.5 flex items-start gap-0.5 whitespace-nowrap">
                CJC-Clinic<span className="text-[1rem] font-bold">+</span>
              </h1>
              <p className="text-[0.6rem] sm:text-[0.65rem] text-white/90 text-center uppercase tracking-wider font-medium leading-tight">
                Clinic Patient Records System and Inventory
              </p>
            </div>
          )}
        </div>

        {user && (
          <div 
            title={isCollapsed ? `${user.name || user.username} (${user.role})` : ''}
            className={`mx-3 mt-3 p-2 bg-black/15 rounded-xl flex items-center ${isCollapsed ? 'md:justify-center' : 'gap-3'} border border-white/10 shadow-inner transition-all duration-300`}
          >
            <div className="w-8 h-8 flex-shrink-0 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs border border-white/20">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className={`flex flex-col min-w-0 opacity-100 transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : ''}`}>
                <span className="text-white text-[0.75rem] font-bold truncate tracking-wide">{user.name || user.username}</span>
                <span className="text-white/80 text-[0.65rem] truncate capitalize mt-0.5">
                  {user.role} {user.clinic_branch ? ` • ${user.clinic_branch}` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
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
                className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:px-0 px-4 gap-3.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? 'bg-white/15 border border-white/25 text-white font-bold shadow-md backdrop-blur-xs' 
                    : 'bg-transparent border border-transparent text-white/90 hover:bg-white/10 hover:text-white font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-white/85'}`} strokeWidth={isActive ? 2.8 : 2.2} />
                <span className={`text-[0.78rem] tracking-wider whitespace-nowrap ${isCollapsed ? 'md:hidden block' : 'block'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#FDFBF7] min-w-0">
        
        {/* Top Header Actions */}
        <header className="h-auto min-h-[4.5rem] py-3 px-4 sm:px-6 bg-white/90 backdrop-blur-md border-b border-slate-200 flex justify-between items-center gap-4 shrink-0 z-20 shadow-xs relative w-full">
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand Sidebar" : "Minimize Sidebar"}
              aria-label="Toggle Sidebar"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:text-[#9B101E] bg-slate-100/90 hover:bg-red-50 transition-all border border-slate-200 shadow-2xs group cursor-pointer"
            >
              <FiMenu className="w-5 h-5 transition-transform duration-200 group-hover:scale-110 text-[#9B101E]" />
              <span className="text-xs font-bold text-slate-600 group-hover:text-[#9B101E] tracking-wide">
                {isCollapsed ? 'Expand Sidebar' : 'Minimize Sidebar'}
              </span>
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 capitalize tracking-tight flex items-center gap-2">
                  {pageInfo.title}
                </h2>
                {user && user.clinic_branch && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-[#C01D38] border border-red-200 tracking-wide">
                    {user.clinic_branch.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-[12px] sm:text-[13px] text-slate-500 font-semibold leading-tight hidden sm:block mt-0.5">
                {pageInfo.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SyncStatusBadge />
            
            {user && (
              <div className="mr-2 text-slate-500 text-[12px] font-medium hidden lg:block">
                Welcome back, <span className="font-bold text-slate-700">{user.name || user.username}</span>
              </div>
            )}
            
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            
            <button
              onClick={() => {
                const initialUser = savedAccounts.length > 0 ? savedAccounts[0].username : (user?.username || '');
                setSwitchUsername(initialUser);
                setSwitchPassword('');
                setSwitchError('');
                setIsSwitchModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all cursor-pointer border border-slate-200/80 shadow-2xs"
              title="Switch to another clinic account"
            >
              <FiRepeat className="w-3.5 h-3.5 text-[#C01D38]" />
              <span>Switch Account</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <FiLogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Switch Account Modal Overlay */}
        {isSwitchModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setIsSwitchModalOpen(false)}></div>
            
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden z-10 animate-in zoom-in-95 duration-300 border border-slate-200">
              <div className="bg-[#9B101E] px-6 py-5 text-white relative">
                <button 
                  onClick={() => setIsSwitchModalOpen(false)}
                  className="absolute right-4 top-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                    <FiRepeat className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Switch Clinic Account</h3>
                    <p className="text-xs text-white/80 font-medium">Select a saved account or log in with different credentials</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {switchError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                    <span>{switchError}</span>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Saved Accounts for Quick Switch
                    </label>
                    {user && user.username && !savedAccounts.some(a => a.username.toLowerCase() === user.username.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = saveAccountToStorage(user);
                          setSavedAccounts(updated);
                        }}
                        className="text-[11px] font-bold text-[#C01D38] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FiPlus className="w-3 h-3" /> Save Current Account
                      </button>
                    )}
                  </div>

                  {savedAccounts.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                      {savedAccounts.map((acc, idx) => {
                        const isSelected = switchUsername.toLowerCase() === acc.username.toLowerCase();
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSwitchUsername(acc.username);
                              setSwitchPassword('');
                              setSwitchError('');
                            }}
                            className={`p-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                              isSelected 
                                ? 'bg-red-50/80 border-[#C01D38] text-[#C01D38] font-bold shadow-2xs' 
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 shadow-2xs bg-red-100 text-[#C01D38] border-red-200 font-extrabold text-xs">
                                {acc.name ? acc.name.charAt(0).toUpperCase() : acc.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{acc.name || acc.username}</div>
                                <div className="text-[11px] text-slate-500 font-normal">{acc.role || 'Staff'} • {acc.branch || 'Clinic'}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                                {acc.username}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveSavedAccount(acc.username, e)}
                                title="Remove account from saved list"
                                className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                      <p className="font-semibold text-slate-700 mb-0.5">No saved accounts yet</p>
                      <p className="text-[11px] text-slate-400">Accounts you log in to will automatically be remembered here for quick switching.</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSwitchAccountSubmit} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Username</label>
                    <div className="relative">
                      <FiUserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        value={switchUsername}
                        onChange={(e) => setSwitchUsername(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#C01D38] bg-slate-50 focus:bg-white"
                        placeholder="Username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="password"
                        value={switchPassword}
                        onChange={(e) => setSwitchPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#C01D38] bg-slate-50 focus:bg-white"
                        placeholder="Password"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSwitchModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={switchLoading}
                      className="flex-1 py-2.5 bg-[#C01D38] hover:bg-[#a0182f] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {switchLoading ? 'Switching...' : 'Switch Account Now'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Decorative background gradient */}
        <div className="absolute top-14 left-0 right-0 h-64 bg-gradient-to-b from-[#F5F0E6] to-transparent -z-10"></div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
