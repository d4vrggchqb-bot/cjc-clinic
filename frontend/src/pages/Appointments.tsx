import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { FiCalendar, FiPlus, FiClock, FiCheck, FiX, FiSearch, FiUserPlus, FiEdit } from 'react-icons/fi';
import toast from 'react-hot-toast';

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
  group_name?: string | null;
}

interface Patient {
  id: number;
  patient_id_number: string;
  first_name: string;
  last_name: string;
  profile_type: string;
  college_dept: string;
}

const COMMON_PURPOSES = [
  'General Checkup',
  'Dental Checkup',
  'Medical Clearance',
  'Consultation',
  'Follow-up',
  'Other'
];

const SkeletonRow = () => (
  <tr className="border-b border-slate-100 animate-pulse">
    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-200 rounded w-1/2"></div></td>
    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-slate-200 rounded w-1/3"></div></td>
    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
    <td className="p-4"><div className="h-6 bg-slate-200 rounded-full w-20"></div></td>
    <td className="p-4 text-right"><div className="h-8 bg-slate-200 rounded w-16 ml-auto"></div></td>
  </tr>
);

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  // New Appointment Form State
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Edit State
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);
  
  // Group Mode State
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedGroupPatients, setSelectedGroupPatients] = useState<Patient[]>([]);
  const [groupName, setGroupName] = useState('');
  
  // Expanded Groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // Quick Add Patient State
  const [isAddingNewPatient, setIsAddingNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    patient_id_number: '',
    profile_type: 'student'
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [purposeType, setPurposeType] = useState(COMMON_PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

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

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) {
        performSearch(search);
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/index.php?route=appointments&action=list');
      if (res.appointments) {
        setAppointments(res.appointments);
      }
    } catch (err) {
      toast.error('Failed to load appointments');
      console.error(err);
    }
    setIsLoading(false);
  };

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(query)}`);
      // Fixed: The backend returns 'profiles', not 'patients'
      setSearchResults(res.profiles || []);
      setShowSearchDropdown(true);
    } catch (err) {
      toast.error('Failed to search patients');
    }
    setIsSearching(false);
  };

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
        const newPat = {
          id: res.id,
          first_name: newPatient.first_name,
          last_name: newPatient.last_name,
          patient_id_number: newPatient.patient_id_number,
          profile_type: newPatient.profile_type,
          college_dept: ''
        };
        
        if (isGroupMode) {
          setSelectedGroupPatients([...selectedGroupPatients, newPat]);
        } else {
          setSelectedPatient(newPat);
        }
        
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

  const handleCreate = async () => {
    const finalPurpose = purposeType === 'Other' ? customPurpose : purposeType;
    
    if (editingAppointmentId) {
      if (!date || !time || !finalPurpose) {
        toast.error('Please fill in all required fields');
        return;
      }
      setIsSubmitting(true);
      const toastId = toast.loading('Updating appointment...');
      try {
        const res = await apiFetch('/api/index.php?route=appointments&action=updateDetails', {
          method: 'POST',
          body: JSON.stringify({
            id: editingAppointmentId,
            appointment_date: date,
            appointment_time: time,
            purpose: finalPurpose
          })
        });
        if (res.success) {
          toast.success('Appointment updated successfully!', { id: toastId });
          setIsModalOpen(false);
          resetForm();
          fetchAppointments();
        } else {
          toast.error(res.message || 'Failed to update appointment', { id: toastId });
        }
      } catch (err) {
        toast.error('Error updating appointment', { id: toastId });
      }
      setIsSubmitting(false);
      return;
    }
    
    if (isGroupMode) {
      if (selectedGroupPatients.length === 0 || !date || !time || !finalPurpose || !groupName.trim()) {
        toast.error('Please fill in all required fields and select at least one patient');
        return;
      }
      setIsSubmitting(true);
      const toastId = toast.loading(`Scheduling ${selectedGroupPatients.length} appointments...`);
      try {
        const res = await apiFetch('/api/index.php?route=appointments&action=bulkCreate', {
          method: 'POST',
          body: JSON.stringify({
            profile_ids: selectedGroupPatients.map(p => p.id),
            appointment_date: date,
            appointment_time: time,
            purpose: finalPurpose,
            group_name: groupName.trim()
          })
        });
        if (res.success) {
          toast.success(`Successfully scheduled ${res.count} appointments!`, { id: toastId });
          setIsModalOpen(false);
          resetForm();
          fetchAppointments();
        } else {
          toast.error(res.message || 'Failed to create appointments', { id: toastId });
        }
      } catch (err) {
        toast.error('Error creating appointments', { id: toastId });
      }
      setIsSubmitting(false);
    } else {
      if (!selectedPatient || !date || !time || !finalPurpose) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      setIsSubmitting(true);
      const toastId = toast.loading('Scheduling appointment...');
      try {
        const res = await apiFetch('/api/index.php?route=appointments&action=create', {
          method: 'POST',
          body: JSON.stringify({
            profile_id: selectedPatient.id,
            appointment_date: date,
            appointment_time: time,
            purpose: finalPurpose
          })
        });
        if (res.success) {
          toast.success('Appointment scheduled successfully!', { id: toastId });
          setIsModalOpen(false);
          resetForm();
          fetchAppointments();
        } else {
          toast.error(res.message || 'Failed to create appointment', { id: toastId });
        }
      } catch (err) {
        toast.error('Error creating appointment', { id: toastId });
      }
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    const toastId = toast.loading(`Updating to ${status}...`);
    try {
      const res = await apiFetch('/api/index.php?route=appointments&action=update', {
        method: 'POST',
        body: JSON.stringify({ id, status })
      });
      if (res.success) {
        toast.success(`Appointment marked as ${status}`, { id: toastId });
        fetchAppointments();
      } else {
        toast.error('Failed to update status', { id: toastId });
      }
    } catch (err) {
      toast.error('Error updating status', { id: toastId });
    }
  };

  const resetForm = () => {
    setSearch('');
    setSearchResults([]);
    setSelectedPatient(null);
    setSelectedGroupPatients([]);
    setGroupName('');
    setIsGroupMode(false);
    setEditingAppointmentId(null);
    setIsAddingNewPatient(false);
    setNewPatient({ first_name: '', last_name: '', patient_id_number: '', profile_type: 'student' });
    setDate('');
    setTime('');
    setPurposeType(COMMON_PURPOSES[0]);
    setCustomPurpose('');
    setShowSearchDropdown(false);
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  };

  // Filter appointments based on active tab
  const filteredAppointments = appointments.filter(apt => {
    if (activeTab === 'All') return true;
    return apt.status === activeTab;
  });

  const tabs = ['All', 'Scheduled', 'Completed', 'Cancelled', 'No-Show'];

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Appointments</h1>
          <p className="text-slate-500 font-medium text-sm">Schedule and manage clinic visits.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#A5192D] hover:bg-[#8A1525] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-[#A5192D]/20"
        >
          <FiPlus /> New Appointment
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="border-b border-slate-200 px-6 flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-sm font-semibold transition-colors relative ${
                activeTab === tab ? 'text-[#A5192D]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#A5192D] rounded-t-md" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="w-full">
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
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </tbody>
            </table>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <FiCalendar className="text-3xl text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Appointments</h3>
            <p className="text-slate-500 max-w-sm mt-2">
              {activeTab === 'All' 
                ? 'There are no upcoming appointments scheduled for your branch.'
                : `There are no ${activeTab.toLowerCase()} appointments.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
                  <th className="p-4 py-3">Patient / Group</th>
                  <th className="p-4 py-3">Date & Time</th>
                  <th className="p-4 py-3">Purpose</th>
                  <th className="p-4 py-3">Status</th>
                  <th className="p-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderedGroups = new Set<string>();
                  const rows: JSX.Element[] = [];
                  
                  filteredAppointments.forEach((apt) => {
                    if (apt.group_name) {
                      const groupKey = `${apt.group_name}-${apt.appointment_date}-${apt.appointment_time}`;
                      if (!renderedGroups.has(groupKey)) {
                        renderedGroups.add(groupKey);
                        const groupMembers = filteredAppointments.filter(a => 
                          a.group_name === apt.group_name && 
                          a.appointment_date === apt.appointment_date && 
                          a.appointment_time === apt.appointment_time
                        );
                        
                        // Render Group Header
                        rows.push(
                          <tr key={`group-${groupKey}`} className="border-b border-slate-200 bg-blue-50/30 hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}>
                            <td className="p-4 align-top">
                              <div className="flex items-center gap-2">
                                <span className={`transform transition-transform ${expandedGroups[groupKey] ? 'rotate-90' : ''}`}>
                                  ▶
                                </span>
                                <div>
                                  <div className="font-bold text-blue-800">{apt.group_name}</div>
                                  <div className="text-xs text-blue-600 mt-0.5">Group of {groupMembers.length} patients</div>
                                </div>
                              </div>
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
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                Mixed / Group
                              </span>
                            </td>
                            <td className="p-4 align-top text-right">
                              <button 
                                className="text-xs font-medium text-blue-600 hover:underline"
                                onClick={(e) => { e.stopPropagation(); setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] })); }}
                              >
                                {expandedGroups[groupKey] ? 'Collapse' : 'Expand'}
                              </button>
                            </td>
                          </tr>
                        );
                        
                        // Render Group Members if expanded
                        if (expandedGroups[groupKey]) {
                          groupMembers.forEach(member => {
                            rows.push(
                              <tr key={member.id} className="border-b border-slate-100 bg-white hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 align-top pl-12 border-l-2 border-blue-200">
                                  <div className="font-medium text-slate-800">{member.first_name} {member.last_name}</div>
                                  <div className="text-xs text-slate-500 mt-1">{member.patient_id_number || 'No ID'}</div>
                                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                    {member.profile_type}
                                  </span>
                                </td>
                                <td className="p-4 align-top text-slate-400 text-sm">--</td>
                                <td className="p-4 align-top text-slate-400 text-sm">--</td>
                                <td className="p-4 align-top">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                    ${member.status === 'Scheduled' ? 'bg-blue-50 text-blue-700' : ''}
                                    ${member.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : ''}
                                    ${member.status === 'Cancelled' ? 'bg-red-50 text-red-700' : ''}
                                    ${member.status === 'No-Show' ? 'bg-slate-100 text-slate-700' : ''}
                                  `}>
                                    {member.status}
                                  </span>
                                </td>
                                <td className="p-4 align-top text-right">
                                  {member.status === 'Scheduled' && (
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => updateStatus(member.id, 'Completed')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors tooltip" title="Mark Completed"><FiCheck size={16} /></button>
                                      <button onClick={() => updateStatus(member.id, 'Cancelled')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors tooltip" title="Cancel Appointment"><FiX size={16} /></button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        }
                      }
                    } else {
                      // Render Individual Row
                      rows.push(
                        <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
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
                                  onClick={() => {
                                    const pat = {
                                      id: apt.profile_id,
                                      first_name: apt.first_name,
                                      last_name: apt.last_name,
                                      patient_id_number: apt.patient_id_number,
                                      profile_type: apt.profile_type,
                                      college_dept: apt.college_dept
                                    };
                                    setSelectedPatient(pat);
                                    setDate(apt.appointment_date);
                                    setTime(apt.appointment_time.substring(0, 5));
                                    if (COMMON_PURPOSES.includes(apt.purpose)) {
                                      setPurposeType(apt.purpose);
                                      setCustomPurpose('');
                                    } else {
                                      setPurposeType('Other');
                                      setCustomPurpose(apt.purpose);
                                    }
                                    setEditingAppointmentId(apt.id);
                                    setIsGroupMode(false);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors tooltip"
                                  title="Edit Appointment"
                                >
                                  <FiEdit size={16} />
                                </button>
                                <button onClick={() => updateStatus(apt.id, 'Completed')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors tooltip" title="Mark Completed"><FiCheck size={16} /></button>
                                <button onClick={() => updateStatus(apt.id, 'Cancelled')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors tooltip" title="Cancel Appointment"><FiX size={16} /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  });
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-slate-800">
                  {editingAppointmentId ? 'Edit Appointment' : 'New Appointment'}
                </h2>
                {!editingAppointmentId && (
                  <div className="flex items-center bg-slate-200/50 p-1 rounded-lg">
                    <button 
                      onClick={() => { setIsGroupMode(false); setSearch(''); setShowSearchDropdown(false); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isGroupMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Individual
                    </button>
                    <button 
                      onClick={() => { setIsGroupMode(true); setSearch(''); setShowSearchDropdown(false); setSelectedPatient(null); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isGroupMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Group Batch
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-white hover:bg-slate-100 p-1.5 rounded-md"
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {!editingAppointmentId && ((!selectedPatient && !isGroupMode) || isGroupMode) ? (
                <div className="min-h-[250px]" ref={searchRef}>
                  {!isAddingNewPatient ? (
                    <>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Search Patient</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiSearch className="text-slate-400" />
                        </div>
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all"
                          placeholder="Type name or ID to search..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onFocus={() => {
                            if (searchResults.length > 0) setShowSearchDropdown(true);
                          }}
                        />
                        
                        {/* Autocomplete Dropdown */}
                        {showSearchDropdown && search.length >= 2 && (
                          <div className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto">
                            {isSearching ? (
                              <div className="p-4 text-center text-sm text-slate-500">Searching...</div>
                            ) : searchResults.length > 0 ? (
                              searchResults.map(p => (
                                <div 
                                  key={p.id}
                                  onClick={() => setSelectedPatient(p)}
                                  className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                                >
                                  <div>
                                    <div className="font-medium text-slate-800">{p.first_name} {p.last_name}</div>
                                    <div className="text-xs text-slate-500">{p.patient_id_number || 'No ID'}</div>
                                  </div>
                                  {isGroupMode && selectedGroupPatients.some(sp => sp.id === p.id) ? (
                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Added</span>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isGroupMode) {
                                          if (!selectedGroupPatients.some(sp => sp.id === p.id)) {
                                            setSelectedGroupPatients([...selectedGroupPatients, p]);
                                            setSearch('');
                                            setShowSearchDropdown(false);
                                          }
                                        } else {
                                          setSelectedPatient(p);
                                        }
                                      }}
                                      className="text-xs font-medium px-3 py-1.5 bg-[#A5192D] text-white rounded hover:bg-[#8A1525] transition-colors"
                                    >
                                      {isGroupMode ? 'Add' : 'Select'}
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center">
                                <p className="text-sm text-slate-500 mb-3">No patients found.</p>
                                <button
                                  onClick={() => {
                                    setIsAddingNewPatient(true);
                                    setShowSearchDropdown(false);
                                  }}
                                  className="inline-flex items-center gap-2 text-sm font-medium text-[#A5192D] hover:text-[#8A1525] transition-colors"
                                >
                                  <FiUserPlus /> Add New Patient
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-6 border-t border-slate-100 pt-6 text-center">
                        <p className="text-sm text-slate-500 mb-3">Can't find the student/employee?</p>
                        <button
                          onClick={() => {
                            setIsAddingNewPatient(true);
                            setShowSearchDropdown(false);
                          }}
                          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <FiUserPlus /> Register New Patient
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Quick Registration</h3>
                        <button 
                          onClick={() => setIsAddingNewPatient(false)}
                          className="text-sm text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D]"
                              value={newPatient.first_name}
                              onChange={(e) => setNewPatient({...newPatient, first_name: e.target.value})}
                              placeholder="e.g. Juan"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D]"
                              value={newPatient.last_name}
                              onChange={(e) => setNewPatient({...newPatient, last_name: e.target.value})}
                              placeholder="e.g. Dela Cruz"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">ID Number (Optional)</label>
                          <input
                            type="text"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D]"
                            value={newPatient.patient_id_number}
                            onChange={(e) => setNewPatient({...newPatient, patient_id_number: e.target.value})}
                            placeholder="e.g. 123456"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Profile Type *</label>
                          <select
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A5192D] bg-white"
                            value={newPatient.profile_type}
                            onChange={(e) => setNewPatient({...newPatient, profile_type: e.target.value})}
                          >
                            <option value="student">Student</option>
                            <option value="employee">Employee</option>
                          </select>
                        </div>
                        
                        <div className="pt-2">
                          <button
                            onClick={handleQuickAddPatient}
                            disabled={isRegistering || !newPatient.first_name || !newPatient.last_name}
                            className="w-full py-2.5 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 transition-colors"
                          >
                            {isRegistering ? 'Registering...' : 'Save and Select Patient'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              
              {(selectedPatient && !isGroupMode) || (isGroupMode && selectedGroupPatients.length > 0) ? (
                <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300 mt-6 pt-6 border-t border-slate-100">
                  {!isGroupMode ? (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Selected Patient</p>
                        <p className="font-bold text-slate-800">{selectedPatient?.first_name} {selectedPatient?.last_name}</p>
                        <p className="text-sm text-slate-500">{selectedPatient?.patient_id_number || 'No ID'}</p>
                      </div>
                      {editingAppointmentId ? null : (
                        <button 
                          onClick={() => setSelectedPatient(null)}
                          className="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Group Appointment Name *</label>
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="e.g. PE Camping, 1st Year OJT"
                        />
                      </div>
                      <div className="flex justify-between items-center mb-3 pt-3 border-t border-blue-100">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Group Roster ({selectedGroupPatients.length})</p>
                        <button onClick={() => setSelectedGroupPatients([])} className="text-xs text-slate-500 hover:text-red-500 font-semibold">Clear All</button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                        {selectedGroupPatients.map(p => (
                          <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border border-blue-50 shadow-sm text-sm">
                            <span className="font-semibold text-slate-700">{p.first_name} {p.last_name}</span>
                            <button onClick={() => setSelectedGroupPatients(prev => prev.filter(sp => sp.id !== p.id))} className="text-red-400 hover:text-red-600">
                              <FiX />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
                        min="08:00"
                        max="17:00"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all mb-3 bg-white"
                      value={purposeType}
                      onChange={(e) => setPurposeType(e.target.value)}
                    >
                      {COMMON_PURPOSES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    
                    {purposeType === 'Other' && (
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5192D]/20 focus:border-[#A5192D] transition-all animate-in fade-in slide-in-from-top-1"
                        placeholder="Please specify the purpose..."
                        value={customPurpose}
                        onChange={(e) => setCustomPurpose(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={handleCreate}
                      disabled={isSubmitting || (!editingAppointmentId && (isGroupMode ? (selectedGroupPatients.length === 0 || !groupName.trim()) : !selectedPatient)) || !date || !time || (!purposeType && !customPurpose)}
                      className="w-full py-3 rounded-lg font-bold text-white bg-gradient-to-r from-[#A5192D] to-[#8A1525] hover:from-[#8A1525] hover:to-[#6c101d] transition-all shadow-md disabled:opacity-50 disabled:shadow-none"
                    >
                      {isSubmitting ? 'Saving...' : (editingAppointmentId ? 'Save Changes' : (isGroupMode ? `Schedule ${selectedGroupPatients.length} Appointments` : 'Schedule Appointment'))}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
