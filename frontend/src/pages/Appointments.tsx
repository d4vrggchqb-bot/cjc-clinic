import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { FiCalendar, FiPlus, FiClock, FiCheck, FiX, FiSearch, FiUserPlus, FiEdit, FiFilter, FiUsers, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';
import PatientModal from '../components/PatientModal';


interface Appointment {
  id: number;
  appointment_code?: string;
  profile_id: number;
  patient_id_number: string;
  first_name: string;
  last_name: string;
  profile_type: string;
  college_dept: string;
  course?: string | null;
  year_level?: string | null;
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
  year_level?: string;
}

// Cues will be loaded from settings (managed in Settings -> Clinical Presets)
// Fallback to a small default list if settings are not available yet
const DEFAULT_CUES = [
  'General Checkup',
  'Dental Checkup',
  'Medical Clearance',
  'Consultation',
  'Follow-up'
];

interface ProgramItem {
  label: string;
  value: string;
  years: string[];
}

interface DepartmentCategory {
  id: string;
  name: string;
  programs: ProgramItem[];
}

const DEFAULT_DEPARTMENT_HIERARCHY: DepartmentCategory[] = [
  {
    id: 'CCIS',
    name: 'CCIS - College of Computer & Information Sciences',
    programs: [
      { label: 'BS Information Technology (BSIT)', value: 'BSIT', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'BS Computer Science (BSCS)', value: 'BSCS', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'All Programs in CCIS', value: 'All', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] }
    ]
  },
  {
    id: 'CON',
    name: 'CON - College of Nursing',
    programs: [
      { label: 'BS Nursing (BSN)', value: 'BSN', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'All Programs in CON', value: 'All', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] }
    ]
  },
  {
    id: 'CTE',
    name: 'CTE - College of Teacher Education',
    programs: [
      { label: 'Bachelor of Elementary Education (BEED)', value: 'BEED', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'Bachelor of Secondary Education (BSED)', value: 'BSED', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'All Programs in CTE', value: 'All', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] }
    ]
  },
  {
    id: 'CBE',
    name: 'CBE - College of Business & Education',
    programs: [
      { label: 'BS Business Administration (BSBA)', value: 'BSBA', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'BS Accountancy (BSA)', value: 'BSA', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'All Programs in CBE', value: 'All', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] }
    ]
  },
  {
    id: 'CCJE',
    name: 'CCJE - College of Criminal Justice Education',
    programs: [
      { label: 'BS Criminology (BSCRIM)', value: 'BSCRIM', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'All Programs in CCJE', value: 'All', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] }
    ]
  },
  {
    id: 'Basic Education',
    name: 'Basic Education Department (BED)',
    programs: [
      {
        label: 'Elementary School',
        value: 'Elementary',
        years: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Kindergarten', 'Nursery', 'All Elementary Grades']
      },
      {
        label: 'Junior High School (JHS)',
        value: 'Junior High School',
        years: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'All JHS Grades']
      },
      {
        label: 'Senior High School (SHS)',
        value: 'Senior High School',
        years: ['Grade 11', 'Grade 12', 'All SHS Grades']
      },
      {
        label: 'All Basic Education Programs',
        value: 'All',
        years: [
          'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
          'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
          'Kindergarten', 'Nursery', 'All BED Levels'
        ]
      }
    ]
  },
  {
    id: 'Post Graduate',
    name: 'Post Graduate / Law School',
    programs: [
      { label: 'Law School (Juris Doctor)', value: 'Juris Doctor', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'Masteral Programs', value: 'Masteral', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] },
      { label: 'All Post Graduate Programs', value: 'All', years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'] }
    ]
  },
  {
    id: 'All',
    name: 'All Departments',
    programs: [
      {
        label: 'All Programs',
        value: 'All',
        years: [
          '1st Year', '2nd Year', '3rd Year', '4th Year',
          'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
          'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
          'All Year Levels'
        ]
      }
    ]
  }
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
  const { confirm } = useConfirm();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [listSearchQuery, setListSearchQuery] = useState('');

  // Advanced Dropdown Filter States
  const [filterPatientType, setFilterPatientType] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterYearLevel, setFilterYearLevel] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFiltersBar, setShowFiltersBar] = useState(false);

  const resetAllFilters = () => {
    setFilterPatientType('all');
    setFilterDepartment('all');
    setFilterProgram('all');
    setFilterYearLevel('all');
    setStartDate('');
    setEndDate('');
    setListSearchQuery('');
  };

  const activeFiltersCount = (filterPatientType !== 'all' ? 1 : 0) +
    (filterDepartment !== 'all' ? 1 : 0) +
    (filterProgram !== 'all' ? 1 : 0) +
    (filterYearLevel !== 'all' ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

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
  
  // Department, Program & Year Batch Selector State
  const [batchDept, setBatchDept] = useState('CCIS');
  const [batchProgram, setBatchProgram] = useState('BSIT');
  const [batchYear, setBatchYear] = useState('1st Year');
  const [fetchedBatchPatients, setFetchedBatchPatients] = useState<Patient[]>([]);
  const [checkedBatchPatientIds, setCheckedBatchPatientIds] = useState<Record<number, boolean>>({});
  const [isFetchingBatch, setIsFetchingBatch] = useState(false);
  const [hasFetchedBatch, setHasFetchedBatch] = useState(false);
  const [departmentsHierarchy, setDepartmentsHierarchy] = useState<DepartmentCategory[]>(DEFAULT_DEPARTMENT_HIERARCHY);

  const selectedDeptObj = departmentsHierarchy.find(d => d.id === batchDept) || departmentsHierarchy[0] || DEFAULT_DEPARTMENT_HIERARCHY[0];
  const availablePrograms = selectedDeptObj?.programs || [];
  const selectedProgramObj = availablePrograms.find(p => p.value === batchProgram) || availablePrograms[0];
  const availableYears = selectedProgramObj?.years || ['1st Year'];

  const handleDeptChange = (newDeptId: string) => {
    setBatchDept(newDeptId);
    const deptObj = departmentsHierarchy.find(d => d.id === newDeptId) || departmentsHierarchy[0] || DEFAULT_DEPARTMENT_HIERARCHY[0];
    const firstProg = (deptObj?.programs || [])[0];
    if (firstProg) {
      setBatchProgram(firstProg.value);
      setBatchYear((firstProg.years || ['1st Year'])[0] || '1st Year');
    }
    setFetchedBatchPatients([]);
    setCheckedBatchPatientIds({});
    setHasFetchedBatch(false);
  };

  const handleProgramChange = (newProgValue: string) => {
    setBatchProgram(newProgValue);
    const progObj = availablePrograms.find(p => p.value === newProgValue) || availablePrograms[0];
    if (progObj && progObj.years && progObj.years.length > 0) {
      setBatchYear(progObj.years[0]);
    } else {
      setBatchYear('1st Year');
    }
    setFetchedBatchPatients([]);
    setCheckedBatchPatientIds({});
    setHasFetchedBatch(false);
  };

  const handleYearChange = (newYearValue: string) => {
    setBatchYear(newYearValue);
    setFetchedBatchPatients([]);
    setCheckedBatchPatientIds({});
    setHasFetchedBatch(false);
  };

  const handleFetchBatchStudents = async () => {
    setIsFetchingBatch(true);
    setHasFetchedBatch(false);
    const toastId = toast.loading(`Fetching students for ${batchDept} - ${batchProgram} (${batchYear})...`);
    try {
      const res = await apiFetch(`/api/index.php?route=patients&action=by_program_year&dept=${encodeURIComponent(batchDept)}&program=${encodeURIComponent(batchProgram)}&year_level=${encodeURIComponent(batchYear)}`);
      setHasFetchedBatch(true);
      if (res && res.success && Array.isArray(res.profiles)) {
        setFetchedBatchPatients(res.profiles);
        const initialCheckedMap: Record<number, boolean> = {};
        res.profiles.forEach((p: Patient) => {
          initialCheckedMap[p.id] = true;
        });
        setCheckedBatchPatientIds(initialCheckedMap);

        if (res.profiles.length > 0) {
          toast.success(`Found ${res.profiles.length} student(s)! You can uncheck any absent student.`, { id: toastId });
          if (!groupName.trim()) {
            setGroupName(`${batchDept} ${batchProgram !== 'All' ? batchProgram : ''} ${batchYear !== 'All Year Levels' ? batchYear : ''} Appointment`.trim());
          }
        } else {
          const matchLabel = [batchDept, batchProgram !== 'All' ? batchProgram : '', !batchYear.toLowerCase().includes('all') ? batchYear : 'All Levels'].filter(Boolean).join(' ');
          toast(`No students found matching ${matchLabel}.`, { icon: 'ℹ️', id: toastId });
        }
      } else {
        toast.error((res && (res.error || res.message)) || 'Failed to fetch students.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Fetch batch students error:', err);
      toast.error(err?.message || 'Error fetching students from server.', { id: toastId });
    } finally {
      setIsFetchingBatch(false);
    }
  };

  const handleTogglePatientCheck = (patientId: number) => {
    setCheckedBatchPatientIds(prev => ({
      ...prev,
      [patientId]: !prev[patientId]
    }));
  };

  const handleToggleSelectAllBatch = (selectAll: boolean) => {
    const newMap: Record<number, boolean> = {};
    fetchedBatchPatients.forEach(p => {
      newMap[p.id] = selectAll;
    });
    setCheckedBatchPatientIds(newMap);
  };

  const handleAddCheckedStudentsToRoster = () => {
    const checkedStudents = fetchedBatchPatients.filter(p => checkedBatchPatientIds[p.id]);
    if (checkedStudents.length === 0) {
      toast.error('Please check at least one student to add to the group roster.');
      return;
    }

    let addedCount = 0;
    setSelectedGroupPatients(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newToAppend = checkedStudents.filter(p => !existingIds.has(p.id));
      addedCount = newToAppend.length;
      return [...prev, ...newToAppend];
    });

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} selected student(s) to Group Roster!`);
    } else {
      toast('All selected students are already in the Group Roster.', { icon: 'ℹ️' });
    }
  };
  
  // Expanded Groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cues, setCues] = useState<string[]>([]);
  const [purposeType, setPurposeType] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAppointments();
    // Fetch cues from settings so the appointment form reflects configurable options
    (async () => {
      try {
        const res = await apiFetch('/api/index.php?route=settings&action=get');
        if (res.settings && Array.isArray(res.settings.cues) && res.settings.cues.length > 0) {
          setCues(res.settings.cues);
          setPurposeType(res.settings.cues[0]);
        } else {
          setCues(DEFAULT_CUES);
          setPurposeType(DEFAULT_CUES[0]);
        }
        if (res.settings && Array.isArray(res.settings.departments_hierarchy) && res.settings.departments_hierarchy.length > 0) {
          const globalYears = Array.isArray(res.settings.college_year_levels) && res.settings.college_year_levels.length > 0
            ? res.settings.college_year_levels 
            : ['1st Year', '2nd Year', '3rd Year', '4th Year', 'All Year Levels'];
            
          const normalizedHierarchy = res.settings.departments_hierarchy.map((item: any) => {
            // Handle the raw settings format: { department: '...', programs: ['...'] }
            if (item.department && Array.isArray(item.programs)) {
              return {
                id: item.department,
                name: item.department,
                programs: item.programs.length > 0 ? item.programs.map((p: any) => ({
                  label: typeof p === 'string' ? p : p?.label || 'Unknown',
                  value: typeof p === 'string' ? p : p?.value || 'Unknown',
                  years: globalYears
                })) : [{ label: 'All Programs', value: 'All', years: globalYears }]
              };
            }
            // Fallback for valid format if it ever changes
            return item;
          });
          
          setDepartmentsHierarchy(normalizedHierarchy);
          setBatchDept(normalizedHierarchy[0].id);
          if (normalizedHierarchy[0].programs && normalizedHierarchy[0].programs.length > 0) {
            setBatchProgram(normalizedHierarchy[0].programs[0].value);
            if (normalizedHierarchy[0].programs[0].years && normalizedHierarchy[0].programs[0].years.length > 0) {
              setBatchYear(normalizedHierarchy[0].programs[0].years[0]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load settings cues', err);
        setCues(DEFAULT_CUES);
        setPurposeType(DEFAULT_CUES[0]);
      }
    })();
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
    } finally {
      setIsSearching(false);
    }
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
          const codeMsg = res.appointment_code ? ` Code: ${res.appointment_code}` : '';
          toast.success(`Appointment scheduled successfully!${codeMsg}`, { id: toastId });
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

  const handleUpdate = async (id: number, status: string) => {
    const confirmed = await confirm({
      title: 'Update Appointment',
      message: `Are you sure you want to mark this appointment as ${status}?`,
      type: 'warning'
    });
    if (!confirmed) return;

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
    setDate('');
    setTime('');
    setPurposeType((cues && cues.length > 0) ? cues[0] : DEFAULT_CUES[0]);
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

  // Filter appointments based on active tab, search query, and advanced dropdown filters
  const filteredAppointments = appointments.filter(apt => {
    // 1. Status Tab Filter
    if (activeTab !== 'All' && apt.status !== activeTab) return false;

    // 2. Patient Type Filter
    if (filterPatientType !== 'all' && apt.profile_type !== filterPatientType) return false;

    // 3. Department Filter
    if (filterDepartment !== 'all') {
      const dept = (apt.college_dept || '').toLowerCase();
      const targetDept = filterDepartment.toLowerCase();
      if (!dept.includes(targetDept) && !targetDept.includes(dept)) return false;
    }

    // 4. Program Filter
    if (filterProgram !== 'all') {
      const prog = (apt.course || apt.group_name || '').toLowerCase();
      if (!prog.includes(filterProgram.toLowerCase())) return false;
    }

    // 5. Year Level Filter
    if (filterYearLevel !== 'all') {
      const yl = (apt.year_level || apt.group_name || '').toLowerCase();
      if (!yl.includes(filterYearLevel.toLowerCase())) return false;
    }

    // 6. Date Range Filter
    if (startDate && apt.appointment_date < startDate) return false;
    if (endDate && apt.appointment_date > endDate) return false;

    // 7. Search Query Filter
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase();
      const codeMatch = (apt.appointment_code || `APT-${apt.id}`).toLowerCase().includes(q);
      const nameMatch = `${apt.first_name} ${apt.last_name}`.toLowerCase().includes(q);
      const idMatch = (apt.patient_id_number || '').toLowerCase().includes(q);
      const purposeMatch = (apt.purpose || '').toLowerCase().includes(q);
      const groupMatch = (apt.group_name || '').toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !idMatch && !purposeMatch && !groupMatch) return false;
    }

    return true;
  });

  const tabs = ['All', 'Scheduled', 'Completed', 'Cancelled', 'No-Show'];

  return (
    <div className="px-5 py-5 w-full">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ref code (e.g. APT-2026-00001), name, ID, or cue..."
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#A5192D] bg-white shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFiltersBar(!showFiltersBar)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                showFiltersBar || activeFiltersCount > 0
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <FiFilter size={15} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#A5192D] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="bg-[#A5192D] hover:bg-[#8A1525] text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-[#A5192D]/20 text-xs sm:text-sm shrink-0"
            >
              <FiPlus className="w-4 h-4" /> New Appointment
            </button>
          </div>
        </div>

        {/* Dropdown Filters Panel */}
        {showFiltersBar && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FiFilter className="text-[#A5192D]" /> Filter Appointments By Criteria
              </span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <FiRefreshCw size={12} /> Clear All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* Date Range Start & End */}
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="font-semibold text-slate-600 block">Date Range</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                    title="Start Date"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                    title="End Date"
                  />
                </div>
              </div>

              {/* Patient Type */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 block">Patient Type</label>
                <select
                  value={filterPatientType}
                  onChange={(e) => setFilterPatientType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                >
                  <option value="all">All Patient Types</option>
                  <option value="student">Student</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 block">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                >
                  <option value="all">All Departments</option>
                  <option value="CCIS">CCIS (Computer Studies)</option>
                  <option value="CON">CON (Nursing)</option>
                  <option value="CTE">CTE (Teacher Education)</option>
                  <option value="CBE">CBE (Business & Education)</option>
                  <option value="CCJE">CCJE (Criminology)</option>
                  <option value="Basic Education">Basic Education (BED)</option>
                </select>
              </div>

              {/* Program */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 block">Program / Course</label>
                <select
                  value={filterProgram}
                  onChange={(e) => setFilterProgram(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                >
                  <option value="all">All Programs</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSCS">BSCS</option>
                  <option value="BSN">BSN</option>
                  <option value="BEED">BEED</option>
                  <option value="BSED">BSED</option>
                  <option value="BSBA">BSBA</option>
                  <option value="BSA">BSA</option>
                  <option value="BSCRIM">BSCRIM</option>
                  <option value="Elementary">Elementary</option>
                  <option value="Junior High School">Junior High School (JHS)</option>
                  <option value="Senior High School">Senior High School (SHS)</option>
                </select>
              </div>

              {/* Year Level */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 block">Year Level</label>
                <select
                  value={filterYearLevel}
                  onChange={(e) => setFilterYearLevel(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                >
                  <option value="all">All Year Levels</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="border-b border-slate-200 px-4 sm:px-6 flex gap-4 sm:gap-6 overflow-x-auto max-w-full">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3.5 sm:py-4 text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap ${
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
                  <th className="p-4 py-3">Appt Code</th>
                  <th className="p-4 py-3">Patient</th>
                  <th className="p-4 py-3">Date & Time</th>
                  <th className="p-4 py-3">Cues</th>
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
                  <th className="p-4 py-3">Appt Code</th>
                  <th className="p-4 py-3">Patient / Group</th>
                  <th className="p-4 py-3">Date & Time</th>
                  <th className="p-4 py-3">Cues</th>
                  <th className="p-4 py-3">Status</th>
                  <th className="p-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderedGroups = new Set<string>();
                  const rows: React.ReactNode[] = [];
                  
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
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/80 border border-blue-200 px-2 py-1 rounded inline-block shadow-2xs">
                                GROUP ({groupMembers.length})
                              </span>
                            </td>
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
                                <td className="p-4 align-top pl-8 border-l-2 border-blue-200">
                                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded inline-block shadow-2xs">
                                    {member.appointment_code || `APT-${member.id}`}
                                  </span>
                                </td>
                                <td className="p-4 align-top">
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
                                      <button onClick={() => handleUpdate(member.id, 'Completed')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors tooltip" title="Mark Completed"><FiCheck size={16} /></button>
                                      <button onClick={() => handleUpdate(member.id, 'Cancelled')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors tooltip" title="Cancel Appointment"><FiX size={16} /></button>
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
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded inline-block shadow-2xs">
                              {apt.appointment_code || `APT-${apt.id}`}
                            </span>
                          </td>
                          <td className="p-4 align-top">
                            <div className="font-bold text-slate-800 text-sm">{apt.first_name} {apt.last_name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{apt.patient_id_number}</div>
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
                                    if ((cues.length > 0 ? cues : DEFAULT_CUES).includes(apt.purpose)) {
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
                                <button onClick={() => handleUpdate(apt.id, 'Completed')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors tooltip" title="Mark Completed"><FiCheck size={16} /></button>
                                <button onClick={() => handleUpdate(apt.id, 'Cancelled')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors tooltip" title="Cancel Appointment"><FiX size={16} /></button>
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 transition-all duration-300">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            
            {/* Sleek Gradient Header (Matching Patient Registration Modal) */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#8B0E1B] to-[#C01D38] px-6 py-4 sm:py-5 flex justify-between items-center gap-4 text-white shrink-0">
              {/* Decorative background shapes */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col flex-1 pr-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  {editingAppointmentId ? 'Edit Appointment' : 'Schedule New Appointment'}
                </h2>
                <p className="text-white/90 text-xs sm:text-sm mt-0.5 font-normal">
                  Schedule individual or group batch appointments for clinic visits
                </p>
              </div>

              {!editingAppointmentId && (
                <div className="bg-black/20 backdrop-blur-md p-1 rounded-xl flex gap-1 border border-white/10 shrink-0">
                  <button 
                    onClick={() => { setIsGroupMode(false); setSelectedGroupPatients([]); setGroupName(''); }}
                    className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${!isGroupMode ? 'bg-white text-[#C01D38] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                  >
                    Individual Patient
                  </button>
                  <button 
                    onClick={() => { setIsGroupMode(true); setSearch(''); setShowSearchDropdown(false); setSelectedPatient(null); }}
                    className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${isGroupMode ? 'bg-white text-[#C01D38] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                  >
                    Group Batch
                  </button>
                </div>
              )}

              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="relative z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 sm:p-2.5 rounded-full transition-all hover:rotate-90 duration-300 shrink-0 cursor-pointer"
                aria-label="Close modal"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {!editingAppointmentId && ((!selectedPatient && !isGroupMode) || isGroupMode) ? (
                <div className="min-h-[150px]" ref={searchRef}>
                  {!isGroupMode && (
                    <>
                      <label className="block text-sm font-bold text-slate-800 mb-2">Search Patient</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiSearch className="text-slate-400" />
                        </div>
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all bg-slate-50/50"
                          placeholder="Type patient name or ID to search..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onFocus={() => {
                            if (searchResults.length > 0) setShowSearchDropdown(true);
                          }}
                        />
                        
                        {/* Autocomplete Dropdown */}
                        {showSearchDropdown && search.length >= 2 && (
                          <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto">
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
                                    <div className="font-semibold text-slate-800">{p.first_name} {p.last_name}</div>
                                    <div className="text-xs text-slate-500">{p.patient_id_number || 'No ID'}</div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPatient(p);
                                    }}
                                    className="text-xs font-bold px-3.5 py-1.5 bg-[#C01D38] text-white rounded-lg hover:bg-[#8B0E1B] transition-colors"
                                  >
                                    Select Patient
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center">
                                <p className="text-sm text-slate-500 mb-3">No patients found.</p>
                                <button
                                  onClick={() => {
                                    setIsModalOpen(false);
                                    setShowSearchDropdown(false);
                                    setIsRegisterModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-2 text-sm font-bold text-[#C01D38] hover:underline transition-colors cursor-pointer"
                                >
                                  <FiUserPlus /> Register New Patient
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
                            setIsModalOpen(false);
                            setShowSearchDropdown(false);
                            setIsRegisterModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <FiUserPlus /> Register New Patient
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              
              {(selectedPatient && !isGroupMode) || (isGroupMode) ? (
                <div className="space-y-5 animate-in fade-in duration-300">
                  {!isGroupMode ? (
                    <div className="bg-red-50/40 p-4 rounded-2xl border border-red-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-extrabold text-[#C01D38] uppercase tracking-wider mb-1">Selected Patient</p>
                        <p className="font-bold text-slate-800 text-base">{selectedPatient?.first_name} {selectedPatient?.last_name}</p>
                        <p className="text-xs text-slate-500">{selectedPatient?.patient_id_number || 'No ID'} • {selectedPatient?.college_dept || selectedPatient?.profile_type}</p>
                      </div>
                      {editingAppointmentId ? null : (
                        <button 
                          onClick={() => setSelectedPatient(null)}
                          className="text-xs font-bold text-[#C01D38] bg-white px-3.5 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer"
                        >
                          Change Patient
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
                      {/* Department -> Program -> Year Level Filter Panel */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#C01D38] uppercase tracking-wider flex items-center gap-1.5">
                            <FiPlus className="text-[#C01D38]" /> Filter & Select Group: Department ➔ Program ➔ Year
                          </span>
                          <span className="text-[11px] font-semibold text-[#C01D38] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
                            3-Level Filter
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* 1. Department */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">1. Department</label>
                            <select
                              value={batchDept}
                              onChange={(e) => handleDeptChange(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all cursor-pointer"
                            >
                              {departmentsHierarchy.map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 2. Program / Course */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">2. Program / Course</label>
                            <select
                              value={batchProgram}
                              onChange={(e) => handleProgramChange(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all cursor-pointer"
                            >
                              {availablePrograms.map(p => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Year Level */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">3. Year Level</label>
                            <select
                              value={batchYear}
                              onChange={(e) => handleYearChange(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all cursor-pointer"
                            >
                              {availableYears.map(y => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleFetchBatchStudents}
                          disabled={isFetchingBatch}
                          className="w-full py-3 bg-gradient-to-r from-[#8B0E1B] via-[#A5192D] to-[#C01D38] hover:from-[#720B15] hover:to-[#A5192D] text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 active:scale-[0.99]"
                        >
                          {isFetchingBatch ? (
                            <>
                              <FiRefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Searching Database & Fetching Students...</span>
                            </>
                          ) : (
                            <>
                              <FiUsers className="w-4 h-4 text-amber-300" />
                              <FiFilter className="w-3.5 h-3.5 text-white/80" />
                              <span>Fetch All Matching Students ({batchDept} • {batchProgram} • {batchYear})</span>
                            </>
                          )}
                        </button>

                        {/* Fetched Students Checklist Section */}
                        {fetchedBatchPatients.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-2 px-1">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={fetchedBatchPatients.every(p => checkedBatchPatientIds[p.id])}
                                  onChange={(e) => handleToggleSelectAllBatch(e.target.checked)}
                                  className="w-4 h-4 text-[#C01D38] rounded border-slate-300 focus:ring-[#C01D38]"
                                />
                                <span className="text-xs font-bold text-slate-700">
                                  Select All ({fetchedBatchPatients.filter(p => checkedBatchPatientIds[p.id]).length} of {fetchedBatchPatients.length} Selected)
                                </span>
                              </label>
                              <span className="text-[11px] text-slate-500 font-medium italic">Uncheck any student to exclude</span>
                            </div>

                            {/* Scrollable Checklist */}
                            <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                              {fetchedBatchPatients.map(student => {
                                const isChecked = !!checkedBatchPatientIds[student.id];
                                return (
                                  <label
                                    key={student.id}
                                    className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-white border-red-200 shadow-2xs text-slate-800'
                                        : 'bg-slate-100/60 border-slate-200 text-slate-400 line-through'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleTogglePatientCheck(student.id)}
                                        className="w-4 h-4 text-[#C01D38] rounded border-slate-300 focus:ring-[#C01D38] cursor-pointer"
                                      />
                                      <div>
                                        <div className="font-semibold text-xs text-slate-800">{student.first_name} {student.last_name}</div>
                                        <div className="text-[11px] text-slate-500">{student.patient_id_number || 'No ID'} • {student.college_dept || student.profile_type} ({student.year_level || 'N/A'})</div>
                                      </div>
                                    </div>

                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isChecked ? 'bg-red-100 text-[#C01D38]' : 'bg-slate-200 text-slate-500'}`}>
                                      {isChecked ? 'Selected' : 'Excluded'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={handleAddCheckedStudentsToRoster}
                              className="w-full mt-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <FiUserPlus />
                              + Add {fetchedBatchPatients.filter(p => checkedBatchPatientIds[p.id]).length} Checked Students to Group Roster
                            </button>
                          </div>
                        )}

                        {/* No Students Found Feedback Notice */}
                        {hasFetchedBatch && fetchedBatchPatients.length === 0 && !isFetchingBatch && (
                          <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 text-xs flex items-center gap-3 animate-in fade-in duration-300 shadow-xs">
                            <FiAlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                              <p className="font-bold text-amber-800">No matching patients found</p>
                              <p className="text-amber-700 text-[11px] mt-0.5">
                                No registered students or patients found for <span className="font-semibold">{batchDept} • {batchProgram} • {batchYear}</span>. Please verify patient records or adjust your filter parameters.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Group Appointment Name *</label>
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all bg-white"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="e.g. CCIS BSIT 1st Year Appointment"
                        />
                      </div>
                      <div className="flex justify-between items-center mb-2 pt-3 border-t border-slate-200">
                        <p className="text-xs font-extrabold text-[#C01D38] uppercase tracking-wider">Group Roster ({selectedGroupPatients.length})</p>
                        {selectedGroupPatients.length > 0 && (
                          <button onClick={() => setSelectedGroupPatients([])} className="text-xs text-slate-500 hover:text-red-500 font-semibold cursor-pointer">Clear All</button>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                        {selectedGroupPatients.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3 italic">No students selected yet. Use the 3-level filter above to fetch and add students.</p>
                        ) : (
                          selectedGroupPatients.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs text-sm">
                              <div>
                                <span className="font-semibold text-slate-800">{p.first_name} {p.last_name}</span>
                                <span className="text-[11px] text-slate-400 ml-2">({p.college_dept || p.profile_type} - {p.year_level || 'N/A'})</span>
                              </div>
                              <button onClick={() => setSelectedGroupPatients(prev => prev.filter(sp => sp.id !== p.id))} className="text-red-400 hover:text-red-600 p-1 cursor-pointer">
                                <FiX />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Appointment Date *</label>
                      <input
                        type="date"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all bg-slate-50/50"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Appointment Time *</label>
                      <input
                        type="time"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all bg-slate-50/50"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        min="08:00"
                        max="17:00"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Clinical Cues / Purpose *</label>
                    <select
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all mb-3 bg-slate-50/50 cursor-pointer"
                      value={purposeType}
                      onChange={(e) => setPurposeType(e.target.value)}
                    >
                      {(cues.length > 0 ? cues : DEFAULT_CUES).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="Other">Other (specify)</option>
                    </select>
                    
                    {purposeType === 'Other' && (
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C01D38]/20 focus:border-[#C01D38] transition-all animate-in fade-in slide-in-from-top-1 bg-white"
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
                      className="w-full py-3.5 rounded-xl font-extrabold text-white bg-gradient-to-r from-[#8B0E1B] to-[#C01D38] hover:from-[#720B15] hover:to-[#A5192D] transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:shadow-none"
                    >
                      {isSubmitting ? 'Saving Appointments...' : (editingAppointmentId ? 'Save Changes' : (isGroupMode ? `Schedule ${selectedGroupPatients.length} Group Appointments` : 'Schedule Appointment'))}
                    </button>
                  </div>
                </div>
              ) : null}
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
          fetchAppointments();
        }}
        patientId={null}
      />
    </div>
  );
};

export default Appointments;
