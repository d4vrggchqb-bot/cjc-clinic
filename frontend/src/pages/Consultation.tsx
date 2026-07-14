import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FiSearch, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiPrinter, FiUserPlus, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';


interface Patient {
  id: number;
  name: string;
  patient_id_number: string;
  profile_type: string;
  college_dept: string;
}

interface LogbookEntry {
  id: number;
  profile_id: number;
  clinic_branch?: string;
  patient_id_number: string;
  patient_name: string;
  time_in: string;
  purpose: string;
  time_out: string | null;
  blood_pressure?: string;
  temperature?: string;
  weight?: string;
  diagnosis?: string;
  treatment?: string;
  attended_by: string;
  status: string;
}


const Consultation: React.FC = () => {
  const { confirm } = useConfirm();
  const location = useLocation();
  const [period, setPeriod] = useState('today'); // today, weekly, monthly, custom, all
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [kanbanStatus, setKanbanStatus] = useState('all'); // all, waiting, in-progress, completed
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [userRole, setUserRole] = useState('');
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [purpose, setPurpose] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  
  // Quick Add Patient State
  const [isAddingNewPatient, setIsAddingNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    patient_id_number: '',
    profile_type: 'student'
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [idChecking, setIdChecking] = useState(false);
  const [isIdDuplicate, setIsIdDuplicate] = useState(false);
  
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Click outside search dropdown to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Medical Notes Modal State
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [activeNoteEntry, setActiveNoteEntry] = useState<LogbookEntry | null>(null);
  const [bp, setBp] = useState('');
  const [temp, setTemp] = useState('');
  const [weight, setWeight] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Medical History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProfileDetails, setSelectedProfileDetails] = useState<any>(null);
  const [selectedProfileHistory, setSelectedProfileHistory] = useState<any[]>([]);

  // Dispensing State
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [dispensedItems, setDispensedItems] = useState<{item_id: number, quantity: number, name: string}[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState('');
  const [dispenseQty, setDispenseQty] = useState(1);

  // Medcert State
  const [isMedcertModalOpen, setIsMedcertModalOpen] = useState(false);
  const [isGeneratingMedcert, setIsGeneratingMedcert] = useState(false);
  const [medcertData, setMedcertData] = useState({
    issued_to: '',
    issued_by: 'Clinic Nurse / Doctor',
    reason: '',
    valid_until: '',
    clinic_branch: 'College Clinic'
  });
  const [showPrintView, setShowPrintView] = useState(false);

  const fetchInventory = () => {
    apiFetch('/api/index.php?route=inventory&action=items')
      .then(res => {
        if (res.items) setInventoryItems(res.items);
      })
      .catch(console.error);
  };

  const fetchEntries = () => {
    let url = `/api/index.php?route=consultations&action=list&period=${period}&page=${currentPage}&per_page=10&status=${kanbanStatus}&branch=${encodeURIComponent(selectedBranch)}`;
    if (period === 'custom' && fromDate && toDate) {
      url += `&from=${fromDate}&to=${toDate}`;
    }
    
    apiFetch(url)
      .then(res => {
        if (res.sessions) {
          setEntries(res.sessions);
          setTotalPages(res.total_pages || 1);
          if (res.user_role) setUserRole(res.user_role);
        }
      })
      .catch(err => console.error("Error fetching entries:", err));
  };

  useEffect(() => {
    fetchEntries();
  }, [currentPage, period, fromDate, toDate, kanbanStatus, selectedBranch]);

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchEntries, 30000);
    return () => clearInterval(interval);
  }, [period, currentPage, kanbanStatus, selectedBranch, fromDate, toDate]);

  // Search logic for left panel
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

  // Real-time check for duplicate ID
  useEffect(() => {
    const checkId = async () => {
      const idNum = newPatient.patient_id_number.trim();
      if (!idNum) {
        setIsIdDuplicate(false);
        return;
      }
      
      setIdChecking(true);
      try {
        const res = await apiFetch(`/api/index.php?route=patients&action=check_id&id_number=${encodeURIComponent(idNum)}`);
        setIsIdDuplicate(!!res.exists);
      } catch (err) {
        // silently fail
      } finally {
        setIdChecking(false);
      }
    };

    const timer = setTimeout(checkId, 500);
    return () => clearTimeout(timer);
  }, [newPatient.patient_id_number]);

  const handleQuickAddPatient = async () => {
    if (!newPatient.first_name || !newPatient.last_name) {
      toast.error('First and Last name are required');
      return;
    }
    
    setIsRegistering(true);
    const toastId = toast.loading('Registering new patient...');
    try {
      const res = await apiFetch('/api/index.php?route=patients&action=create', {
        method: 'POST',
        body: JSON.stringify(newPatient)
      });
      
      if (res.success) {
        toast.success('Patient registered successfully!', { id: toastId });
        // Set the newly created patient as the selected patient
        setSelectedPatient({
          id: res.id,
          name: `${newPatient.first_name} ${newPatient.last_name}`,
          patient_id_number: newPatient.patient_id_number,
          profile_type: newPatient.profile_type,
          college_dept: ''
        });
        setIsAddingNewPatient(false);
        setSearch('');
      } else {
        toast.error(res.error || 'Failed to register patient', { id: toastId });
      }
    } catch (err) {
      toast.error('Error registering patient', { id: toastId });
    }
    setIsRegistering(false);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setCheckinError('Please select a patient.');
      return;
    }
    if (!purpose.trim()) {
      setCheckinError('Please enter a purpose.');
      return;
    }

    setIsCheckingIn(true);
    setCheckinError('');

    try {
      const res = await apiFetch(`/api/index.php?route=consultations&action=create`, {
        method: 'POST',
        body: JSON.stringify({
          profile_id: selectedPatient.id,
          purpose: purpose
        })
      });

      if (res.success) {
        setSelectedPatient(null);
        setSearch('');
        setPurpose('');
        if (period === 'today') fetchEntries();
      } else {
        setCheckinError(res.message || 'Failed to check in.');
      }
    } catch (err) {
      setCheckinError('An error occurred.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleViewProfile = async (profileId: number) => {
    try {
      const profileRes = await apiFetch(`/api/index.php?route=patients&action=get&id=${profileId}`);
      if (profileRes.profile) {
        setSelectedProfileDetails(profileRes.profile);
      }
      const historyRes = await apiFetch(`/api/index.php?route=consultations&action=history&profile_id=${profileId}`);
      if (historyRes.history) {
        setSelectedProfileHistory(historyRes.history);
      }
      setIsHistoryModalOpen(true);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch medical history.');
    }
  };

  const openNotesModal = (entry: LogbookEntry) => {
    setActiveNoteEntry(entry);
    setBp(entry.blood_pressure || '');
    setTemp(entry.temperature || '');
    setWeight(entry.weight || '');
    setDiagnosis(entry.diagnosis || '');
    setTreatment(entry.treatment || '');
    setDispensedItems([]);
    setIsNotesModalOpen(true);
  };

  useEffect(() => {
    if (location.state?.openNotesFor && entries.length > 0) {
      const entryId = location.state.openNotesFor;
      const entry = entries.find(e => e.id === entryId);
      if (entry) {
        openNotesModal(entry);
        window.history.replaceState({}, document.title); // clear state
      }
    }
  }, [location.state, entries]);

  const handleSaveNotes = async () => {
    if (!activeNoteEntry) return;
    const confirmed = await confirm({
      title: 'Save Medical Notes',
      message: 'Are you sure you want to save these medical notes?',
      type: 'info'
    });
    if (!confirmed) return;
    setIsSavingNotes(true);
    try {
      const res = await apiFetch(`/api/index.php?route=consultations&action=saveNotes`, {
        method: 'POST',
        body: JSON.stringify({
          id: activeNoteEntry.id,
          blood_pressure: bp,
          temperature: temp,
          weight: weight,
          diagnosis: diagnosis,
          treatment: treatment,
          dispensed_items: dispensedItems,
          clinic_branch: 'College Clinic' // TODO: dynamic based on logged in user's assigned clinic
        })
      });
      if (res.success) {
        setIsNotesModalOpen(false);
        fetchEntries();
      } else {
        alert(res.message || 'Failed to save notes.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleGenerateMedcert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNoteEntry) return;
    setIsGeneratingMedcert(true);
    const toastId = toast.loading('Generating Medical Certificate...');
    try {
      const res = await apiFetch(`/api/index.php?route=medcert&action=generate`, {
        method: 'POST',
        body: JSON.stringify({
          profile_id: activeNoteEntry.profile_id,
          ...medcertData
        })
      });
      if (res.success) {
        toast.success('Certificate generated successfully!', { id: toastId });
        setIsMedcertModalOpen(false);
        setShowPrintView(true);
      } else {
        toast.error(res.message || res.error || 'Failed to generate medical certificate.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred during generation.', { id: toastId });
    }
    setIsGeneratingMedcert(false);
  };

  const handleStartConsultation = async (id: number) => {
    try {
      await apiFetch(`/api/index.php?route=consultations&action=update`, {
        method: 'POST',
        body: JSON.stringify({ id, action: 'start' })
      });
      fetchEntries();
    } catch (err) {
      console.error(err);
      alert('Failed to start consultation.');
    }
  };

  const handleCheckout = async (id: number) => {
    const confirmed = await confirm({
      title: 'Checkout Patient',
      message: 'Are you sure you want to time-out this patient?',
      type: 'info'
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/api/index.php?route=consultations&action=update`, {
        method: 'POST',
        body: JSON.stringify({ id, action: 'checkout' })
      });
      fetchEntries();
    } catch (err) {
      console.error(err);
      alert('Failed to set time-out.');
    }
  };

  const handleCheckoutAll = async () => {
    const confirmed = await confirm({
      title: 'Checkout All',
      message: 'Are you sure you want to time-out all active visitors today?',
      type: 'warning'
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/api/index.php?route=consultations&action=checkoutAll`, {
        method: 'POST'
      });
      fetchEntries();
    } catch (err) {
      console.error(err);
      alert('Failed to set all time-out.');
    }
  };

  const applyCustomDate = () => {
    if (fromDate && toDate) {
      setPeriod('custom');
      setCurrentPage(1);
      fetchEntries();
    }
  };

  const clearCustomDate = () => {
    setFromDate('');
    setToDate('');
    setPeriod('today');
    setCurrentPage(1);
  };

  const formatTimeOnly = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      
      {/* Top Header */}
      <div className="bg-white px-6 py-4 border-b flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#A5192D] tracking-tight mb-1">Services Logbook</h1>
          <p className="text-slate-500 text-sm">Check-in patients and manage today's visitors</p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
            {['today', 'weekly', 'monthly', 'all'].map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setFromDate(''); setToDate(''); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                  period === p ? 'bg-[#8c1526] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs font-bold text-slate-500">From:</span>
            <input 
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#8c1526]"
            />
            <span className="text-xs font-bold text-slate-500">To:</span>
            <input 
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#8c1526]"
            />
            <button 
              onClick={applyCustomDate}
              className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
            >
              Apply
            </button>
            <button 
              onClick={clearCustomDate}
              className="text-slate-500 hover:text-slate-700 text-xs font-bold px-2 py-1.5 transition-colors"
            >
              ✕ Clear
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
        
        {/* Top Horizontal Bar: Check-in */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <FiUserPlus className="text-[#A5192D]" />
              Quick Check-in
            </h2>
            {!isAddingNewPatient && (
              <button
                onClick={() => {
                  setIsAddingNewPatient(true);
                  setShowSearchDropdown(false);
                }}
                className="text-sm font-medium text-[#A5192D] hover:text-[#8A1525] flex items-center gap-1.5 transition-colors"
              >
                <FiUserPlus /> Register New Patient
              </button>
            )}
          </div>

          {checkinError && (
            <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 p-2 rounded border border-red-100">
              {checkinError}
            </div>
          )}

          {isAddingNewPatient ? (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50 p-5 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-800">New Patient Details</h3>
                <button 
                  onClick={() => setIsAddingNewPatient(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 bg-white px-2 py-1 border border-slate-200 rounded shadow-sm"
                >
                  <FiX /> Cancel
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D]"
                    value={newPatient.first_name}
                    onChange={(e) => setNewPatient({...newPatient, first_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D]"
                    value={newPatient.last_name}
                    onChange={(e) => setNewPatient({...newPatient, last_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ID Number (Optional)</label>
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full border rounded px-3 py-2 text-sm focus:outline-none pr-8 transition-colors ${isIdDuplicate ? 'border-red-500 focus:border-red-600 bg-red-50 text-red-700' : 'border-slate-200 focus:border-[#A5192D]'}`}
                      value={newPatient.patient_id_number}
                      onChange={(e) => setNewPatient({...newPatient, patient_id_number: e.target.value})}
                    />
                    {idChecking && <FiRefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                    {isIdDuplicate && !idChecking && <FiAlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
                  </div>
                  {isIdDuplicate && !idChecking && <span className="text-red-500 text-[10px] font-bold block mt-1">This ID is already registered.</span>}
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Profile Type *</label>
                    <select
                      className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D] bg-white"
                      value={newPatient.profile_type}
                      onChange={(e) => setNewPatient({...newPatient, profile_type: e.target.value})}
                    >
                      <option value="student">Student</option>
                      <option value="employee">Employee</option>
                    </select>
                  </div>
                  <button
                    onClick={handleQuickAddPatient}
                    disabled={isRegistering || !newPatient.first_name || !newPatient.last_name || isIdDuplicate}
                    className="py-2 px-5 rounded font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 transition-colors text-sm whitespace-nowrap h-[38px] flex items-center"
                  >
                    {isRegistering ? 'Registering...' : 'Save & Select'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-6">
              <div className="flex-1 max-w-md relative" ref={searchRef}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient</label>
                {!selectedPatient ? (
                  <div className="relative">
                    <div className="flex">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                          type="text" 
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onFocus={() => {
                            if (searchResults.length > 0) setShowSearchDropdown(true);
                          }}
                          placeholder="Search name or ID..."
                          className="w-full border border-slate-300 rounded px-3 py-2 pl-9 text-sm focus:outline-none focus:border-[#8c1526]"
                        />
                      </div>
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
                  <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-200 relative flex items-center justify-between h-[38px]">
                    <div>
                      <div className="font-bold text-sm text-slate-800 leading-tight">{selectedPatient.name}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{selectedPatient.patient_id_number || 'No ID'}</div>
                    </div>
                    <button 
                      onClick={() => { setSelectedPatient(null); setSearch(''); }}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                      title="Clear selected patient"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 max-w-md">
                <label className="text-xs font-semibold text-slate-700 block mb-1">Purpose / Reason</label>
                <input 
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Headache, Consultation..."
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]"
                />
              </div>

              <button 
                onClick={handleCheckIn}
                disabled={!selectedPatient || !purpose.trim() || isCheckingIn}
                className="bg-[#8c1526] hover:bg-[#7a1221] text-white px-8 py-2 rounded text-sm font-bold transition-colors disabled:opacity-50 h-[38px] flex items-center justify-center min-w-[120px] shadow-sm"
              >
                {isCheckingIn ? 'Checking in...' : 'Check-In'}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Panel: Data Table */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">
                {period === 'today' ? "Today's Visitors" : "Visitors"}
              </h2>
              <p className="text-xs text-slate-500">{entries.length} patients</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={fetchEntries}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
              >
                <FiRefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button 
                onClick={handleCheckoutAll}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#28a745] hover:bg-[#218838] px-3 py-1.5 rounded transition-colors shadow-sm"
              >
                <FiCheckCircle className="w-3.5 h-3.5" />
                Set All Time-Out
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center overflow-x-auto gap-4">
            <div className="flex gap-2">
              <button 
                onClick={() => { setKanbanStatus('all'); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${kanbanStatus === 'all' ? 'bg-slate-800 text-white shadow' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'}`}
              >
                All Consultations
              </button>
              <button 
                onClick={() => { setKanbanStatus('waiting'); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${kanbanStatus === 'waiting' ? 'bg-yellow-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-300 hover:bg-yellow-50'}`}
              >
                Waiting
              </button>
              <button 
                onClick={() => { setKanbanStatus('in-progress'); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${kanbanStatus === 'in-progress' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50'}`}
              >
                In Consultation
              </button>
              <button 
                onClick={() => { setKanbanStatus('completed'); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${kanbanStatus === 'completed' ? 'bg-green-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-300 hover:bg-green-50'}`}
              >
                Completed
              </button>
            </div>
            
            {(userRole === 'Superadmin' || userRole === 'Admin') && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Branch:</span>
                <select 
                  value={selectedBranch}
                  onChange={(e) => { setSelectedBranch(e.target.value); setCurrentPage(1); }}
                  className="border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
                >
                  <option value="All Branches">All Branches</option>
                  <option value="College Clinic">College Clinic</option>
                  <option value="Basic Education Clinic">Basic Education Clinic</option>
                  <option value="Power Campus Clinic">Power Campus Clinic</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead className="bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 shadow-sm uppercase">
                <tr>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Patient ID</th>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Name</th>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Time In</th>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Purpose</th>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Time Out</th>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Attended By</th>
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Status</th>
                  <th className="px-4 py-2 font-semibold tracking-wide text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No check-ins for this period.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 text-center">
                      <td className="px-4 py-3">{entry.patient_id_number || 'N/A'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <button 
                          onClick={() => handleViewProfile(entry.profile_id)}
                          className="hover:text-[#8c1526] hover:underline transition-colors text-left"
                        >
                          {entry.patient_name}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTimeOnly(entry.time_in)}</td>
                      <td className="px-4 py-3">{entry.purpose}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-500">
                        {entry.time_out ? formatTimeOnly(entry.time_out) : '-'}
                      </td>
                      <td className="px-4 py-3">{entry.attended_by}</td>
                      <td className="px-4 py-3">
                        {entry.status === 'waiting' && <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full border border-yellow-200">Waiting</span>}
                        {(entry.status === 'in-progress' || entry.status === 'active') && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full border border-blue-200 whitespace-nowrap">In Consultation</span>}
                        {entry.status === 'completed' && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full border border-green-200">Done</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {entry.status === 'waiting' && (
                            <button 
                              onClick={() => handleStartConsultation(entry.id)}
                              className="bg-[#28a745] hover:bg-[#218838] text-white text-xs font-bold px-3 py-1 rounded transition-colors"
                            >
                              Start
                            </button>
                          )}
                          {(entry.status === 'in-progress' || entry.status === 'active') && !entry.time_out && (
                            <>
                              <button 
                                onClick={() => openNotesModal(entry)}
                                className="bg-[#8c1526] hover:bg-[#7a1221] text-white text-xs font-bold px-3 py-1 rounded transition-colors whitespace-nowrap"
                              >
                                Medical Notes
                              </button>
                              <button 
                                onClick={() => handleCheckout(entry.id)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1 rounded transition-colors whitespace-nowrap"
                              >
                                Set Time Out
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-center items-center gap-2 text-xs font-semibold text-slate-500">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 font-bold transition-colors shadow-sm"
            >
              Prev
            </button>
            <span className="px-3">Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 font-bold transition-colors shadow-sm"
            >
              Next
            </button>
          </div>
          
        </div>
      </div>
      {/* Medical Notes Modal */}
      {isNotesModalOpen && activeNoteEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <div>
                <h2 className="text-lg font-bold text-[#8c1526]">Medical Notes & Consultation</h2>
                <p className="text-xs text-slate-500">Patient: <span className="font-semibold text-slate-700">{activeNoteEntry.patient_name}</span></p>
              </div>
              <button onClick={() => setIsNotesModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider border-b pb-1">Vital Signs</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Pressure (mmHg)</label>
                  <input type="text" value={bp} onChange={e => setBp(e.target.value)} placeholder="e.g. 120/80" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Temperature (°C)</label>
                  <input type="text" value={temp} onChange={e => setTemp(e.target.value)} placeholder="e.g. 36.5" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Weight (kg)</label>
                  <input type="text" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 65" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider border-b pb-1">Clinical Notes</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Diagnosis / Assessment</label>
                  <textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={3} placeholder="Enter diagnosis or doctor's assessment..." className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] resize-none"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Treatment / Prescription</label>
                  <textarea value={treatment} onChange={e => setTreatment(e.target.value)} rows={3} placeholder="Enter prescribed medicines or given treatments..." className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] resize-none"></textarea>
                </div>
              </div>
              
              <h3 className="text-sm font-bold text-slate-700 mt-6 mb-3 uppercase tracking-wider border-b pb-1">Administer / Dispense Items</h3>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex gap-2 mb-4">
                  <select 
                    value={selectedInventoryItem} 
                    onChange={e => setSelectedInventoryItem(e.target.value)}
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]"
                  >
                    <option value="">Select Item (Medicine, Supply...)</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.generic_name} {item.brand_name ? `(${item.brand_name})` : ''} - {item.category}
                      </option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    min="1"
                    value={dispenseQty} 
                    onChange={e => setDispenseQty(parseInt(e.target.value) || 1)}
                    className="w-24 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" 
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (!selectedInventoryItem) return;
                      const item = inventoryItems.find(i => i.id === parseInt(selectedInventoryItem));
                      if (item) {
                        setDispensedItems(prev => [...prev, { item_id: item.id, quantity: dispenseQty, name: item.generic_name }]);
                        setSelectedInventoryItem('');
                        setDispenseQty(1);
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded hover:bg-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {dispensedItems.length > 0 ? (
                  <ul className="space-y-2">
                    {dispensedItems.map((di, idx) => (
                      <li key={idx} className="flex justify-between items-center bg-white p-2 border border-slate-200 rounded text-sm">
                        <span className="font-semibold text-slate-700">{di.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-500">Qty: <span className="font-bold text-slate-800">{di.quantity}</span></span>
                          <button onClick={() => setDispensedItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic text-center">No items selected to dispense.</p>
                )}
                <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                  <FiAlertCircle /> 
                  Items added here will be automatically deducted from the inventory when you save notes.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 rounded-b-lg">
              <button 
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setMedcertData({ 
                    ...medcertData, 
                    issued_to: activeNoteEntry.patient_name, 
                    reason: diagnosis || 'Medical Consultation',
                    valid_until: tomorrow.toISOString().split('T')[0],
                    clinic_branch: activeNoteEntry.clinic_branch || 'College Clinic'
                  });
                  setIsMedcertModalOpen(true);
                }} 
                className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors flex items-center gap-2"
              >
                <FiPrinter /> Generate Medcert / Prescription
              </button>
              <div className="flex gap-3">
                <button onClick={() => setIsNotesModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                <button onClick={handleSaveNotes} disabled={isSavingNotes} className="px-4 py-2 text-sm font-bold text-white bg-[#8c1526] hover:bg-[#7a1221] rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isSavingNotes ? 'Saving...' : 'Save Medical Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Medical History Modal */}
      {isHistoryModalOpen && selectedProfileDetails && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <div>
                <h2 className="text-lg font-bold text-[#8c1526]">Medical Profile & History</h2>
                <p className="text-xs text-slate-500">View patient details and previous consultations</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row gap-6 p-6">
              {/* Left Column: Profile Info */}
              <div className="w-full md:w-1/3 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider border-b pb-1">Patient Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold text-slate-500 text-xs">Name:</span> <br/> <span className="font-bold text-slate-800">{selectedProfileDetails.first_name} {selectedProfileDetails.last_name}</span></div>
                    <div><span className="font-semibold text-slate-500 text-xs">ID Number:</span> <br/> {selectedProfileDetails.patient_id_number || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-500 text-xs">Type:</span> <br/> <span className="capitalize">{selectedProfileDetails.profile_type}</span></div>
                    <div><span className="font-semibold text-slate-500 text-xs">Department/Course:</span> <br/> {selectedProfileDetails.college_dept || 'N/A'} {selectedProfileDetails.course ? `- ${selectedProfileDetails.course}` : ''}</div>
                    <div><span className="font-semibold text-slate-500 text-xs">Blood Type:</span> <br/> <span className="text-red-600 font-bold">{selectedProfileDetails.blood_type || 'N/A'}</span></div>
                    <div><span className="font-semibold text-slate-500 text-xs">Contact:</span> <br/> {selectedProfileDetails.contact || 'N/A'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider border-b pb-1">Health History</h3>
                  <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                    <p className="whitespace-pre-wrap">{selectedProfileDetails.health_history || 'No health history recorded.'}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Consultation History */}
              <div className="w-full md:w-2/3">
                <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider border-b pb-1">Consultation Records ({selectedProfileHistory.length})</h3>
                <div className="space-y-4 pr-2">
                  {selectedProfileHistory.length === 0 ? (
                    <div className="text-slate-500 text-sm italic py-4">No previous consultations found.</div>
                  ) : (
                    selectedProfileHistory.map((hist: any) => (
                      <div key={hist.id} className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                          <span className="font-bold text-slate-700 text-sm">{new Date(hist.date).toLocaleDateString()} at {new Date(hist.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">{hist.attended_by}</span>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                          <div>
                            <span className="font-bold text-xs text-slate-500 uppercase">Purpose:</span>
                            <p className="text-slate-800">{hist.purpose}</p>
                          </div>
                          
                          {(hist.blood_pressure || hist.temperature || hist.weight) && (
                            <div className="flex gap-4 text-xs bg-slate-50 p-2 rounded">
                              {hist.blood_pressure && <div><span className="font-semibold text-slate-500">BP:</span> {hist.blood_pressure}</div>}
                              {hist.temperature && <div><span className="font-semibold text-slate-500">Temp:</span> {hist.temperature}</div>}
                              {hist.weight && <div><span className="font-semibold text-slate-500">Weight:</span> {hist.weight}</div>}
                            </div>
                          )}

                          {hist.diagnosis && (
                            <div>
                              <span className="font-bold text-xs text-slate-500 uppercase">Diagnosis:</span>
                              <p className="text-slate-800 whitespace-pre-wrap">{hist.diagnosis}</p>
                            </div>
                          )}

                          {hist.treatment && (
                            <div>
                              <span className="font-bold text-xs text-slate-500 uppercase">Treatment / Rx:</span>
                              <p className="text-slate-800 whitespace-pre-wrap">{hist.treatment}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-lg">
              <button onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Medcert Form Modal */}
      {isMedcertModalOpen && activeNoteEntry && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h2 className="text-lg font-bold text-[#8c1526]">Generate Document</h2>
              <button onClick={() => setIsMedcertModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
            </div>
            <form onSubmit={handleGenerateMedcert} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Issued To</label>
                <input required type="text" value={medcertData.issued_to} onChange={e => setMedcertData({...medcertData, issued_to: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Issued By</label>
                <input required type="text" value={medcertData.issued_by} onChange={e => setMedcertData({...medcertData, issued_by: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Remarks</label>
                <textarea required value={medcertData.reason} onChange={e => setMedcertData({...medcertData, reason: e.target.value})} rows={3} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] resize-none"></textarea>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valid Until (Excuse Date)</label>
                <input required type="date" value={medcertData.valid_until} onChange={e => setMedcertData({...medcertData, valid_until: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Clinic Branch</label>
                <select required value={medcertData.clinic_branch} onChange={e => setMedcertData({...medcertData, clinic_branch: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]">
                  <option value="College Clinic">College Clinic</option>
                  <option value="Basic Education Clinic">Basic Education Clinic</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsMedcertModalOpen(false)} disabled={isGeneratingMedcert} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isGeneratingMedcert} className="px-4 py-2 text-sm font-bold text-white bg-[#8c1526] hover:bg-[#7a1221] rounded shadow-sm flex items-center gap-2 disabled:opacity-50">
                  {isGeneratingMedcert ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FiPrinter /> Proceed to Print
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Print View */}
      {showPrintView && (
        <div className="fixed inset-0 bg-gray-500 z-[100] overflow-auto flex flex-col items-center py-10 print:py-0 print:bg-white print:block">
          <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-12 relative flex flex-col">
            
            {/* Action Bar (Hidden in Print) */}
            <div className="absolute top-4 right-4 print:hidden flex gap-2">
              <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded font-bold shadow hover:bg-blue-700 flex items-center gap-2">
                <FiPrinter /> Print Document
              </button>
              <button onClick={() => setShowPrintView(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded font-bold shadow hover:bg-slate-300">
                Close
              </button>
            </div>

            {/* Letterhead */}
            <div className="flex justify-center items-center gap-6 border-b-2 border-[#8c1526] pb-6 mb-8 mt-8 print:mt-0">
              {/* Optional: <img src="/logo.png" alt="CJC Logo" className="w-20 h-20" /> */}
              <div className="text-center">
                <h1 className="text-2xl font-black text-[#8c1526] tracking-wide uppercase">Cor Jesu College</h1>
                <h2 className="text-lg font-bold text-slate-800">CJC {medcertData.clinic_branch}</h2>
                <p className="text-sm text-slate-500">Sacred Heart Avenue, Digos City, Davao del Sur</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-10">
              <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 underline underline-offset-8">Medical Certificate</h3>
            </div>

            {/* Content */}
            <div className="flex-1 text-slate-800 text-justify leading-loose text-lg">
              <p className="mb-6 text-right">Date: <span className="font-semibold underline underline-offset-4">{new Date().toLocaleDateString()}</span></p>
              <p className="mb-6">To whom it may concern,</p>
              <p className="mb-6 indent-8">
                This is to certify that <span className="font-bold underline uppercase px-2">{medcertData.issued_to}</span> has been examined and treated at the Cor Jesu College ({medcertData.clinic_branch}) on the aforementioned date.
              </p>
              <p className="mb-6 indent-8">
                <strong>Diagnosis / Remarks:</strong> {medcertData.reason}
              </p>
              <p className="mb-12 indent-8">
                The patient is advised to rest and is excused from classes/duty until <span className="font-bold underline px-2">{new Date(medcertData.valid_until).toLocaleDateString()}</span>.
              </p>

              {/* Signatures */}
              <div className="mt-20 flex justify-end">
                <div className="text-center w-64">
                  <div className="border-b border-black mb-1 h-12 flex items-end justify-center font-bold text-xl pb-1">
                    {medcertData.issued_by}
                  </div>
                  <div className="text-sm">Clinic Nurse / Physician</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
              Valid only with official clinic signature. Generated by CJC Clinic Management System.
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Consultation;
