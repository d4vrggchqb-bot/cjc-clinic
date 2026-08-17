import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FiSearch, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiPrinter, FiUserPlus, FiX, FiActivity, FiClock, FiEdit2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';
import PatientModal from '../components/PatientModal';


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
  address?: string;
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
  const [availableCues, setAvailableCues] = useState<string[]>([]);
  const [commonConditions, setCommonConditions] = useState<string[]>([
    'Febrile Illness', 'Tension Headache', 'Dysmenorrhea',
    'Upper Respiratory Infection', 'Hyperacidity', 'Acute Gastroenteritis', 'Allergic Rhinitis'
  ]);
  const [medcertPersonnel, setMedcertPersonnel] = useState<any[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  useEffect(() => {
    apiFetch('/api/index.php?route=settings&action=get')
      .then(res => {
        if (res && res.settings) {
          if (Array.isArray(res.settings.cues)) {
            setAvailableCues(res.settings.cues);
          }
          if (Array.isArray(res.settings.medcert_personnel)) {
            setMedcertPersonnel(res.settings.medcert_personnel);
          }
          if (Array.isArray(res.settings.common_conditions) && res.settings.common_conditions.length > 0) {
            setCommonConditions(res.settings.common_conditions);
          }
        }
      })
      .catch(err => console.error("Failed to load settings", err));
  }, []);
  
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
  
  // Medical Notes & Staff Vitals Modal State
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isStaffVitalsModalOpen, setIsStaffVitalsModalOpen] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [activeNoteEntry, setActiveNoteEntry] = useState<LogbookEntry | null>(null);
  const [bp, setBp] = useState('');
  const [temp, setTemp] = useState('');
  const [weight, setWeight] = useState('');
  const [pulse, setPulse] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [vitalsAnalysis, setVitalsAnalysis] = useState<{
    severity: string;
    alerts: { type: string; message: string }[];
    suggested_diagnosis: string[];
    suggested_treatment: string[];
  }>({ severity: 'normal', alerts: [], suggested_diagnosis: [], suggested_treatment: [] });

  const [isEditTimeInModalOpen, setIsEditTimeInModalOpen] = useState(false);
  const [editingTimeInEntry, setEditingTimeInEntry] = useState<LogbookEntry | null>(null);
  const [newTimeInValue, setNewTimeInValue] = useState('');
  const [isUpdatingTimeIn, setIsUpdatingTimeIn] = useState(false);

  // Medical History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProfileDetails, setSelectedProfileDetails] = useState<any>(null);
  const [selectedProfileHistory, setSelectedProfileHistory] = useState<any[]>([]);

  // Dispensing State
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [dispensedItems, setDispensedItems] = useState<{item_id: number, quantity: number, name: string}[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState('');
  const [showDispenseDropdown, setShowDispenseDropdown] = useState(false);
  const [dispenseQty, setDispenseQty] = useState(1);

  // Medcert State
  const [isMedcertModalOpen, setIsMedcertModalOpen] = useState(false);
  const [isGeneratingMedcert, setIsGeneratingMedcert] = useState(false);
  const [medcertData, setMedcertData] = useState({
    issued_to: '',
    address: '',
    issued_by: '',
    issued_by_position: '',
    issued_by_license: '',
    is_essentially_normal: false,
    reason: '',
    valid_until: '',
    clinic_branch: 'College Clinic'
  });
  const [showPrintView, setShowPrintView] = useState(false);

  // Clinic Slip State
  const [isClinicSlipModalOpen, setIsClinicSlipModalOpen] = useState(false);
  const [clinicSlipData, setClinicSlipData] = useState({
    advised: 'class', // 'home' or 'class'
    personnel: ''
  });
  const [showClinicSlipPrintView, setShowClinicSlipPrintView] = useState(false);

  const fetchInventory = () => {
    apiFetch('/api/index.php?route=inventory&action=items')
      .then(res => {
        if (res.items) setInventoryItems(res.items);
      })
      .catch(console.error);
  };

  const fetchEntries = React.useCallback(() => {
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
  }, [period, currentPage, kanbanStatus, selectedBranch, fromDate, toDate]);

  const openNotesModal = (entry: LogbookEntry) => {
    setActiveNoteEntry(entry);
    setBp(entry.blood_pressure ? String(entry.blood_pressure) : '');
    setTemp(entry.temperature ? String(entry.temperature) : '');
    setWeight(entry.weight ? String(entry.weight) : '');
    setDiagnosis(entry.diagnosis || '');
    setTreatment(entry.treatment || '');
    setDispensedItems([]);
    setIsNotesModalOpen(true);
  };

  const openStaffVitalsModal = (entry: LogbookEntry) => {
    setActiveNoteEntry(entry);
    setBp(entry.blood_pressure ? String(entry.blood_pressure) : '');
    setTemp(entry.temperature ? String(entry.temperature) : '');
    setWeight(entry.weight ? String(entry.weight) : '');
    setPulse('');
    setVitalsAnalysis({ severity: 'normal', alerts: [], suggested_diagnosis: [], suggested_treatment: [] });
    setIsStaffVitalsModalOpen(true);
  };

  const openEditTimeInModal = (entry: LogbookEntry) => {
    setEditingTimeInEntry(entry);
    if (entry.time_in) {
      const d = new Date(entry.time_in.includes(' ') ? entry.time_in.replace(' ', 'T') : entry.time_in);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        setNewTimeInValue(`${year}-${month}-${day}T${hours}:${mins}`);
      } else {
        setNewTimeInValue('');
      }
    } else {
      setNewTimeInValue('');
    }
    setIsEditTimeInModalOpen(true);
  };

  const handleUpdateTimeIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimeInEntry || !newTimeInValue) return;

    const confirmed = await confirm({
      title: 'Confirm Time-In Update',
      message: `Are you sure you want to update the Time-In arrival timestamp for "${editingTimeInEntry.patient_name}"?`,
      type: 'warning',
      confirmText: 'Update Timestamp',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    setIsUpdatingTimeIn(true);
    try {
      const res = await apiFetch('/api/index.php?route=consultations&action=update', {
        method: 'POST',
        body: JSON.stringify({
          id: editingTimeInEntry.id,
          action: 'update_time_in',
          time_in: newTimeInValue
        })
      });
      if (res.success) {
        toast.success('Time-In timestamp updated successfully!');
        setIsEditTimeInModalOpen(false);
        fetchEntries();
      } else {
        toast.error(res.message || 'Failed to update Time-In timestamp.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while updating Time-In timestamp.');
    } finally {
      setIsUpdatingTimeIn(false);
    }
  };

  // Live Vitals Analysis Effect
  useEffect(() => {
    if (!isNotesModalOpen && !isStaffVitalsModalOpen) return;
    
    const timer = setTimeout(() => {
      if (String(bp).trim() || String(temp).trim() || String(pulse).trim()) {
        apiFetch(`/api/index.php?route=consultations&action=analyze_vitals&bp=${encodeURIComponent(bp)}&temp=${encodeURIComponent(temp)}&pulse=${encodeURIComponent(pulse)}`)
          .then(res => {
            if (res && res.success) {
              setVitalsAnalysis({
                severity: res.severity || 'normal',
                alerts: Array.isArray(res.alerts) ? res.alerts : [],
                suggested_diagnosis: Array.isArray(res.suggested_diagnosis) ? res.suggested_diagnosis : [],
                suggested_treatment: Array.isArray(res.suggested_treatment) ? res.suggested_treatment : []
              });
            } else {
              setVitalsAnalysis({ severity: 'normal', alerts: [], suggested_diagnosis: [], suggested_treatment: [] });
            }
          })
          .catch(() => {
            setVitalsAnalysis({ severity: 'normal', alerts: [], suggested_diagnosis: [], suggested_treatment: [] });
          });
      } else {
        setVitalsAnalysis({ severity: 'normal', alerts: [], suggested_diagnosis: [], suggested_treatment: [] });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [bp, temp, pulse, isNotesModalOpen, isStaffVitalsModalOpen]);

  const appendDiagnosisSuggestion = (text: string) => {
    setDiagnosis(prev => {
      if (!prev) return text;
      if (prev.includes(text)) return prev;
      return `${prev}, ${text}`;
    });
  };

  const appendTreatmentSuggestion = (text: string) => {
    setTreatment(prev => {
      if (!prev) return text;
      if (prev.includes(text)) return prev;
      return `${prev}\n• ${text}`;
    });
  };

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(() => {
      fetchEntries();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

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

  useEffect(() => {
    if (location.state?.openNotesFor && entries.length > 0) {
      const entryId = location.state.openNotesFor;
      const entry = entries.find(e => e.id === entryId);
      if (entry) {
        if (userRole === 'Staff') {
          openStaffVitalsModal(entry);
        } else {
          openNotesModal(entry);
        }
        window.history.replaceState({}, document.title); // clear state
      }
    }
  }, [location.state, entries, userRole]);

  const handleSaveNotes = async () => {
    if (!activeNoteEntry) return;
    const confirmed = await confirm({
      title: 'Save Medical Notes',
      message: 'Are you sure you want to save these medical notes?',
      type: 'save'
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

  const handleSaveStaffVitals = async () => {
    if (!activeNoteEntry) return;
    setIsSavingNotes(true);
    try {
      const res = await apiFetch(`/api/index.php?route=consultations&action=saveNotes`, {
        method: 'POST',
        body: JSON.stringify({
          id: activeNoteEntry.id,
          blood_pressure: bp,
          temperature: temp,
          weight: weight,
          diagnosis: activeNoteEntry.diagnosis || '',
          treatment: activeNoteEntry.treatment || '',
          clinic_branch: activeNoteEntry.clinic_branch || 'College Clinic'
        })
      });
      if (res.success) {
        toast.success('Patient vital signs saved successfully!');
        setIsStaffVitalsModalOpen(false);
        fetchEntries();
      } else {
        toast.error(res.message || 'Failed to save vital signs.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving vital signs.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleReturnMedicine = async (itemId: number, itemName: string) => {
    const qtyStr = prompt(`How many units of "${itemName}" are being returned?`, '1');
    if (!qtyStr) return;
    const returnQty = parseInt(qtyStr, 10);
    if (isNaN(returnQty) || returnQty <= 0) {
      toast.error('Please enter a valid positive number.');
      return;
    }

    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=return_medicine', {
        method: 'POST',
        body: JSON.stringify({
          item_id: itemId,
          quantity: returnQty,
          profile_id: activeNoteEntry?.profile_id,
          patient_name: activeNoteEntry?.patient_name,
          clinic_branch: activeNoteEntry?.clinic_branch || 'College Clinic'
        })
      });

      if (res.success) {
        toast.success(`Success! ${returnQty} unit(s) of ${itemName} returned to inventory stock.`);
      } else {
        toast.error(res.error || 'Failed to return medicine.');
      }
    } catch (err) {
      toast.error('Network error returning medicine.');
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
    <div className="flex flex-col h-full bg-[#FDFBF7]">
      
      {/* Top Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row xl:justify-end xl:items-center gap-4 flex-shrink-0">
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 overflow-x-auto max-w-full">
            {['today', 'weekly', 'monthly', 'all'].map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setFromDate(''); setToDate(''); setCurrentPage(1); }}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
                  period === p ? 'bg-[#8c1526] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
      <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-6 gap-4 sm:gap-6">
        
        {/* Top Horizontal Bar: Check-in (Hidden for Superadmin) */}
        {userRole !== 'Superadmin' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-5 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <FiUserPlus className="text-[#A5192D]" />
              Quick Check-in
            </h2>
            <button
              onClick={() => {
                setIsRegisterModalOpen(true);
                setShowSearchDropdown(false);
              }}
              className="text-sm font-semibold text-[#A5192D] hover:text-[#8A1525] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FiUserPlus /> Register New Patient
            </button>
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
            <div className="flex flex-col gap-3">
              {/* Primary Form Inputs Row (Labels, Inputs, & Button Perfectly Aligned) */}
              <div className="flex flex-col md:flex-row items-end gap-4 w-full">
                
                {/* Patient Selector */}
                <div className="flex-1 min-w-[260px] relative" ref={searchRef}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Patient *</label>
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
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 pl-9 text-sm focus:outline-none focus:border-[#8c1526] h-[40px]"
                          />
                        </div>
                      </div>
                      
                      {showSearchDropdown && search.length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
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
                    <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 relative flex items-center justify-between h-[40px]">
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

                {/* Cues / Purpose Input */}
                <div className="flex-1 min-w-[280px] relative">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Cues / Purpose *</label>
                    {availableCues.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal">Select cue below or type</span>
                    )}
                  </div>
                  <input 
                    type="text"
                    list="cues-list-suggestions"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Select cue or type purpose..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] h-[40px]"
                  />
                  <datalist id="cues-list-suggestions">
                    {availableCues.map((cue, idx) => (
                      <option key={idx} value={cue} />
                    ))}
                  </datalist>
                </div>

                {/* Check-in Action Button */}
                <button 
                  onClick={handleCheckIn}
                  disabled={!selectedPatient || !purpose.trim() || isCheckingIn}
                  className="bg-[#8c1526] hover:bg-[#7a1221] text-white px-8 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 h-[40px] flex items-center justify-center shrink-0 min-w-[120px] shadow-sm cursor-pointer"
                >
                  {isCheckingIn ? 'Checking in...' : 'Check-In'}
                </button>
              </div>

              {/* Quick Cue Badges Row (Placed neatly underneath Cues / Purpose input) */}
              {availableCues.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Cues:</span>
                  {availableCues.map((cue, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (!purpose) {
                          setPurpose(cue);
                        } else if (!purpose.includes(cue)) {
                          setPurpose(prev => `${prev}, ${cue}`);
                        }
                      }}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer font-medium ${
                        purpose.includes(cue)
                          ? 'bg-[#8c1526] text-white border-[#8c1526] shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      + {cue}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}

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
            
            {(userRole === 'Superadmin') && (
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
                  <th className="px-4 py-2 border-r border-slate-300 font-semibold tracking-wide text-center">Cues / Purpose</th>
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{formatTimeOnly(entry.time_in)}</span>
                          {userRole !== 'Superadmin' && (
                            <button
                              type="button"
                              onClick={() => openEditTimeInModal(entry)}
                              title="Edit Time-In Timestamp"
                              className="p-1 text-slate-400 hover:text-[#C01D38] hover:bg-red-50 rounded-md transition-all cursor-pointer"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
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
                          {userRole !== 'Superadmin' && (
                            <>
                              {entry.status === 'waiting' && (
                                <>
                                  <button 
                                    onClick={() => handleStartConsultation(entry.id)}
                                    className="bg-[#28a745] hover:bg-[#218838] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                  >
                                    Start
                                  </button>
                                  <button 
                                    onClick={() => (userRole.toLowerCase().includes('staff') ? openStaffVitalsModal(entry) : openNotesModal(entry))}
                                    className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <FiActivity className="w-3.5 h-3.5" /> Record Vitals
                                  </button>
                                </>
                              )}
                              {(entry.status === 'in-progress' || entry.status === 'active') && !entry.time_out && (
                                <>
                                  {userRole.toLowerCase().includes('staff') ? (
                                    <button 
                                      onClick={() => openStaffVitalsModal(entry)}
                                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                      <FiActivity className="w-3.5 h-3.5" /> Record Vitals
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => openNotesModal(entry)}
                                      className="bg-[#8c1526] hover:bg-[#7a1221] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                      <FiActivity className="w-3.5 h-3.5" /> Medical Notes & Vitals
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleCheckout(entry.id)}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    Set Time Out
                                  </button>
                                </>
                              )}
                              {entry.status === 'completed' && (
                                <button 
                                  onClick={() => (userRole.toLowerCase().includes('staff') ? openStaffVitalsModal(entry) : openNotesModal(entry))}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                                >
                                  <FiActivity className="w-3.5 h-3.5" /> {userRole.toLowerCase().includes('staff') ? 'View Vitals' : 'View Vitals & Notes'}
                                </button>
                              )}
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
      {/* Medical Notes & Consultation Widescreen Modal */}
      {isNotesModalOpen && activeNoteEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300">
          <div className="bg-white rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.3)] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#8B0E1B] to-[#C01D38] px-6 py-5 flex justify-between items-center text-white shrink-0">
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-bold">
                  <FiActivity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">Medical Notes & Consultation Workspace</h2>
                  <p className="text-white/80 text-xs sm:text-sm">
                    Patient: <span className="font-bold underline underline-offset-2">{activeNoteEntry.patient_name}</span> ({activeNoteEntry.patient_id_number || 'No ID'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsNotesModalOpen(false)} 
                className="relative z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all hover:rotate-90 duration-300 shrink-0"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body: Widescreen 2-Column Grid */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Vitals & Live Smart Clinical Assistant (5 cols) */}
                <div className="lg:col-span-5 space-y-5">
                  
                  {/* Patient Info Quick Card */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">Patient Overview</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-bold text-slate-800">{activeNoteEntry.patient_name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Branch:</span> <span className="font-medium text-slate-700">{activeNoteEntry.clinic_branch || 'College Clinic'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Check-in Purpose:</span> <span className="font-medium text-[#8c1526]">{activeNoteEntry.purpose}</span></div>
                    </div>
                  </div>

                  {/* Vital Signs Card */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                      <span>Vital Signs</span>
                      <span className="text-[10px] text-slate-400 font-normal">Real-time analysis</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Blood Pressure (mmHg)</label>
                        <input 
                          type="text" 
                          value={bp} 
                          onChange={e => setBp(e.target.value)} 
                          placeholder="e.g. 120/80" 
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] bg-slate-50/50" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Temp (°C)</label>
                        <input 
                          type="text" 
                          value={temp} 
                          onChange={e => setTemp(e.target.value)} 
                          placeholder="e.g. 36.5" 
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] bg-slate-50/50" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weight (kg)</label>
                        <input 
                          type="text" 
                          value={weight} 
                          onChange={e => setWeight(e.target.value)} 
                          placeholder="e.g. 60" 
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] bg-slate-50/50" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pulse (bpm)</label>
                        <input 
                          type="text" 
                          value={pulse} 
                          onChange={e => setPulse(e.target.value)} 
                          placeholder="e.g. 75" 
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] bg-slate-50/50" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Smart Clinical Assistant & Suggestion Card */}
                  <div 
                    style={{ padding: '24px' }} 
                    className="bg-gradient-to-br from-amber-50/40 via-white to-rose-50/30 p-6 rounded-2xl border border-amber-200/80 shadow-xs space-y-4"
                  >
                    <div className="flex items-center gap-2.5 pb-3 border-b border-amber-100/90">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <FiActivity className="text-[#8c1526] w-4 h-4 shrink-0" />
                        Smart Vitals Assistant
                      </h4>
                    </div>

                    {/* Vitals Condition Warning Badges */}
                    {vitalsAnalysis?.alerts && Array.isArray(vitalsAnalysis.alerts) && vitalsAnalysis.alerts.length > 0 ? (
                      <div className="space-y-2">
                        {vitalsAnalysis.alerts.map((al, idx) => (
                          <div 
                            key={idx} 
                            className={`text-xs px-3.5 py-2 rounded-xl border font-bold flex items-center gap-2.5 shadow-2xs ${
                              al.type === 'critical'
                                ? 'bg-rose-50 text-rose-800 border-rose-200/90'
                                : al.type === 'warning'
                                ? 'bg-amber-50 text-amber-900 border-amber-200/90'
                                : 'bg-blue-50 text-blue-800 border-blue-200/90'
                            }`}
                          >
                            <FiAlertCircle className="shrink-0 w-4 h-4" />
                            <span>{al.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic leading-relaxed py-1">
                        Type vital signs above (e.g. BP or Temp) to trigger automatic health analysis & diagnosis recommendations.
                      </p>
                    )}

                    {/* Suggested Diagnosis Chips */}
                    {vitalsAnalysis?.suggested_diagnosis && Array.isArray(vitalsAnalysis.suggested_diagnosis) && vitalsAnalysis.suggested_diagnosis.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block mb-1.5">Suggested Diagnoses (Click to Insert):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {vitalsAnalysis.suggested_diagnosis.map((d, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => appendDiagnosisSuggestion(d)}
                              className="text-[11px] bg-[#8c1526]/10 hover:bg-[#8c1526]/20 text-[#8c1526] border border-[#8c1526]/25 px-3 py-1.5 rounded-xl transition-all font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <span>+</span> {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Treatment Chips */}
                    {vitalsAnalysis?.suggested_treatment && Array.isArray(vitalsAnalysis.suggested_treatment) && vitalsAnalysis.suggested_treatment.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block mb-1.5">Suggested Treatment (Click to Insert):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {vitalsAnalysis.suggested_treatment.map((t, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => appendTreatmentSuggestion(t)}
                              className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 px-3 py-1.5 rounded-xl transition-all font-bold text-left flex items-start gap-1 cursor-pointer shadow-2xs"
                            >
                              <span>+</span> {t.length > 40 ? `${t.substring(0, 40)}...` : t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Common Preset Chips */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block mb-2">Quick Common Conditions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {commonConditions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => appendDiagnosisSuggestion(item)}
                          className="text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Right Column: Notes & Dispensing Workspace (7 cols) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Diagnosis & Treatment Text Areas */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                    {userRole === 'Staff' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <FiAlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>Staff Access: You can view medical notes and record patient vital signs, but editing diagnosis and prescriptions is restricted to Physicians/Nurses.</span>
                      </div>
                    )}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-800">Diagnosis / Clinical Assessment *</label>
                        <span className="text-[10px] text-slate-400">Type or click suggestion chips on left</span>
                      </div>
                      <textarea 
                        value={diagnosis} 
                        onChange={e => setDiagnosis(e.target.value)} 
                        disabled={userRole === 'Staff'}
                        rows={3} 
                        placeholder={userRole === 'Staff' ? "Diagnosis entry restricted to Physicians/Nurses" : "Enter diagnosis or doctor's assessment..."} 
                        className={`w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] ${userRole === 'Staff' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50/30'}`}
                      ></textarea>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-800">Treatment / Prescription / Plan</label>
                        <span className="text-[10px] text-slate-400">Care plan & prescribed meds</span>
                      </div>
                      <textarea 
                        value={treatment} 
                        onChange={e => setTreatment(e.target.value)} 
                        disabled={userRole === 'Staff'}
                        rows={3} 
                        placeholder={userRole === 'Staff' ? "Treatment entry restricted to Physicians/Nurses" : "Enter prescribed medicines, advice, or given treatments..."} 
                        className={`w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] ${userRole === 'Staff' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50/30'}`}
                      ></textarea>
                    </div>
                  </div>

                  {/* Administer / Dispense Items Section */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                      <FiActivity className="text-[#8c1526]" />
                      Administer / Dispense Medicines & Supplies
                    </h3>

                    <div className="flex gap-2 mb-4">
                      <div className="relative flex-1">
                        <input 
                          value={selectedInventoryItem} 
                          onChange={e => {
                            setSelectedInventoryItem(e.target.value);
                            setShowDispenseDropdown(true);
                          }}
                          onFocus={() => setShowDispenseDropdown(true)}
                          onBlur={() => setTimeout(() => setShowDispenseDropdown(false), 200)}
                          placeholder="Search Medicine or Supply..."
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#8c1526] focus:ring-1 focus:ring-[#8c1526] h-[40px]"
                        />
                        {showDispenseDropdown && (
                          <ul className="absolute z-20 w-full bg-white border border-slate-200 mt-1 max-h-60 overflow-y-auto rounded-xl shadow-xl">
                            {inventoryItems
                              .filter(item => 
                                `${item.generic_name} ${item.brand_name || ''} ${item.category}`.toLowerCase().includes(selectedInventoryItem.toLowerCase())
                              )
                              .map(item => {
                                const displayName = `${item.generic_name} ${item.brand_name ? `(${item.brand_name})` : ''} - ${item.category}`;
                                return (
                                  <li 
                                    key={item.id} 
                                    className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0"
                                    onClick={() => {
                                      setSelectedInventoryItem(displayName);
                                      setShowDispenseDropdown(false);
                                    }}
                                  >
                                    <div className="font-bold text-slate-800">{item.generic_name} {item.brand_name ? `(${item.brand_name})` : ''}</div>
                                    <div className="text-xs text-slate-500">Category: {item.category} • Stock: <span className="font-bold text-emerald-600">{item.total_stock || 'Available'}</span></div>
                                  </li>
                                );
                              })
                            }
                            {inventoryItems.filter(item => `${item.generic_name} ${item.brand_name || ''} ${item.category}`.toLowerCase().includes(selectedInventoryItem.toLowerCase())).length === 0 && (
                              <li className="px-4 py-3 text-sm text-slate-500">No items found.</li>
                            )}
                          </ul>
                        )}
                      </div>

                      <input 
                        type="number" 
                        min="1"
                        value={dispenseQty} 
                        onChange={e => setDispenseQty(parseInt(e.target.value) || 1)}
                        className="w-20 border border-slate-300 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:border-[#8c1526] h-[40px] font-bold" 
                      />

                      <button 
                        type="button"
                        onClick={() => {
                          if (!selectedInventoryItem) return;
                          const item = inventoryItems.find(i => `${i.generic_name} ${i.brand_name ? `(${i.brand_name})` : ''} - ${i.category}` === selectedInventoryItem);
                          if (item) {
                            setDispensedItems(prev => [...prev, { item_id: item.id, quantity: dispenseQty, name: item.generic_name }]);
                            const itemNote = `Administered ${item.generic_name}${item.brand_name ? ` (${item.brand_name})` : ''} (${dispenseQty} unit/s PO)`;
                            setTreatment(prev => {
                              if (!prev) return itemNote;
                              if (prev.includes(item.generic_name)) return prev;
                              return `${prev}\n• ${itemNote}`;
                            });
                            setSelectedInventoryItem('');
                            setDispenseQty(1);
                          } else {
                            toast.error('Please select a valid item from the list.');
                          }
                        }}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors shrink-0 h-[40px] shadow-xs cursor-pointer"
                      >
                        + Add Item
                      </button>
                    </div>

                    {dispensedItems.length > 0 ? (
                      <div className="space-y-2">
                        {dispensedItems.map((di, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 border border-slate-200/80 rounded-xl text-sm">
                            <span className="font-semibold text-slate-800">{di.name}</span>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-xs text-slate-500">Qty: <span className="font-bold text-slate-800 text-sm">{di.quantity}</span></span>
                              <button
                                type="button"
                                onClick={() => handleReturnMedicine(di.item_id, di.name)}
                                className="text-amber-700 hover:text-amber-800 text-xs font-bold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                              >
                                ↩ Return
                              </button>
                              <button onClick={() => setDispensedItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-700 text-xs font-bold cursor-pointer">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-2">No medicines/supplies selected for dispensing.</p>
                    )}
                    <p className="text-[11px] text-amber-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 mt-3 flex items-center gap-1.5">
                      <FiAlertCircle className="shrink-0 w-3.5 h-3.5" /> 
                      Items added here will be automatically deducted from the clinic inventory upon saving.
                    </p>
                  </div>

                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-slate-200 flex justify-between items-center bg-white shrink-0">
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setMedcertData({ 
                      ...medcertData, 
                      issued_to: activeNoteEntry.patient_name, 
                      is_essentially_normal: false,
                      reason: '',
                      valid_until: '',
                      clinic_branch: activeNoteEntry.clinic_branch || 'College Clinic'
                    });
                    setIsMedcertModalOpen(true);
                  }} 
                  className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-900 bg-white border-2 border-slate-300 hover:border-[#8c1526] hover:text-[#8c1526] rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 group"
                >
                  <span className="p-1.5 rounded-lg bg-rose-100/80 text-[#8c1526] group-hover:bg-[#8c1526] group-hover:text-white transition-colors shadow-2xs">
                    <FiPrinter className="w-4 h-4" />
                  </span>
                  <span>Generate Medcert / Prescription</span>
                </button>
                <button 
                  onClick={() => {
                    setIsClinicSlipModalOpen(true);
                  }} 
                  className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-900 bg-white border-2 border-slate-300 hover:border-[#8c1526] hover:text-[#8c1526] rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 group"
                >
                  <span className="p-1.5 rounded-lg bg-rose-100/80 text-[#8c1526] group-hover:bg-[#8c1526] group-hover:text-white transition-colors shadow-2xs">
                    <FiPrinter className="w-4 h-4" />
                  </span>
                  <span>Generate Clinic Slip</span>
                </button>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsNotesModalOpen(false)} 
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveNotes} 
                  disabled={isSavingNotes} 
                  className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#8c1526] hover:bg-[#7a1221] rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingNotes ? 'Saving Notes...' : 'Save Medical Notes'}
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

      {/* Clinic Slip Form Modal */}
      {isClinicSlipModalOpen && activeNoteEntry && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h2 className="text-lg font-bold text-[#8c1526]">Generate Clinic Slip</h2>
              <button onClick={() => setIsClinicSlipModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Recommendation</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="radio" 
                      name="slip_advised" 
                      checked={clinicSlipData.advised === 'home'} 
                      onChange={() => setClinicSlipData({...clinicSlipData, advised: 'home'})} 
                      className="accent-[#8c1526]"
                    />
                    Advised to go home
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="radio" 
                      name="slip_advised" 
                      checked={clinicSlipData.advised === 'class'} 
                      onChange={() => setClinicSlipData({...clinicSlipData, advised: 'class'})} 
                      className="accent-[#8c1526]"
                    />
                    May resume to class
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Signatory (Nurse/Clerk)</label>
                <select 
                  required 
                  value={clinicSlipData.personnel} 
                  onChange={e => setClinicSlipData({...clinicSlipData, personnel: e.target.value})} 
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]"
                >
                  <option value="" disabled>Select personnel...</option>
                  {medcertPersonnel.map((p, idx) => (
                    <option key={idx} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsClinicSlipModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (!clinicSlipData.personnel) {
                      toast.error('Please select a signatory.');
                      return;
                    }
                    setIsClinicSlipModalOpen(false);
                    setShowClinicSlipPrintView(true);
                  }} 
                  className="px-4 py-2 text-sm font-bold text-white bg-[#8c1526] hover:bg-[#7a1221] rounded shadow-sm flex items-center gap-2"
                >
                  <FiPrinter /> Preview & Print
                </button>
              </div>
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Address (Optional)</label>
                  <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMedcertData({...medcertData, address: selectedProfileDetails?.address || activeNoteEntry?.address || ''});
                        } else {
                          setMedcertData({...medcertData, address: ''});
                        }
                      }} 
                    />
                    Autofill from patient profile
                  </label>
                </div>
                <input type="text" value={medcertData.address} onChange={e => setMedcertData({...medcertData, address: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" placeholder="Leave blank for a blank line" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Issued By</label>
                <select 
                  required 
                  value={medcertData.issued_by} 
                  onChange={e => {
                    const selectedName = e.target.value;
                    const selectedPerson = medcertPersonnel.find(p => p.name === selectedName);
                    setMedcertData({
                      ...medcertData, 
                      issued_by: selectedName,
                      issued_by_position: selectedPerson?.position || '',
                      issued_by_license: selectedPerson?.license_no || ''
                    });
                  }} 
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]"
                >
                  <option value="" disabled>Select personnel...</option>
                  {medcertPersonnel.map((person, idx) => (
                    <option key={idx} value={person.name}>
                      {person.name} ({person.position})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded">
                  <input 
                    type="checkbox" 
                    checked={medcertData.is_essentially_normal}
                    onChange={e => setMedcertData({...medcertData, is_essentially_normal: e.target.checked})}
                    className="w-4 h-4 text-[#8c1526] rounded border-slate-300 focus:ring-[#8c1526]"
                  />
                  Essentially Normal
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Remarks (If with findings)</label>
                <textarea value={medcertData.reason} onChange={e => setMedcertData({...medcertData, reason: e.target.value})} rows={3} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526] resize-none"></textarea>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valid Until (Excuse Date) - Optional</label>
                <input type="date" value={medcertData.valid_until} onChange={e => setMedcertData({...medcertData, valid_until: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]" />
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

      {/* Fullscreen Official Medical Certificate Print View */}
      {showPrintView && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] overflow-auto flex flex-col items-center py-8 print:py-0 print:bg-white print:block">
          
          {/* Action Header Bar (Hidden during printing) */}
          <div className="w-full max-w-[210mm] flex justify-between items-center bg-slate-800 text-white px-6 py-3 rounded-2xl mb-4 print:hidden shadow-lg">
            <div className="flex items-center gap-2 font-bold text-sm">
              <FiPrinter className="text-[#C01D38]" /> Official Document Preview
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => window.print()} 
                className="px-5 py-2 bg-[#C01D38] hover:bg-[#A5192D] text-white rounded-xl font-bold text-xs shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <FiPrinter /> Print Document Now
              </button>
              <button 
                onClick={() => setShowPrintView(false)} 
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>

          {/* A4 Paper Printable Sheet */}
          <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-14 relative flex flex-col text-slate-900 font-serif border border-slate-200 print:border-none print:p-8">
            
            <div>
              <div className="mb-6 relative">
                
                {/* Header Image Background */}
                <img src="/med_cert_header.png" alt="CJC Header" className="w-full h-auto" />

                {/* Right: Document Info Box overlay - perfectly covers the image's drawn box */}
                <div className="absolute top-[5%] right-[0%] bottom-[41%] w-[17%] z-10 overflow-visible">
                  <div className="w-[200%] h-[200%] scale-50 origin-top-left bg-white border-[1px] border-slate-800 flex flex-col justify-evenly px-2 py-1 shadow-sm font-sans leading-none">
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Index No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 text-[14px]">9.9</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Revision No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 text-[14px]">01</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Effective Date:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 whitespace-nowrap tracking-tighter text-[14px]">08/01/2024</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[13px]">Control No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 whitespace-nowrap tracking-tighter text-[13px]">9.9 -C - 2025</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate Header Title */}
              <div className="text-center my-8">
                <h3 className="text-2xl font-extrabold uppercase tracking-widest text-[#8c1526] font-sans underline underline-offset-8">Medical Certificate</h3>
              </div>

              {/* Main Certification Content */}
              <div className="text-slate-800 text-justify text-[15px] space-y-6 mt-8 mb-16 font-serif leading-[2.2]">
                
                <p className="font-bold text-base font-serif mb-6">TO WHOM IT MAY CONCERN:</p>

                <p className="indent-12">
                  This is to certify that <span className="inline-block border-b border-black min-w-[320px] text-center font-bold px-2 uppercase">{medcertData.issued_to}</span>, <span className="inline-block border-b border-black min-w-[60px] text-center px-2">&nbsp;</span> years old
                  <br />and a resident of <span className="inline-block border-b border-black min-w-[440px] text-center px-2 font-semibold uppercase">{medcertData.address || <>&nbsp;</>}</span> has been examined at the
                  <br />School Clinic-Cor Jesu College.
                </p>

                <div className="pl-12 space-y-3 my-6 leading-relaxed">
                  <div className="flex items-center gap-3">
                    <div className="w-[18px] h-[18px] border-[1.5px] border-black shrink-0 flex items-center justify-center font-bold text-sm pb-0.5">
                      {medcertData.is_essentially_normal && <span>✓</span>}
                    </div>
                    <span>ESSENTIALLY NORMAL</span>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="w-[18px] h-[18px] border-[1.5px] border-black shrink-0 flex items-center justify-center font-bold text-sm pb-0.5 mb-1.5">
                      {(!medcertData.is_essentially_normal && medcertData.reason) && <span>✓</span>}
                    </div>
                    <span className="whitespace-nowrap">With Findings:</span>
                    <span className="border-b border-black w-full inline-block min-h-[1.5rem] px-2">{medcertData.reason}</span>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="w-[18px] h-[18px] border-[1.5px] border-black shrink-0 flex items-center justify-center font-bold text-sm pb-0.5 mb-1.5">
                    </div>
                    <span className="whitespace-nowrap">Recommendations/Remarks:</span>
                    <span className="border-b border-black w-full inline-block min-h-[1.5rem] px-2">{medcertData.valid_until ? `Recommended rest until ${new Date(medcertData.valid_until).toLocaleDateString('en-US')}` : ''}</span>
                  </div>
                </div>

                <p className="indent-12">
                  This certification is being issued upon verbal request for whatever legal purpose it may serve.
                  <br />Issued this <span className="inline-block border-b border-black min-w-[200px] text-center px-2 font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span> at Digos City, Davao del Sur, Philippines.
                </p>
              </div>
            </div>

            {/* Bottom Signatures Section */}
            <div className="pt-4 font-serif pb-12 mt-24">
              <div className="flex justify-end">
                <div className="text-center w-[300px]">
                  <div className="font-extrabold text-base text-slate-900 uppercase">
                    {medcertData.issued_by}
                  </div>
                  <div className="text-[15px] text-slate-800">{medcertData.issued_by_position}</div>
                  {medcertData.issued_by_license && (
                    <div className="text-[15px] text-slate-800">Lic. no. {medcertData.issued_by_license}</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Clinic Slip Print View */}
      {showClinicSlipPrintView && activeNoteEntry && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] overflow-auto flex flex-col items-center py-8 print:py-0 print:bg-white print:block">
          
          {/* Action Header Bar (Hidden during printing) */}
          <div className="w-full max-w-[148mm] flex justify-between items-center bg-slate-800 text-white px-6 py-3 rounded-2xl mb-4 print:hidden shadow-lg">
            <div className="flex items-center gap-2 font-bold text-sm">
              <FiPrinter className="text-[#C01D38]" /> Clinic Slip Preview
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => window.print()} 
                className="px-5 py-2 bg-[#C01D38] hover:bg-[#A5192D] text-white rounded-xl font-bold text-xs shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <FiPrinter /> Print Document Now
              </button>
              <button 
                onClick={() => setShowClinicSlipPrintView(false)} 
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>

          {/* A5-ish or Half A4 Paper Printable Sheet */}
          <div className="w-[148mm] min-h-[210mm] bg-white shadow-2xl print:shadow-none p-8 relative flex flex-col text-slate-900 font-sans border border-slate-200 print:border-none print:p-8">
            
            <div>
              <div className="mb-4 relative">
                
                {/* Header Image Background */}
                <img src="/med_cert_header.png" alt="CJC Header" className="w-full h-auto" />

                {/* Right: Document Info Box overlay */}
                <div className="absolute top-[5%] right-[0%] bottom-[41%] w-[17%] z-10 overflow-visible">
                  <div className="w-[200%] h-[200%] scale-50 origin-top-left bg-white border-[1px] border-slate-800 flex flex-col justify-evenly px-2 py-1 shadow-sm font-sans leading-none">
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Index No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 text-[14px]">9.4</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Revision No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 text-[14px]">01</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[14px]">Effective Date:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 whitespace-nowrap tracking-tighter text-[14px]">08/01/2024</span>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-slate-800 whitespace-nowrap text-[13px]">Control No.:</span>
                      <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-1 whitespace-nowrap tracking-tighter text-[13px]">9.4 -C- 2025</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate Header Title */}
              <div className="text-center mb-6 mt-4">
                <h3 className="text-xl font-bold uppercase tracking-wide text-slate-800 font-sans">CLINIC SLIP</h3>
              </div>

              {/* Main Form Fields */}
              <div className="text-slate-800 text-[14px] space-y-4 font-sans leading-relaxed">
                
                <div className="flex justify-between items-end gap-4">
                  <div className="flex items-end gap-2 flex-1">
                    <span className="whitespace-nowrap">Date:</span>
                    <span className="border-b border-black w-full min-w-[120px] pb-0.5">{new Date().toLocaleDateString('en-US')}</span>
                  </div>
                  <div className="flex items-end gap-2 flex-1">
                    <span className="whitespace-nowrap">Time:</span>
                    <span className="border-b border-black w-full min-w-[120px] pb-0.5">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <span className="whitespace-nowrap">Name:</span>
                  <span className="border-b border-black w-full pb-0.5 font-bold uppercase">{activeNoteEntry.patient_name}</span>
                </div>

                <div className="flex items-end gap-2">
                  <span className="whitespace-nowrap">Year & Course:</span>
                  <span className="border-b border-black w-full pb-0.5">{selectedProfileDetails?.course ? `${selectedProfileDetails.year_level || ''} - ${selectedProfileDetails.course}` : ''}</span>
                </div>

                <div className="flex items-end gap-2 mt-6">
                  <span className="whitespace-nowrap">Chief Complaint:</span>
                  <span className="border-b border-black w-full pb-0.5">{activeNoteEntry.purpose}</span>
                </div>

                <div className="mt-4">
                  <div className="mb-1">Cues:</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2">{activeNoteEntry.diagnosis ? activeNoteEntry.diagnosis.split('\n')[0] : ''}</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2">{activeNoteEntry.diagnosis ? activeNoteEntry.diagnosis.split('\n')[1] || '' : ''}</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2">{activeNoteEntry.diagnosis ? activeNoteEntry.diagnosis.split('\n')[2] || '' : ''}</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2"></div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2"></div>
                </div>

                <div className="mt-4">
                  <div className="mb-1">Intervention/Remarks:</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2">{activeNoteEntry.treatment ? activeNoteEntry.treatment.split('\n')[0] : ''}</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2">{activeNoteEntry.treatment ? activeNoteEntry.treatment.split('\n')[1] || '' : ''}</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2">{activeNoteEntry.treatment ? activeNoteEntry.treatment.split('\n')[2] || '' : ''}</div>
                  <div className="border-b border-black w-full h-[1.5rem] mb-2"></div>
                </div>

                <div className="mt-8 pl-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[14px] h-[14px] border-[1.5px] border-black shrink-0 flex items-center justify-center font-bold text-[10px] pb-0.5">
                      {clinicSlipData.advised === 'home' && <span>✓</span>}
                    </div>
                    <span>Advised to go home</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-[14px] h-[14px] border-[1.5px] border-black shrink-0 flex items-center justify-center font-bold text-[10px] pb-0.5">
                      {clinicSlipData.advised === 'class' && <span>✓</span>}
                    </div>
                    <span>May resume to class</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Signatures Section */}
            <div className="pt-4 pb-8 mt-auto">
              <div className="flex justify-end pr-8">
                <div className="text-center w-[250px]">
                  <div className="border-b border-black w-full font-bold uppercase text-[15px] pb-1 mb-1">
                    {clinicSlipData.personnel}
                  </div>
                  <div className="text-[13px] text-slate-800">School Nurse/ Clinic Clerk</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
      {isStaffVitalsModalOpen && activeNoteEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300">
          <div className="bg-white rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.3)] w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-sky-700 to-blue-800 px-6 py-5 flex justify-between items-center text-white shrink-0">
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-bold">
                  <FiActivity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">Patient Vital Signs Record</h2>
                    <span className="bg-white/20 text-white text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border border-white/30">Staff Access</span>
                  </div>
                  <p className="text-white/80 text-xs mt-0.5">
                    Patient: <span className="font-bold underline underline-offset-2">{activeNoteEntry.patient_name}</span> ({activeNoteEntry.patient_id_number || 'No ID'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsStaffVitalsModalOpen(false)} 
                className="relative z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all hover:rotate-90 duration-300 shrink-0"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[80vh] space-y-5 bg-slate-50/50">
              
              {/* Patient Quick Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">Patient Overview</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Name:</span> <span className="font-bold text-slate-800">{activeNoteEntry.patient_name}</span></div>
                  <div><span className="text-slate-500">Branch:</span> <span className="font-medium text-slate-700">{activeNoteEntry.clinic_branch || 'College Clinic'}</span></div>
                  <div className="col-span-2"><span className="text-slate-500">Check-in Purpose:</span> <span className="font-medium text-[#8c1526]">{activeNoteEntry.purpose}</span></div>
                </div>
              </div>

              {/* Vital Signs Form Inputs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>Record Patient Vitals</span>
                  <span className="text-[10px] text-slate-400 font-normal">Real-time Smart Assistant</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Blood Pressure (mmHg)</label>
                    <input 
                      type="text" 
                      value={bp} 
                      onChange={e => setBp(e.target.value)} 
                      placeholder="e.g. 120/80" 
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Temperature (°C)</label>
                    <input 
                      type="text" 
                      value={temp} 
                      onChange={e => setTemp(e.target.value)} 
                      placeholder="e.g. 36.5" 
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Weight (kg)</label>
                    <input 
                      type="text" 
                      value={weight} 
                      onChange={e => setWeight(e.target.value)} 
                      placeholder="e.g. 60" 
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pulse Rate (bpm)</label>
                    <input 
                      type="text" 
                      value={pulse} 
                      onChange={e => setPulse(e.target.value)} 
                      placeholder="e.g. 72" 
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Live Smart Vitals Assistant Alerts */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2 mb-3">
                  <FiActivity className="text-sky-600 w-4 h-4 shrink-0" />
                  Smart Vitals Assistant Analysis
                </h4>

                {vitalsAnalysis?.alerts && Array.isArray(vitalsAnalysis.alerts) && vitalsAnalysis.alerts.length > 0 ? (
                  <div className="space-y-2">
                    {vitalsAnalysis.alerts.map((al, idx) => (
                      <div 
                        key={idx} 
                        className={`text-xs px-3.5 py-2.5 rounded-xl border font-bold flex items-center gap-2.5 shadow-2xs ${
                          al.type === 'critical'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : al.type === 'warning'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        <FiAlertCircle className="shrink-0 w-4 h-4" />
                        <span>{al.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Type vital signs above (e.g. Blood Pressure or Temperature) to trigger automated clinical health alerts.
                  </p>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsStaffVitalsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveStaffVitals}
                disabled={isSavingNotes}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSavingNotes ? 'Saving...' : 'Save Vital Signs'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Patient Registration Modal */}
      <PatientModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSave={() => {
          setIsRegisterModalOpen(false);
          toast.success('Patient registered successfully!');
        }}
        patientId={null}
      />

      {/* Edit Time-In Modal */}
      {isEditTimeInModalOpen && editingTimeInEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setIsEditTimeInModalOpen(false)}></div>
          
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden z-10 animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="bg-[#9B101E] px-6 py-5 text-white relative">
              <button 
                onClick={() => setIsEditTimeInModalOpen(false)}
                className="absolute right-4 top-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <FiX className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                  <FiClock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Edit Time-In Timestamp</h3>
                  <p className="text-xs text-white/80 font-medium">Adjust arrival time for {editingTimeInEntry.patient_name}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateTimeIn} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Patient Name</label>
                <input
                  type="text"
                  value={editingTimeInEntry.patient_name}
                  disabled
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Adjusted Time-In Timestamp <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={newTimeInValue}
                  onChange={(e) => setNewTimeInValue(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#C01D38] bg-slate-50 focus:bg-white transition-all"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditTimeInModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTimeIn}
                  className="flex-1 py-2.5 bg-[#C01D38] hover:bg-[#a0182f] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingTimeIn ? 'Updating...' : 'Save Timestamp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Consultation;
