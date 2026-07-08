import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
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
  patient_id_number: string;
  patient_name: string;
  time_in: string;
  purpose: string;
  time_out: string | null;
  attended_by: string;
  status: string;
}

const Consultation: React.FC = () => {
  const [period, setPeriod] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [purpose, setPurpose] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState('');

  const fetchEntries = () => {
    let url = `/api/index.php?route=consultations&action=list&period=${period}`;
    if (period === 'custom' && fromDate && toDate) {
      url += `&from=${fromDate}&to=${toDate}`;
    }
    
    apiFetch(url)
      .then(res => {
        if (res.sessions) setEntries(res.sessions);
      })
      .catch(err => console.error("Error fetching entries:", err));
  };

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 30000);
    return () => clearInterval(interval);
  }, [period]);

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
      fetchEntries();
    }
  };

  const clearCustomDate = () => {
    setFromDate('');
    setToDate('');
    setPeriod('today');
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
                onClick={() => { setPeriod(p); setFromDate(''); setToDate(''); }}
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
                      <td className="px-4 py-3 font-semibold text-slate-800">{entry.patient_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTimeOnly(entry.time_in)}</td>
                      <td className="px-4 py-3">{entry.purpose}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-500">
                        {entry.time_out ? formatTimeOnly(entry.time_out) : '-'}
                      </td>
                      <td className="px-4 py-3">{entry.attended_by}</td>
                      <td className="px-4 py-3">
                        {!entry.time_out && entry.status === 'active' && (
                          <button 
                            onClick={() => handleTimeOut(entry.id)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1 rounded transition-colors"
                          >
                            Set Time Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-center items-center gap-2 text-xs font-semibold text-slate-500">
            <button className="px-2 py-1 rounded bg-slate-300 text-slate-600" disabled>Prev</button>
            <span>Page 1 of 1</span>
            <button className="px-2 py-1 rounded bg-slate-300 text-slate-600" disabled>Next</button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Consultation;
