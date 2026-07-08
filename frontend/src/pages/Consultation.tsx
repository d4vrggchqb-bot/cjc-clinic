import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiSearch, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';

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
  const [period, setPeriod] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [purpose, setPurpose] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  
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

  const fetchEntries = () => {
    let url = `/api/index.php?route=consultations&action=list&period=${period}&page=${currentPage}&per_page=10`;
    if (period === 'custom' && fromDate && toDate) {
      url += `&from=${fromDate}&to=${toDate}`;
    }
    
    apiFetch(url)
      .then(res => {
        if (res.sessions) {
          setEntries(res.sessions);
          setTotalPages(res.total_pages || 1);
        }
      })
      .catch(err => console.error("Error fetching entries:", err));
  };

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 30000);
    return () => clearInterval(interval);
  }, [period, currentPage]);

  // Search logic for left panel
  useEffect(() => {
    if (search.trim() === '') {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(search)}&per_page=5`)
        .then(res => {
          if (res.profiles) setSearchResults(res.profiles);
        })
        .catch(err => console.error("Search error:", err));
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

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
    setIsNotesModalOpen(true);
  };

  const handleSaveNotes = async () => {
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
          diagnosis: diagnosis,
          treatment: treatment
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

  const handleTimeOut = async (id: number) => {
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

  const handleSetAllTimeOut = async () => {
    if (!window.confirm("Are you sure you want to time-out all active visitors today?")) return;
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
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left Panel: Check-in */}
        <div className="w-[350px] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden flex-shrink-0 h-full">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-lg">Check-in Patient</h2>
          </div>
          
          <div className="p-4 flex-1 flex flex-col">
            {checkinError && (
              <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 p-2 rounded border border-red-100">
                {checkinError}
              </div>
            )}

            {!selectedPatient ? (
              <div className="relative flex-1">
                <div className="flex">
                  <input 
                    type="text" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or ID..."
                    className="flex-1 border-y border-l border-slate-300 rounded-l px-3 py-2 text-sm focus:outline-none focus:border-[#8c1526]"
                  />
                  <button className="bg-[#8c1526] hover:bg-[#7a1221] text-white px-4 rounded-r flex items-center justify-center transition-colors">
                    <FiSearch className="w-4 h-4" />
                  </button>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-64 overflow-y-auto z-10">
                    {searchResults.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <div className="font-bold text-sm text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.patient_id_number}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-4 relative">
                  <button 
                    onClick={() => { setSelectedPatient(null); setSearch(''); }}
                    className="absolute top-2 right-2 text-xs text-slate-400 hover:text-red-600 font-bold"
                  >
                    ✕
                  </button>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selected Patient</div>
                  <div className="font-bold text-sm text-slate-800">{selectedPatient.name}</div>
                  <div className="text-xs text-slate-500">{selectedPatient.patient_id_number}</div>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Purpose / Reason</label>
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
                  disabled={!purpose.trim() || isCheckingIn}
                  className="w-full bg-[#8c1526] hover:bg-[#7a1221] text-white py-2 rounded text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isCheckingIn ? 'Checking in...' : 'Check-In'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Data Table */}
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
                onClick={handleSetAllTimeOut}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#28a745] hover:bg-[#218838] px-3 py-1.5 rounded transition-colors shadow-sm"
              >
                <FiCheckCircle className="w-3.5 h-3.5" />
                Set All Time-Out
              </button>
            </div>
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
                                onClick={() => handleTimeOut(entry.id)}
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
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-lg">
              <button onClick={() => setIsNotesModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
              <button onClick={handleSaveNotes} disabled={isSavingNotes} className="px-4 py-2 text-sm font-bold text-white bg-[#8c1526] hover:bg-[#7a1221] rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                {isSavingNotes ? 'Saving...' : 'Save Medical Notes'}
              </button>
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

    </div>
  );
};

export default Consultation;
