import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiCalendar, FiPlus, FiClock, FiCheck, FiX, FiSearch } from 'react-icons/fi';

interface Appointment {
  id: number;
  profile_id: number;
  patient_id_number: string;
  first_name: string;
  last_name: string;
  profile_type: string;
  college_dept: string;
  appointment_date: string;
  appointment_time: string;
  purpose: string;
  status: string;
  clinic_branch: string;
}

interface Patient {
  id: number;
  patient_id_number: string;
  first_name: string;
  last_name: string;
  profile_type: string;
  college_dept: string;
}

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Appointment Form State
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/index.php?route=appointments&action=list');
      if (res.appointments) {
        setAppointments(res.appointments);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
    setIsLoading(false);
  };

  const handleSearch = async () => {
    if (!search.trim()) return;
    try {
      const res = await apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(search)}`);
      setSearchResults(res.patients || []);
    } catch (err) {
      console.error('Failed to search patients:', err);
    }
  };

  const handleCreate = async () => {
    if (!selectedPatient || !date || !time || !purpose) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/index.php?route=appointments&action=create', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: selectedPatient.id,
          appointment_date: date,
          appointment_time: time,
          purpose
        })
      });
      if (res.success) {
        setIsModalOpen(false);
        resetForm();
        fetchAppointments();
      } else {
        alert(res.message || 'Failed to create appointment');
      }
    } catch (err) {
      alert('Error creating appointment');
    }
    setIsSubmitting(false);
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await apiFetch('/api/index.php?route=appointments&action=update', {
        method: 'POST',
        body: JSON.stringify({ id, status })
      });
      if (res.success) {
        fetchAppointments();
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const resetForm = () => {
    setSearch('');
    setSearchResults([]);
    setSelectedPatient(null);
    setDate('');
    setTime('');
    setPurpose('');
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  };

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Appointments</h1>
          <p className="text-slate-500 font-medium text-sm">Schedule and manage clinic visits.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#A5192D] text-white px-5 py-2.5 rounded-lg shadow-sm hover:bg-[#8A1525] transition-all font-medium text-sm"
        >
          <FiPlus /> New Appointment
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <FiCalendar className="text-3xl text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Appointments</h3>
            <p className="text-slate-500 max-w-sm mt-2">There are no upcoming appointments scheduled for your branch.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
                  <th className="p-4 py-3">Patient</th>
                  <th className="p-4 py-3">Date & Time</th>
                  <th className="p-4 py-3">Purpose</th>
                  <th className="p-4 py-3">Status</th>
                  <th className="p-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-4 align-top">
                      <div className="font-medium text-slate-800">{apt.first_name} {apt.last_name}</div>
                      <div className="text-xs text-slate-500 mt-1">{apt.patient_id_number}</div>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        {apt.profile_type}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <FiCalendar className="text-slate-400" /> {new Date(apt.appointment_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                        <FiClock className="text-slate-400" /> {formatTime(apt.appointment_time)}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="text-slate-800 text-sm font-medium">{apt.purpose}</div>
                    </td>
                    <td className="p-4 align-top">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                        ${apt.status === 'Scheduled' ? 'bg-blue-50 text-blue-700' : ''}
                        ${apt.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : ''}
                        ${apt.status === 'Cancelled' ? 'bg-red-50 text-red-700' : ''}
                        ${apt.status === 'No-Show' ? 'bg-slate-100 text-slate-700' : ''}
                      `}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="p-4 align-top text-right">
                      {apt.status === 'Scheduled' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => updateStatus(apt.id, 'Completed')}
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors tooltip"
                            title="Mark Completed"
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => updateStatus(apt.id, 'Cancelled')}
                            className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors tooltip"
                            title="Cancel Appointment"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">New Appointment</h2>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {!selectedPatient ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Search Patient</label>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all"
                      placeholder="ID Number or Name"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button 
                      onClick={handleSearch}
                      className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <FiSearch />
                    </button>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                      {searchResults.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium text-slate-800">{p.first_name} {p.last_name}</div>
                            <div className="text-xs text-slate-500">{p.patient_id_number}</div>
                          </div>
                          <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600">{p.profile_type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Selected Patient</p>
                      <p className="font-bold text-slate-800">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                      <p className="text-sm text-slate-500">{selectedPatient.patient_id_number}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedPatient(null)}
                      className="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Time</label>
                      <input
                        type="time"
                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all"
                      placeholder="e.g., Annual Physical Exam, Dental Checkup"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {selectedPatient && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-5 py-2 rounded-lg font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!date || !time || !purpose || isSubmitting}
                  className="px-5 py-2 rounded-lg font-medium text-white bg-[#A5192D] hover:bg-[#8A1525] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
