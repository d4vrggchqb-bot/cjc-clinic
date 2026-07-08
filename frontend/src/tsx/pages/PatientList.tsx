import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { FiSearch, FiEye, FiEdit2, FiPlus } from 'react-icons/fi';
import PatientModal from '../components/PatientModal';
import PatientViewModal from '../components/PatientViewModal';

interface Patient {
  id: number;
  profile_type: 'student' | 'employee';
  name: string;
  contact: string | null;
  program_department: string | null;
  blood_type: string | null;
}

interface Pagination {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

const PatientList: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 25, total_count: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'student' | 'employee'>('all');
  
  // A debounce mechanism for search would go here ideally, but for now we'll fetch on enter or button click
  // Or we can just use a simple useEffect dependency on search
  // To avoid spamming, let's use a delayed search effect
  const [debouncedSearch, setDebouncedSearch] = useState('');

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPatients(pagination.page, debouncedSearch, type);
  }, [pagination.page, debouncedSearch, type]);

  const fetchPatients = async (page: number, searchQuery: string, filterType: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/index.php?route=patients&action=list&page=${page}&search=${encodeURIComponent(searchQuery)}&type=${filterType}`);
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
    <div className="p-10 w-full max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Patient Directory</h1>
          <p className="text-slate-400 text-sm font-medium">Manage and view all registered students and employees</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-[#C01D38] hover:bg-[#a0182f] text-white px-5 py-2.5 rounded-md text-sm font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-sm">
          <FiPlus className="w-4 h-4" strokeWidth={3} />
          Add New Patient
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-t-md border-t border-l border-r border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Search */}
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md leading-5 bg-[#FAFAFA] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#C01D38] sm:text-sm transition-colors"
            placeholder="Search by name or contact number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                        <button 
                          onClick={() => handleOpenView(patient.id)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1" title="View Details">
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(patient.id)}
                          className="text-slate-400 hover:text-[#C01D38] transition-colors p-1" title="Edit Patient">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
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
    </div>
  );
};

export default PatientList;
