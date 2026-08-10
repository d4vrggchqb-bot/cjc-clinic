import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FiSearch, FiEye, FiEdit2, FiPlus, FiActivity, FiTrash2, FiX, FiTag, FiCheckCircle } from 'react-icons/fi';
import PatientModal from '../components/PatientModal';
import PatientViewModal from '../components/PatientViewModal';
import { useConfirm } from '../context/ConfirmContext';

const DEFAULT_CUES = [
  'General Consultation',
  'Fever / Chills',
  'Headache / Dizziness',
  'Stomachache / Abdominal Pain',
  'Blood Pressure Check',
  'Medical Certificate / Physical Exam',
  'First Aid / Injury / Wound Care',
  'Dysmenorrhea',
  'Medication Release',
  'Toothache / Dental',
  'Other Custom Cue'
];

interface Patient {
  id: number;
  profile_type: 'student' | 'employee';
  name: string;
  contact: string | null;
  program_department: string | null;
  blood_type: string | null;
  patient_id_number?: string;
}

interface Pagination {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

const PatientList: React.FC = () => {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 25, total_count: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'student' | 'employee' | 'guest'>('all');
  const [filterDept, setFilterDept] = useState('');
  const [sort, setSort] = useState('newest');
  const [globalSettings, setGlobalSettings] = useState<any>({});
  
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Admit Patient with Cue State
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [admittingPatient, setAdmittingPatient] = useState<Patient | null>(null);
  const [selectedCue, setSelectedCue] = useState('General Consultation');
  const [customCue, setCustomCue] = useState('');
  const [complaintNote, setComplaintNote] = useState('');
  const [isAdmitting, setIsAdmitting] = useState(false);

  useEffect(() => {
    apiFetch('/api/index.php?action=check_session')
      .then(res => {
        if (res.success && res.user) setCurrentUser(res.user);
      })
      .catch(() => {});

    apiFetch('/api/index.php?route=settings&action=get')
      .then(res => {
        if (res.settings) setGlobalSettings(res.settings);
      })
      .catch(() => console.error("Failed to fetch settings"));
  }, []);

  const availableCues = React.useMemo(() => {
    if (Array.isArray(globalSettings?.cues) && globalSettings.cues.length > 0) {
      const merged = [...globalSettings.cues];
      if (!merged.includes('Other Custom Cue')) merged.push('Other Custom Cue');
      return merged;
    }
    return DEFAULT_CUES;
  }, [globalSettings]);

  const allDepartments = React.useMemo(() => {
    const depts = new Set<string>();
    depts.add('Basic Education');
    if (Array.isArray(globalSettings.departments_hierarchy)) {
      globalSettings.departments_hierarchy.forEach((d: any) => depts.add(d.department));
    }
    if (Array.isArray(globalSettings.post_graduate_hierarchy)) {
      globalSettings.post_graduate_hierarchy.forEach((s: any) => depts.add(s.school));
    }
    if (Array.isArray(globalSettings.custom_categories_hierarchy)) {
      globalSettings.custom_categories_hierarchy.forEach((c: any) => {
        if (Array.isArray(c.programs)) c.programs.forEach((p: string) => depts.add(p));
      });
    }
    return Array.from(depts).sort();
  }, [globalSettings]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const handleOpenAdd = () => {
    setSelectedPatientId(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (id: number) => {
    setSelectedPatientId(id);
    setIsEditModalOpen(true);
  };

  const handleOpenView = (id: number) => {
    setSelectedPatientId(id);
    setIsViewModalOpen(true);
  };

  const openAdmitModal = (patient: Patient) => {
    setAdmittingPatient(patient);
    setSelectedCue(availableCues[0] || 'General Consultation');
    setCustomCue('');
    setComplaintNote('');
    setIsAdmitModalOpen(true);
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admittingPatient) return;

    const finalCue = selectedCue === 'Other Custom Cue' ? (customCue.trim() || 'General Consultation') : selectedCue;

    setIsAdmitting(true);
    try {
      const res = await apiFetch('/api/index.php?route=consultations&action=create', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: admittingPatient.id,
          purpose: finalCue,
          complaint: complaintNote
        })
      });
      if (res.success && res.id) {
        setIsAdmitModalOpen(false);
        navigate('/consultation', { state: { openNotesFor: res.id } });
      } else {
        alert('Failed to admit patient: ' + (res.message || 'Unknown error'));
        setIsAdmitting(false);
      }
    } catch (err) {
      console.error('Admission failed:', err);
      alert('An error occurred while admitting the patient.');
      setIsAdmitting(false);
    }
  };

