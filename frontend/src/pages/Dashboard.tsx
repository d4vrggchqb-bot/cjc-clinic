import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiPrinter, FiSearch, FiX, FiPieChart } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { apiFetch } from '../utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import PatientViewModal from '../components/PatientViewModal';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('All Branches');
  const [predictiveAlerts, setPredictiveAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    visitsThisWeek: 0,
    totalRegistered: 0,
    unattended: 0,
    pendingRechecks: 0,
    inventory: 0,
    visitsByCollege: [] as {name: string, visits: number}[],
    topDiagnoses: [] as {name: string, count: number}[],
    visitTrends: [] as {date: string, visits: number}[],
    topDispensed: [] as {name: string, count: number}[],
    expiringItems: [] as any[],
    lowStockItems: [] as any[],
    currentlyCheckedOut: 0,
    recentBorrowings: [] as any[]
  });

  // Quick Admit State
  const [showQuickAdmit, setShowQuickAdmit] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [purpose, setPurpose] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Quick Dispense State
  const [showQuickDispense, setShowQuickDispense] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [dispenseData, setDispenseData] = useState({
    item_id: 0,
    quantity: 1,
    disposed_to: '',
    reason: ''
  });
  const [isDispensing, setIsDispensing] = useState(false);

  // Dispense Search State
  const [dispenseSearch, setDispenseSearch] = useState('');
  const [dispenseSearchResults, setDispenseSearchResults] = useState<any[]>([]);
  const [showDispenseSearchDropdown, setShowDispenseSearchDropdown] = useState(false);
  const [isDispenseSearching, setIsDispenseSearching] = useState(false);
  const [selectedDispensePatient, setSelectedDispensePatient] = useState<any | null>(null);
  const [isGuestDispense, setIsGuestDispense] = useState(false);
  const dispenseSearchRef = React.useRef<HTMLDivElement>(null);

  // Patient Modal State
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [viewPatientId, setViewPatientId] = useState<number | null>(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#C01D38', '#455A64'];

  useEffect(() => {
    // Fetch real stats from the new MVC backend!
    apiFetch(`/api/index.php?route=dashboard&action=stats&branch=${encodeURIComponent(selectedBranch)}`)
      .then(res => {
        // Transform visitsByCollege object to array
        const colleges = res.visits_by_college ? Object.keys(res.visits_by_college).map(key => {
          // Shorten names for the chart
          let shortName = key;
          if (key.includes('(')) {
             shortName = key.split('(')[1].replace(')', '');
          } else {
             shortName = key.replace('Department', '').replace('College of', '').trim();
          }
          return {
            name: shortName, 
            visits: res.visits_by_college[key]
          };
        }) : [];

        // Transform diagnoses
        const diagnoses = res.top_diagnoses ? res.top_diagnoses.map((d: any) => ({
          name: d.diagnosis,
          count: d.count
        })) : [];

        if (res) {
          if (res.user_role) setUserRole(res.user_role);
          if (res.current_branch && res.user_role !== 'Superadmin') {
              setSelectedBranch(res.current_branch);
          }
          
          setStats({
            visitsThisWeek: res.visits_week || 0,
            totalRegistered: res.total_registered || 0,
            unattended: res.unattended || 0,
            pendingRechecks: res.pending_rechecks || 0,
            inventory: res.inventory_count || 0,
            visitsByCollege: colleges,
            topDiagnoses: diagnoses,
            visitTrends: res.visit_trends || [],
            topDispensed: (res.top_dispensed || []).map((i: any) => ({ name: i.generic_name, count: i.cnt })),
            expiringItems: res.expiring_items || [],
            lowStockItems: res.low_stock_items || [],
            currentlyCheckedOut: res.currently_checked_out || 0,
            recentBorrowings: res.recent_borrowings || []
          });
        }
      })
      .catch(err => console.error("Failed to fetch dashboard stats:", err));

    apiFetch('/api/index.php?route=inventory&action=predictive_alerts')
      .then(res => {
        if (res && res.success && res.predictions) {
          // Filter to only show critical/warning predictions
          setPredictiveAlerts(res.predictions.filter((p: any) => p.alert_level === 'critical' || p.alert_level === 'warning'));
        }
      })
      .catch(err => console.error("Failed to fetch predictive alerts:", err));

  }, [selectedBranch]);

  // Quick Admit: Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick Admit: Search logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) {
        setIsSearching(true);
        apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(search)}&per_page=5`)
          .then(res => {
            if (res.profiles) setSearchResults(res.profiles);
            setShowSearchDropdown(true);
          })
          .catch(err => toast.error("Search error"))
          .finally(() => setIsSearching(false));
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Quick Dispense: Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dispenseSearchRef.current && !dispenseSearchRef.current.contains(event.target as Node)) {
        setShowDispenseSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick Dispense: Search logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dispenseSearch.trim().length >= 2) {
        setIsDispenseSearching(true);
        apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(dispenseSearch)}&per_page=5`)
          .then(res => {
            if (res.profiles) setDispenseSearchResults(res.profiles);
            setShowDispenseSearchDropdown(true);
          })
          .catch(err => toast.error("Search error"))
          .finally(() => setIsDispenseSearching(false));
      } else {
        setDispenseSearchResults([]);
        setShowDispenseSearchDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dispenseSearch]);

  const handleQuickAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient.');
      return;
    }
    if (!purpose.trim()) {
      toast.error('Please enter a purpose.');
      return;
    }

    setIsCheckingIn(true);
    const toastId = toast.loading('Admitting patient...');
    try {
      const res = await apiFetch(`/api/index.php?route=consultations&action=create`, {
        method: 'POST',
        body: JSON.stringify({
          profile_id: selectedPatient.id,
          purpose: purpose
        })
      });

      if (res.success) {
        toast.success('Patient admitted to queue successfully!', { id: toastId });
        setShowQuickAdmit(false);
        setSelectedPatient(null);
        setSearch('');
        setPurpose('');
        // We could refresh stats here if needed
      } else {
        toast.error(res.message || 'Failed to check in.', { id: toastId });
      }
    } catch (err) {
      toast.error('An error occurred.', { id: toastId });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=items');
      if (res.items) {
        setInventoryItems(res.items);
      }
    } catch (err) {
      console.error("Failed to fetch inventory for dispense", err);
    }
  };

  // Fetch inventory when quick dispense modal opens
  useEffect(() => {
    if (showQuickDispense && inventoryItems.length === 0) {
      fetchInventoryItems();
    }
  }, [showQuickDispense]);

  const handleQuickDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dispenseData.item_id === 0) {
      toast.error('Please select an item.');
      return;
    }
    if (dispenseData.quantity < 1) {
      toast.error('Quantity must be at least 1.');
      return;
    }
    
    let finalDisposedToName = '';
    if (isGuestDispense) {
      if (!dispenseData.disposed_to.trim()) {
        toast.error('Please specify the guest name.');
        return;
      }
      finalDisposedToName = dispenseData.disposed_to + ' (Guest)';
    } else {
      if (!selectedDispensePatient) {
        toast.error('Please select a patient or use guest option.');
        return;
      }
      finalDisposedToName = selectedDispensePatient.name;
    }

    setIsDispensing(true);
    const toastId = toast.loading('Dispensing item...');
    try {
      // For dashboard quick dispense, we use the currently selected branch 
      // or 'College Clinic' as default if 'All Branches' is selected
      const branchToUse = selectedBranch === 'All Branches' ? 'College Clinic' : selectedBranch;
      
      const finalDisposedTo = dispenseData.reason.trim() ? `${finalDisposedToName} - ${dispenseData.reason}` : finalDisposedToName;
      
      const res = await apiFetch('/api/index.php?route=inventory&action=dispense', { 
        method: 'POST', 
        body: JSON.stringify({ 
          ...dispenseData, 
          disposed_to: finalDisposedTo,
          clinic_branch: branchToUse 
        }) 
      });

      if (res.success || !res.error) { // The backend dispense might not return success boolean directly if it just finishes
        toast.success('Dispensed successfully!', { id: toastId });
        setShowQuickDispense(false);
        setDispenseData({ item_id: 0, quantity: 1, disposed_to: '', reason: '' });
        setSelectedDispensePatient(null);
        setDispenseSearch('');
        setIsGuestDispense(false);
      } else {
        toast.error(res.message || res.error || 'Error dispensing item', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error dispensing item', { id: toastId });
    } finally {
      setIsDispensing(false);
    }
  };

  const MetricCard = ({ title, value, subtext, valueColor }: { title: string, value: number, subtext: string, valueColor: string }) => (
    <div className="group relative overflow-hidden bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 p-6 flex flex-col items-center justify-center border border-white/80 flex-1 min-w-[150px] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:bg-white/90 cursor-default">
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-[0.2em] mb-3 text-center z-10">{title}</h3>
      <div className={`text-4xl font-black tracking-tight mb-2 z-10 ${valueColor}`}>{value}</div>
      <p className="text-xs text-slate-500 font-semibold text-center z-10">{subtext}</p>
    </div>
  );

  return (
    <div className="p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Dashboard</h1>
          <p className="text-slate-400 text-sm font-medium">Overview of clinic activity</p>
        </div>
        <div className="flex gap-3 items-center">
          {(userRole === 'Superadmin') && (
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-md text-sm font-medium shadow-sm outline-none focus:border-[#C01D38]"
            >
              <option value="All Branches">All Branches</option>
              <option value="College Clinic">College Clinic</option>
              <option value="Basic Education Clinic">Basic Education Clinic</option>
              <option value="Power Campus Clinic">Power Campus Clinic</option>
            </select>
          )}
          <button 
            onClick={() => navigate('/reports')}
            className="bg-white/80 backdrop-blur-sm border border-slate-200/50 hover:bg-white text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide flex items-center gap-2 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5">
            <FiPieChart className="w-4 h-4" /> Go to Reports
          </button>
          <button 
            onClick={() => setShowQuickAdmit(true)} 
            className="bg-gradient-to-r from-[#C01D38] to-[#9B101E] hover:from-[#A5192D] hover:to-[#7A0D18] text-white px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide flex items-center gap-2 transition-all duration-300 shadow-[0_4px_14px_rgba(192,29,56,0.39)] hover:shadow-[0_6px_20px_rgba(192,29,56,0.23)] hover:-translate-y-0.5">
            <FiPlus className="w-4 h-4" strokeWidth={3} /> Quick Admit
          </button>
          <button 
            onClick={() => setShowQuickDispense(true)}
            className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide flex items-center gap-2 transition-all duration-300 shadow-[0_4px_14px_rgba(51,65,85,0.39)] hover:shadow-[0_6px_20px_rgba(51,65,85,0.23)] hover:-translate-y-0.5">
            Quick Dispense
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats.expiringItems.length > 0 || stats.lowStockItems.length > 0) && (
        <div className="mb-8 space-y-4">
          
          {/* Expiring Items Alert */}
          {stats.expiringItems.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-orange-500 text-orange-800 p-5 rounded-2xl shadow-lg shadow-orange-100/50 flex items-start gap-3 w-full animate-fade-in backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <div>
                <h3 className="font-bold text-sm">Expiring Items Alert</h3>
                <ul className="text-sm mt-1 list-disc list-inside space-y-1">
                  {stats.expiringItems.map((item: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-semibold">{item.generic_name}</span> (Batch: {item.batch_number}) expires on <span className="font-semibold">{item.expired_on}</span> at {item.clinic_branch}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Low Stock Alert */}
          {stats.lowStockItems.length > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-[#C01D38] text-rose-800 p-5 rounded-2xl shadow-lg shadow-rose-100/50 flex items-start gap-3 w-full animate-fade-in backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div>
                <h3 className="font-bold text-sm">Low Stock Alert</h3>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {stats.lowStockItems.map((item, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">{item.generic_name}</span> ({item.category}) is low on stock! Only <span className="font-semibold text-red-600">{item.total_stock}</span> remaining (Threshold: {item.alert_threshold}).
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* AI Predictive Alerts */}
          {predictiveAlerts.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500 text-indigo-800 p-5 rounded-2xl shadow-lg shadow-indigo-100/50 flex items-start gap-3 w-full animate-fade-in relative overflow-hidden backdrop-blur-sm">
              <div className="absolute -right-6 -top-6 text-indigo-100 opacity-50 transform rotate-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 shrink-0 mt-0.5 relative z-10 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <div className="relative z-10">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  AI Predictive Shortage Warning
                </h3>
                <ul className="text-sm mt-1 list-disc list-inside space-y-1">
                  {predictiveAlerts.map((alert, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">{alert.name}</span> will run out in approx. <span className="font-bold text-indigo-600">{alert.days_remaining} days</span> based on recent dispensing trends.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="flex flex-wrap gap-4 mb-6">
        <MetricCard 
          title="VISITS THIS WEEK" 
          value={stats.visitsThisWeek} 
          subtext="This week" 
          valueColor="text-[#D32F2F]" 
        />
        <MetricCard 
          title="TOTAL REGISTERED" 
          value={stats.totalRegistered} 
          subtext="Students & Employees" 
          valueColor="text-[#1976D2]" 
        />
        <MetricCard 
          title="UNATTENDED" 
          value={stats.unattended} 
          subtext="Today: Waiting to turn" 
          valueColor="text-[#ED6C02]" 
        />
        <MetricCard 
          title="PENDING RE-CHECKS" 
          value={stats.pendingRechecks} 
          subtext="Today: Followups due" 
          valueColor="text-[#9C27B0]" 
        />
        <MetricCard 
          title="INVENTORY" 
          value={stats.inventory} 
          subtext="Overview of medicine supplies & equipments" 
          valueColor="text-[#455A64]" 
        />
        <MetricCard 
          title="CHECKED OUT" 
          value={stats.currentlyCheckedOut} 
          subtext="Equipments currently borrowed" 
          valueColor="text-[#2E7D32]" 
        />
      </div>

      {/* Visit Trends Line Chart */}
      <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-white/80 flex flex-col h-80">
        <h3 className="text-sm font-extrabold text-slate-600 uppercase tracking-wider mb-1">Weekly Visit Trends</h3>
        <p className="text-xs text-slate-400 font-medium mb-6">Patient visits over the last 7 days</p>
        
        <div className="flex-1 w-full">
          {stats.visitTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.visitTrends} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{stroke: '#f1f5f9', strokeWidth: 2}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="visits" stroke="#C01D38" strokeWidth={3} dot={{r: 4, fill: '#C01D38'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              <p className="text-sm font-medium">No trend data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Block: Bar Chart */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-white/80 h-96 flex flex-col">
          <h3 className="text-sm font-extrabold text-slate-600 uppercase tracking-wider mb-1">Patient Visits by Department</h3>
          <p className="text-xs text-slate-400 font-medium mb-6">Total visits distributed across colleges</p>
          
          <div className="flex-1 w-full">
            {stats.visitsByCollege.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.visitsByCollege} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                    {stats.visitsByCollege.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p className="text-sm font-medium">No visit data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Block: Pie Chart */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-white/80 h-96 flex flex-col">
          <h3 className="text-sm font-extrabold text-slate-600 uppercase tracking-wider mb-1">Top Diagnoses</h3>
          <p className="text-xs text-slate-400 font-medium mb-6">Most common health issues diagnosed</p>
          
          <div className="flex-1 w-full">
            {stats.topDiagnoses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.topDiagnoses}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {stats.topDiagnoses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                </svg>
                <p className="text-sm font-medium">No diagnosis data available</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Top Dispensed */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-white/80 flex flex-col h-80">
          <h3 className="text-sm font-extrabold text-slate-600 uppercase tracking-wider mb-1">Top Dispensed Medicines & Supplies</h3>
          <p className="text-xs text-slate-400 font-medium mb-6">Most frequently used items</p>
          
          <div className="flex-1 w-full">
            {stats.topDispensed.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topDispensed} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} width={120} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.topDispensed.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <p className="text-sm font-medium">No dispensing data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Borrowings */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-white/80 flex flex-col h-80 overflow-hidden">
          <h3 className="text-sm font-extrabold text-slate-600 uppercase tracking-wider mb-1">Recent Equipment Borrowings</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Latest bookings (Click to view profile)</p>
          
          <div className="flex-1 w-full overflow-y-auto pr-2">
            {stats.recentBorrowings.length > 0 ? (
              <div className="space-y-3">
                {stats.recentBorrowings.map((borrowing, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setViewPatientId(borrowing.profile_id);
                      setShowPatientModal(true);
                    }}
                    className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-100 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm">{borrowing.first_name} {borrowing.last_name}</h4>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{borrowing.items}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider bg-slate-50 px-2 py-1 rounded">
                        {borrowing.profile_type}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{new Date(borrowing.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <p className="text-sm font-medium">No recent borrowings</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Admit Modal */}
      {showQuickAdmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl" ref={searchRef}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FiPlus className="text-[#C01D38]" /> Quick Admit
              </h3>
              <button onClick={() => setShowQuickAdmit(false)} className="text-slate-400 hover:text-slate-600">
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleQuickAdmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Patient <span className="text-red-500">*</span></label>
                {!selectedPatient ? (
                  <div>
                    <div className="relative flex items-center">
                      <FiSearch className="absolute left-3 text-slate-400 w-5 h-5" />
                      <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => {
                          if (searchResults.length > 0) setShowSearchDropdown(true);
                        }}
                        placeholder="Search by name or ID..."
                        className="w-full border border-slate-300 rounded-md px-3 py-2.5 pl-10 text-sm focus:outline-none focus:border-[#C01D38]"
                      />
                    </div>
                    {showSearchDropdown && search.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-64 overflow-y-auto z-20">
                        {isSearching ? (
                          <div className="p-4 text-center text-sm text-slate-500">Searching...</div>
                        ) : searchResults.length > 0 ? (
                          searchResults.map(p => (
                            <div 
                              key={p.id}
                              onClick={() => { setSelectedPatient(p); setShowSearchDropdown(false); }}
                              className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                            >
                              <div className="font-bold text-sm text-slate-800">{p.name}</div>
                              <div className="text-xs text-slate-500">{p.patient_id_number || 'No ID'}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-sm text-slate-500">No patients found.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 px-4 py-3 rounded-md border border-slate-200 relative flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{selectedPatient.name}</div>
                      <div className="text-xs text-slate-500">{selectedPatient.patient_id_number || 'No ID'}</div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => { setSelectedPatient(null); setSearch(''); }}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-slate-200 transition-colors"
                      title="Clear selected patient"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="e.g. Headache, Checkup, Request"
                  className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#C01D38]" 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowQuickAdmit(false)} className="px-4 py-2 border rounded-md font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isCheckingIn || !selectedPatient || !purpose.trim()} className="px-5 py-2 bg-[#C01D38] hover:bg-[#a0182f] text-white rounded-md font-semibold transition-colors disabled:opacity-50">
                  {isCheckingIn ? 'Admitting...' : 'Admit Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Dispense Modal */}
      {showQuickDispense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FiPlus className="text-slate-700" /> Quick Dispense
              </h3>
              <button onClick={() => setShowQuickDispense(false)} className="text-slate-400 hover:text-slate-600">
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleQuickDispense} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Item to Dispense <span className="text-red-500">*</span></label>
                <select 
                  className="w-full border border-slate-300 p-2.5 rounded-md text-sm focus:outline-none focus:border-slate-500" 
                  value={dispenseData.item_id} 
                  onChange={e => setDispenseData({...dispenseData, item_id: parseInt(e.target.value)})}
                >
                  <option value={0}>-- Select Item --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.generic_name} {item.brand_name ? `(${item.brand_name})` : ''} {item.dosage ? `- ${item.dosage}` : ''} {item.formulation ? `(${item.formulation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  className="w-full border border-slate-300 p-2.5 rounded-md text-sm focus:outline-none focus:border-slate-500" 
                  value={dispenseData.quantity} 
                  onChange={e => setDispenseData({...dispenseData, quantity: parseInt(e.target.value)})} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Disposed To <span className="text-red-500">*</span></label>
                
                <div className="flex items-center gap-4 mb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="radio" 
                      checked={!isGuestDispense} 
                      onChange={() => setIsGuestDispense(false)} 
                      name="dispenseType"
                    />
                    Registered Patient
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="radio" 
                      checked={isGuestDispense} 
                      onChange={() => {
                        setIsGuestDispense(true);
                        setSelectedDispensePatient(null);
                        setDispenseSearch('');
                      }} 
                      name="dispenseType"
                    />
                    Guest
                  </label>
                </div>

                {!isGuestDispense ? (
                  <div className="relative" ref={dispenseSearchRef}>
                    {!selectedDispensePatient ? (
                      <div>
                        <div className="relative flex items-center">
                          <FiSearch className="absolute left-3 text-slate-400 w-5 h-5" />
                          <input 
                            type="text" 
                            value={dispenseSearch}
                            onChange={(e) => setDispenseSearch(e.target.value)}
                            onFocus={() => {
                              if (dispenseSearchResults.length > 0) setShowDispenseSearchDropdown(true);
                            }}
                            placeholder="Search registered patient..."
                            className="w-full border border-slate-300 rounded-md px-3 py-2.5 pl-10 text-sm focus:outline-none focus:border-[#C01D38]"
                          />
                        </div>
                        {showDispenseSearchDropdown && dispenseSearch.length >= 2 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-64 overflow-y-auto z-20">
                            {isDispenseSearching ? (
                              <div className="p-4 text-center text-sm text-slate-500">Searching...</div>
                            ) : dispenseSearchResults.length > 0 ? (
                              dispenseSearchResults.map(p => (
                                <div 
                                  key={p.id}
                                  onClick={() => { setSelectedDispensePatient(p); setShowDispenseSearchDropdown(false); }}
                                  className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                >
                                  <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                  <div className="text-xs text-slate-500">{p.patient_id_number || 'No ID'} - {p.category}</div>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center">
                                <p className="text-sm text-slate-500">No patients found.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 px-4 py-3 rounded-md border border-slate-200 relative flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm text-slate-800">{selectedDispensePatient.name}</div>
                          <div className="text-xs text-slate-500">{selectedDispensePatient.patient_id_number || 'No ID'}</div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => { setSelectedDispensePatient(null); setDispenseSearch(''); }}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-slate-200 transition-colors"
                          title="Clear selected patient"
                        >
                          <FiX className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input 
                    required 
                    type="text" 
                    placeholder="Enter guest name..." 
                    className="w-full border border-slate-300 p-2.5 rounded-md text-sm focus:outline-none focus:border-slate-500" 
                    value={dispenseData.disposed_to} 
                    onChange={e => setDispenseData({...dispenseData, disposed_to: e.target.value})} 
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Reason (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Headache, Fever" 
                  className="w-full border border-slate-300 p-2.5 rounded-md text-sm focus:outline-none focus:border-slate-500" 
                  value={dispenseData.reason} 
                  onChange={e => setDispenseData({...dispenseData, reason: e.target.value})} 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowQuickDispense(false)} className="px-4 py-2 border rounded-md font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isDispensing || dispenseData.item_id === 0 || (isGuestDispense ? !dispenseData.disposed_to : !selectedDispensePatient)} className="px-5 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 font-semibold transition-colors disabled:opacity-50">
                  {isDispensing ? 'Dispensing...' : 'Dispense Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Patient View Modal */}
      <PatientViewModal
        isOpen={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        patientId={viewPatientId}
      />
    </div>
  );
};

export default Dashboard;