  const handleDeletePatient = async (id: number, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Patient Profile',
      type: 'danger',
      message: `Are you sure you want to permanently delete the profile for "${name}"?\n\nINFORMING NOTICE FOR ADMIN: This action is PERMANENT and NOT REVERSIBLE. Deleting this profile will permanently erase all associated medical history, vital signs records, consultation notes, and uploaded attachments for this patient.`,
      confirmText: 'Delete Permanently',
      confirmVariant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      const res = await apiFetch('/api/index.php?route=patients&action=delete', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      if (res.success) {
        fetchPatients(pagination.page, debouncedSearch, type, filterDept, sort);
      } else {
        alert(res.error || 'Failed to delete patient profile.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete patient profile.');
    }
  };

  useEffect(() => {
    if (location.state?.openAdd) {
      handleOpenAdd();
    }
  }, [location.state]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPatients(pagination.page, debouncedSearch, type, filterDept, sort);
  }, [pagination.page, debouncedSearch, type, filterDept, sort]);

  const fetchPatients = async (page: number, searchQuery: string, filterType: string, dept: string = '', sortOption: string = 'newest') => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/index.php?route=patients&action=list&page=${page}&search=${encodeURIComponent(searchQuery)}&type=${filterType}&dept=${encodeURIComponent(dept)}&sort=${sortOption}`);
      if (res.profiles) {
        setPatients(res.profiles);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div className="px-5 py-5 w-full h-full flex flex-col">
      {/* Header */}
      {currentUser?.role !== 'Superadmin' && (
        <div className="flex flex-col sm:flex-row justify-end sm:items-end gap-4 mb-6 sm:mb-8">
          <button 
            onClick={handleOpenAdd}
            className="bg-[#C01D38] hover:bg-[#a0182f] text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-md text-xs sm:text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-colors shadow-sm w-full sm:w-auto">
            <FiPlus className="w-4 h-4" strokeWidth={3} />
            Add New Patient
          </button>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white rounded-t-md border-t border-l border-r border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md leading-5 bg-[#FAFAFA] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#C01D38] sm:text-sm transition-colors"
              placeholder="Search by name or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPagination(prev => ({...prev, page: 1})); }}
            className="block w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-md leading-5 bg-[#FAFAFA] focus:outline-none focus:bg-white focus:border-[#C01D38] sm:text-sm transition-colors text-slate-700"
          >
            <option value="">All Departments</option>
            {allDepartments.map((dept, idx) => (
              <option key={idx} value={dept}>{dept}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPagination(prev => ({...prev, page: 1})); }}
            className="block w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-md leading-5 bg-[#FAFAFA] focus:outline-none focus:bg-white focus:border-[#C01D38] sm:text-sm transition-colors text-slate-700 font-medium cursor-pointer"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="name_asc">Sort: Name (A - Z)</option>
            <option value="name_desc">Sort: Name (Z - A)</option>
            <option value="dept_asc">Sort: Department</option>
          </select>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-md w-full sm:w-auto">
          <button 
            onClick={() => setType('all')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-sm transition-all ${type === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            All Patients
          </button>
          <button 
            onClick={() => setType('student')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-sm transition-all ${type === 'student' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Students
          </button>
          <button 
            onClick={() => setType('employee')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-sm transition-all ${type === 'employee' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Employees
          </button>
          <button 
            onClick={() => setType('guest')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-sm transition-all ${type === 'guest' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Guests
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Dept / Program
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Blood Type
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" className="relative px-6 py-3.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                // Loading Skeletons
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-slate-100 rounded w-32 animate-pulse"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-5 bg-slate-100 rounded-full w-16 animate-pulse"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-slate-100 rounded w-24 animate-pulse"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-5 bg-slate-100 rounded-full w-8 animate-pulse"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-slate-100 rounded w-28 animate-pulse"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-10 ml-auto animate-pulse"></div></td>
                  </tr>
                ))
              ) : patients.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-lg font-medium text-slate-600 mb-1">No patients found</p>
                      <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                // Actual Data
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-800">{patient.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-[0.65rem] leading-4 font-bold rounded-full uppercase tracking-wider ${
                        patient.profile_type === 'student' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : patient.profile_type === 'guest'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {patient.profile_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500">{patient.program_department || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {patient.blood_type ? (
                        <span className="px-2 py-1 inline-flex text-xs font-semibold rounded bg-red-50 text-red-700">
                          {patient.blood_type}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {patient.contact || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {currentUser?.role !== 'Superadmin' && (
                          <button 
                            onClick={() => openAdmitModal(patient)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors mr-2 cursor-pointer" title="Admit Patient to Queue">
                            <FiActivity className="w-3.5 h-3.5" /> Admit
                          </button>
                        )}
                        <button 
                          onClick={() => handleOpenView(patient.id)}
                          className="bg-slate-50 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors mr-2" title="View Details">
                          <FiEye className="w-3.5 h-3.5" /> View
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(patient.id)}
                          className="bg-slate-50 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors mr-2" title="Edit Patient">
                          <FiEdit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Superadmin') && (
                          <button 
                            onClick={() => handleDeletePatient(patient.id, patient.name)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer" title="Delete Patient Profile Permanently">
                            <FiTrash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between mt-auto">
          <div className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-700">{patients.length > 0 ? (pagination.page - 1) * pagination.per_page + 1 : 0}</span> to <span className="font-semibold text-slate-700">{Math.min(pagination.page * pagination.per_page, pagination.total_count)}</span> of <span className="font-semibold text-slate-700">{pagination.total_count}</span> patients
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.total_pages}
              className="px-3 py-1.5 border border-slate-200 rounded text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PatientModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSave={() => fetchPatients(pagination.page, debouncedSearch, type)} 
        patientId={selectedPatientId} 
      />
      
      <PatientViewModal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        patientId={selectedPatientId} 
      />

      {/* Admit Patient Modal */}
      {isAdmitModalOpen && admittingPatient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setIsAdmitModalOpen(false)}></div>
          
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden z-10 animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="bg-[#9B101E] px-6 py-5 text-white relative">
              <button 
                onClick={() => setIsAdmitModalOpen(false)}
                className="absolute right-4 top-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <FiX className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                  <FiActivity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Admit Patient to Queue</h3>
                  <p className="text-xs text-white/80 font-medium">Categorize visit cue for report generation & queue tracking</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAdmitSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Patient Details</div>
                <div className="text-base font-extrabold text-slate-800">{admittingPatient.name}</div>
                {admittingPatient.patient_id_number && (
                  <div className="text-xs font-semibold text-slate-500">ID: {admittingPatient.patient_id_number}</div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <FiTag className="text-[#C01D38]" /> Select Cue / Purpose of Visit <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedCue}
                    onChange={(e) => setSelectedCue(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#C01D38] focus:ring-2 focus:ring-red-100 transition-all cursor-pointer shadow-2xs"
                  >
                    {availableCues.map((cueOption, idx) => (
                      <option key={idx} value={cueOption}>
                        {cueOption === 'Other Custom Cue' ? 'Other (Type new custom cue...)' : cueOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCue === 'Other Custom Cue' && (
                <div className="animate-in fade-in duration-200 bg-red-50/50 p-3 rounded-2xl border border-red-100 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Write New Cue <span className="text-[#C01D38] text-[11px] font-normal">(Will auto-save to Clinical Presets settings)</span> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customCue}
                    onChange={(e) => setCustomCue(e.target.value)}
                    placeholder="e.g. Dysmenorrhea, Toothache, Ear Checkup..."
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#C01D38] bg-white shadow-2xs"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Chief Complaint / Initial Symptoms (Optional)</label>
                <textarea
                  rows={2}
                  value={complaintNote}
                  onChange={(e) => setComplaintNote(e.target.value)}
                  placeholder="Record initial symptoms or walk-in reason..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C01D38] bg-slate-50 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdmitModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdmitting}
                  className="flex-1 py-2.5 bg-[#C01D38] hover:bg-[#a0182f] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isAdmitting ? 'Admitting...' : 'Admit & Open Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PatientList;

