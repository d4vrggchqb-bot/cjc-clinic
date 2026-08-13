import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiX, FiUser, FiPhone, FiActivity, FiChevronRight, FiChevronLeft, FiCheck, FiRefreshCw, FiAlertCircle, FiZap, FiDatabase, FiCloudDownload, FiCheckCircle, FiPlus } from 'react-icons/fi';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  patientId?: number | null;
  user?: any;
}

const PatientModal: React.FC<PatientModalProps> = ({ isOpen, onClose, onSave, patientId, user }) => {
  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(user || null);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    } else if (isOpen) {
      apiFetch('/api/index.php?action=check_session')
        .then(res => {
          if (res.success && res.user) {
            setCurrentUser(res.user);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, user]);

  const getAutoSelectedSubType = (u: any) => {
    if (!u || u.role === 'Superadmin' || !u.clinic_branch) {
      return 'College';
    }
    const b = u.clinic_branch.toLowerCase();
    if (b.includes('basic education') || b.includes('bed')) {
      return 'BED';
    }
    if (b.includes('post graduate') || b.includes('power')) {
      return 'Post Graduate';
    }
    return 'College';
  };

  const getAutoSelectedDept = (sub: string) => {
    if (sub === 'BED') return 'Basic Education';
    return '';
  };

  const [formData, setFormData] = useState({
    profile_type: 'student',
    patient_id_number: '',
    first_name: '',
    last_name: '',
    middle_initial: '',
    birthdate: '',
    gender: 'Male',
    sub_type: 'College',
    college_dept: 'CCIS',
    bed_dept: 'Senior High School',
    bed_year_level: 'Grade 11',
    post_graduate_school: 'Law School',
    post_graduate_program: 'Juris Doctor',
    custom_category_type: '',
    custom_category_item: '',
    course: 'BS Computer Science',
    year_level: '1st Year',
    school_year: '2026-2027',
    contact: '',
    email: '',
    address: '',
    blood_type: 'Unknown',
    allergies: '',
    medical_history: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    emergency_relation: 'Parent / Guardian'
  });
  
  // Health History specific state (Pill / Bean UI)
  const DEFAULT_HEALTH_PRESETS = [
    'Asthma',
    'Thyroid Disease',
    'Heart Disease',
    'High Blood Pressure',
    'Epilepsy / Seizures',
    'Tuberculosis',
    'History of Fainting',
    'Allergies (Food / Drug)',
    'Rheumatic Heart Disease',
    'Lung Disease',
    'Diabetes',
    'Kidney Disease'
  ];

  const [selectedHealthConditions, setSelectedHealthConditions] = useState<string[]>([]);
  const [customHealthText, setCustomHealthText] = useState<string>('');
  const [customInputVal, setCustomInputVal] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idChecking, setIdChecking] = useState(false);
  const [isIdDuplicate, setIsIdDuplicate] = useState(false);
  const [isFetchingSsc, setIsFetchingSsc] = useState(false);
  const [sscStatus, setSscStatus] = useState<string | null>(null);
  const [showSscListModal, setShowSscListModal] = useState(false);
  const [sscStudents, setSscStudents] = useState<any[]>([]);
  const [loadingSscList, setLoadingSscList] = useState(false);

  const handleOpenSscList = async () => {
    setShowSscListModal(true);
    setLoadingSscList(true);
    try {
      const res = await apiFetch('/api/index.php?route=ssc&action=list_ssc');
      if (res.students) {
        setSscStudents(res.students);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSscList(false);
    }
  };

  const handleSscLookup = async (overrideId?: string) => {
    const idNum = (overrideId || formData.patient_id_number).trim();
    if (!idNum) return;
    setIsFetchingSsc(true);
    setSscStatus(null);
    try {
      const res = await apiFetch(`/api/index.php?route=ssc&action=lookup&student_id=${encodeURIComponent(idNum)}`);
      if (res.found && res.clinic_profile) {
        const p = res.clinic_profile;
        setFormData(prev => ({
          ...prev,
          patient_id_number: p.patient_id_number || prev.patient_id_number,
          first_name: p.first_name || prev.first_name,
          last_name: p.last_name || prev.last_name,
          middle_initial: p.middle_initial || prev.middle_initial,
          birthdate: p.birthdate || prev.birthdate,
          gender: p.gender || prev.gender,
          college_dept: p.college_dept || prev.college_dept,
          course: p.course || prev.course,
          year_level: p.year_level || prev.year_level,
          contact: p.contact || prev.contact,
          email: p.email || prev.email,
          address: p.address || prev.address,
          emergency_contact_name: p.emergency_contact_name || prev.emergency_contact_name,
          emergency_contact_number: p.emergency_contact_number || prev.emergency_contact_number
        }));
        if (!p.birthdate) {
          setSscStatus(`Auto-filled student info from SSC Database for ${res.ssc_data.fullName}. (Note: Birthdate was not provided in SSC portal, please enter birthdate manually).`);
        } else {
          setSscStatus(`Auto-filled student info from SSC Database for ${res.ssc_data.fullName}`);
        }
      } else {
        setSscStatus(`Student ID not found in SSC database — please enter details manually.`);
      }
    } catch (err) {
      setSscStatus(`Unable to query SSC Database.`);
    } finally {
      setIsFetchingSsc(false);
    }
  };
  const [globalSettings, setGlobalSettings] = useState<any>({ 
    school_year: '2026-2027', 
    departments_hierarchy: [],
    bed_hierarchy: [],
    college_year_levels: [],
    post_graduate_hierarchy: [],
    custom_categories_hierarchy: [],
    health_history_presets: []
  });

  // Fetch settings once when the component mounts
  useEffect(() => {
    apiFetch('/api/index.php?route=settings&action=get')
      .then(res => {
        if (res.settings) {
          const sy = res.settings.school_year || '2026-2027';
          setGlobalSettings({
            school_year: sy,
            departments_hierarchy: Array.isArray(res.settings.departments_hierarchy) ? res.settings.departments_hierarchy : [],
            bed_hierarchy: Array.isArray(res.settings.bed_hierarchy) ? res.settings.bed_hierarchy : [],
            college_year_levels: Array.isArray(res.settings.college_year_levels) ? res.settings.college_year_levels : [],
            post_graduate_hierarchy: Array.isArray(res.settings.post_graduate_hierarchy) ? res.settings.post_graduate_hierarchy : [],
            custom_categories_hierarchy: Array.isArray(res.settings.custom_categories_hierarchy) ? res.settings.custom_categories_hierarchy : [],
            health_history_presets: Array.isArray(res.settings.health_history_presets) ? res.settings.health_history_presets : DEFAULT_HEALTH_PRESETS
          });
          // Update default form data if it's currently at the old hardcoded default
          setFormData(prev => ({
            ...prev,
            school_year: prev.school_year === '2026-2027' ? sy : prev.school_year
          }));
        }
      })
      .catch(() => console.error("Failed to fetch settings"));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError('');
      if (patientId) {
        setLoading(true);
        apiFetch(`/api/index.php?route=patients&action=get&id=${patientId}`)
          .then(res => {
            if (res.profile) {
              setFormData({ ...formData, ...res.profile });
              // Parse health_history if it is JSON
              if (res.profile.health_history) {
                try {
                  const parsed = JSON.parse(res.profile.health_history);
                  if (typeof parsed === 'object' && parsed !== null) {
                    if (Array.isArray(parsed.conditions)) {
                      setSelectedHealthConditions(parsed.conditions);
                    } else {
                      const legacyLabels: Record<string, string> = {
                        Asthma: 'Asthma',
                        ThyroidDisease: 'Thyroid Disease',
                        HeartDisease: 'Heart Disease',
                        HighBloodPressure: 'High Blood Pressure',
                        EpilepsySeizures: 'Epilepsy / Seizures',
                        Tuberculosis: 'Tuberculosis',
                        HistoryOfFainting: 'History of Fainting',
                        Allergies: 'Allergies (Food / Drug)',
                        RheumaticHeartDisease: 'Rheumatic Heart Disease',
                        LungDisease: 'Lung Disease'
                      };
                      const converted: string[] = [];
                      Object.entries(parsed).forEach(([k, v]) => {
                        if (v === true && legacyLabels[k]) {
                          converted.push(legacyLabels[k]);
                        }
                      });
                      setSelectedHealthConditions(converted);
                    }
                    setCustomHealthText(parsed.OthersText || parsed.others || '');
                  }
                } catch (e) {
                  setCustomHealthText(res.profile.health_history);
                  setSelectedHealthConditions([]);
                }
              }
            }
          })
          .catch(() => setError('Failed to load patient data'))
          .finally(() => setLoading(false));
      } else {
        // Reset form & auto-select Student Category based on admin branch
        const defaultSub = getAutoSelectedSubType(currentUser);
        const defaultDept = getAutoSelectedDept(defaultSub);

        setFormData({
          profile_type: 'student',
          patient_id_number: '',
          school_year: globalSettings.school_year || '2026-2027',
          first_name: '',
          last_name: '',
          middle_initial: '',
          birthdate: '',
          gender: '',
          blood_type: '',
          sub_type: defaultSub,
          college_dept: defaultDept,
          year_level: '',
          course: '',
          contact: '',
          email: '',
          address: '',
          emergency_contact_name: '',
          emergency_contact_number: '',
          emergency_relation: '',
          health_history: '',
          vital_stats: '',
          height: '',
          weight: '',
          mother_name: '',
          father_name: ''
        });
        setSelectedHealthConditions([]);
        setCustomHealthText('');
        setCustomInputVal('');
      }
    }
  }, [isOpen, patientId, currentUser]);

  // Real-time check for duplicate ID
  useEffect(() => {
    if (patientId || !isOpen) {
      setIsIdDuplicate(false);
      return;
    }

    const checkId = async () => {
      const idNum = formData.patient_id_number.trim();
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
  }, [formData.patient_id_number, patientId, isOpen]);

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: boolean }>({});

  const validateCurrentStep = (currentStep: number): boolean => {
    const errors: { [key: string]: boolean } = {};
    let isValid = true;
    setError('');

    if (currentStep === 1) {
      if (!formData.patient_id_number.trim()) {
        errors['patient_id_number'] = true;
        isValid = false;
      }
      if (isIdDuplicate) {
        errors['patient_id_number'] = true;
        isValid = false;
        setError('The entered Patient ID is already registered in the system.');
        setValidationErrors(errors);
        return false;
      }
      if (!formData.first_name.trim()) {
        errors['first_name'] = true;
        isValid = false;
      }
      if (!formData.last_name.trim()) {
        errors['last_name'] = true;
        isValid = false;
      }
      if (!formData.birthdate.trim()) {
        errors['birthdate'] = true;
        isValid = false;
      }
      if (!formData.gender.trim() || formData.gender === 'Select Gender') {
        errors['gender'] = true;
        isValid = false;
      }

      if (formData.profile_type === 'student') {
        const sub = formData.sub_type;
        if (sub === 'College') {
          if (!formData.college_dept || formData.college_dept === 'Select Department') {
            errors['college_dept'] = true;
            isValid = false;
          }
          if (!formData.course || formData.course === 'Select Course/Program') {
            errors['course'] = true;
            isValid = false;
          }
          if (!formData.year_level || formData.year_level === 'Select Year Level') {
            errors['year_level'] = true;
            isValid = false;
          }
        } else if (sub === 'BED') {
          if (!formData.course || formData.course === 'Select Program') {
            errors['course'] = true;
            isValid = false;
          }
          if (!formData.year_level || formData.year_level === 'Select Year Level') {
            errors['year_level'] = true;
            isValid = false;
          }
        } else if (sub === 'Post Graduate') {
          if (!formData.college_dept || formData.college_dept === 'Select School') {
            errors['college_dept'] = true;
            isValid = false;
          }
          if (!formData.course || formData.course === 'Select Program') {
            errors['course'] = true;
            isValid = false;
          }
        } else {
          if (!formData.course || formData.course === 'Select Option') {
            errors['course'] = true;
            isValid = false;
          }
        }
      } else if (formData.profile_type === 'employee') {
        if (!formData.college_dept || formData.college_dept === 'Select Department') {
          errors['college_dept'] = true;
          isValid = false;
        }
      }
    } else if (currentStep === 2) {
      if (!formData.contact || !formData.contact.trim()) {
        errors['contact'] = true;
        isValid = false;
      }
      if (!formData.emergency_contact_name || !formData.emergency_contact_name.trim()) {
        errors['emergency_contact_name'] = true;
        isValid = false;
      }
      if (!formData.emergency_contact_number || !formData.emergency_contact_number.trim()) {
        errors['emergency_contact_number'] = true;
        isValid = false;
      }
    }

    setValidationErrors(errors);

    if (!isValid && !error) {
      setError('Please complete all required fields marked with * (such as Department, Program, Birthdate, etc.) before proceeding.');
    }

    return isValid;
  };

  const getInputErrorClass = (fieldName: string) => {
    return validationErrors[fieldName]
      ? ' border-red-500 ring-2 ring-red-200 bg-red-50/40 text-red-900 focus:border-red-600 focus:ring-red-300 '
      : '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleRadioChange = (name: string, value: string) => {
    if (name === 'sub_type') {
      const autoDept = value === 'BED' ? 'Basic Education' : '';
      setFormData(prev => ({ ...prev, sub_type: value, college_dept: autoDept, course: '', year_level: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleHealthCheck = (key: string) => {
    setHealthHistoryObj((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleHealthText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHealthHistoryObj((prev: any) => ({ ...prev, OthersText: e.target.value }));
  };

  const calculateAge = (dob: string) => {
    if (!dob) return '--';
    const diff_ms = Date.now() - new Date(dob).getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step < 3) {
      if (!validateCurrentStep(step)) {
        return;
      }
      setError('');
      setStep(step + 1);
      return;
    }

    if (!validateCurrentStep(1)) {
      setStep(1);
      return;
    }
    
    setLoading(true);
    setError('');

    const action = patientId ? 'update' : 'create';
    
    // Convert health history selected conditions to stringified JSON
    const payload: any = { 
      ...formData, 
      health_history: JSON.stringify({
        conditions: selectedHealthConditions,
        OthersText: customHealthText
      })
    };
    if (patientId) {
      payload.id = patientId;
    }

    try {
      const res = await apiFetch(`/api/index.php?route=patients&action=${action}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (res.success) {
        onSave();
        onClose();
      } else {
        setError(res.error || 'Failed to save patient');
      }
    } catch (err) {
      setError('An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  // Computed Arrays based on Hierarchy (100% Null Safe)
  const collegeDepartments = Array.isArray(globalSettings?.departments_hierarchy) 
    ? globalSettings.departments_hierarchy.map((d: any) => d?.department).filter(Boolean) 
    : [];
  const employeeDepartments = Array.isArray(globalSettings?.employee_departments)
    ? globalSettings.employee_departments
    : [];
  const selectedCollegeDept = Array.isArray(globalSettings?.departments_hierarchy) 
    ? globalSettings.departments_hierarchy.find((d: any) => d?.department === formData.college_dept) 
    : null;
  const collegePrograms = Array.isArray(selectedCollegeDept?.programs) ? selectedCollegeDept.programs : [];
  
  const bedPrograms = Array.isArray(globalSettings?.bed_hierarchy) 
    ? globalSettings.bed_hierarchy.map((b: any) => b?.program).filter(Boolean) 
    : [];
  const selectedBedProgram = Array.isArray(globalSettings?.bed_hierarchy) 
    ? globalSettings.bed_hierarchy.find((b: any) => b?.program === formData.course) 
    : null;
  const bedYearLevels = Array.isArray(selectedBedProgram?.year_levels) ? selectedBedProgram.year_levels : [];

  const postGradSchools = Array.isArray(globalSettings?.post_graduate_hierarchy) 
    ? globalSettings.post_graduate_hierarchy.map((s: any) => s?.school).filter(Boolean) 
    : [];
  const selectedPostGradSchool = Array.isArray(globalSettings?.post_graduate_hierarchy) 
    ? globalSettings.post_graduate_hierarchy.find((s: any) => s?.school === formData.college_dept) 
    : null;
  const postGradPrograms = Array.isArray(selectedPostGradSchool?.programs) ? selectedPostGradSchool.programs : [];

  const customCategory = Array.isArray(globalSettings?.custom_categories_hierarchy) 
    ? globalSettings.custom_categories_hierarchy.find((c: any) => c?.category === formData.sub_type) 
    : null;
  const customPrograms = Array.isArray(customCategory?.programs) ? customCategory.programs : [];

  const collegeYearLevels = Array.isArray(globalSettings?.college_year_levels) ? globalSettings.college_year_levels : ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

  if (!isOpen) return null;

  // Input wrapper classes for a cleaner look
  const inputClass = "w-full px-3.5 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:bg-white focus:border-[#C01D38] focus:ring-2 focus:ring-[#C01D38]/20 transition-all outline-none";
  const labelClass = "block text-sm font-medium text-slate-600 mb-1.5 ml-0.5";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-6 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        
        {/* Sleek Gradient Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#8B0E1B] to-[#C01D38] px-5 py-4 sm:px-6 sm:py-5 flex justify-between items-start sm:items-center gap-4 text-white shrink-0">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex flex-col flex-1 pr-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {patientId ? 'Edit Patient Profile' : 'Register New Patient'}
            </h2>
            <p className="text-white/90 text-xs sm:text-sm mt-1 font-normal leading-normal">Complete the form below to save patient details</p>
          </div>
          <button 
            onClick={onClose} 
            className="relative z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 sm:p-2.5 rounded-full transition-all hover:rotate-90 duration-300 shrink-0"
            aria-label="Close modal"
          >
            <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modern Stepper Indicator */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/30 shrink-0">
          <div className="flex items-center justify-center max-w-2xl mx-auto">
            {/* Step 1 */}
            <div className="flex flex-col items-center relative">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm z-10 ${step >= 1 ? 'bg-[#C01D38] border-[#C01D38] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                {step > 1 ? <FiCheck className="w-4 h-4" /> : <FiUser className="w-4 h-4" />}
              </div>
              <div className={`absolute mt-9 text-xs font-medium transition-colors duration-300 hidden sm:block ${step >= 1 ? 'text-[#C01D38]' : 'text-slate-400'}`}>Personal</div>
            </div>
            
            <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-500 ${step >= 2 ? 'bg-[#C01D38]' : 'bg-slate-200'}`}></div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center relative">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm z-10 ${step >= 2 ? 'bg-[#C01D38] border-[#C01D38] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                {step > 2 ? <FiCheck className="w-4 h-4" /> : <FiPhone className="w-4 h-4" />}
              </div>
              <div className={`absolute mt-9 text-xs font-medium transition-colors duration-300 hidden sm:block ${step >= 2 ? 'text-[#C01D38]' : 'text-slate-400'}`}>Contact</div>
            </div>

            <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-500 ${step >= 3 ? 'bg-[#C01D38]' : 'bg-slate-200'}`}></div>
            
            {/* Step 3 */}
            <div className="flex flex-col items-center relative">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm z-10 ${step >= 3 ? 'bg-[#C01D38] border-[#C01D38] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                <FiActivity className="w-4 h-4" />
              </div>
              <div className={`absolute mt-9 text-xs font-medium transition-colors duration-300 hidden sm:block ${step >= 3 ? 'text-[#C01D38]' : 'text-slate-400'}`}>Medical</div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="px-6 py-4 bg-white overflow-y-auto flex-1 relative">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              {error}
            </div>
          )}

          <form id="patient-form" onSubmit={handleSubmit} className="relative min-h-[260px]">
            
            {/* STEP 1: Personal Info */}
            <div className={`transition-all duration-500 ease-in-out absolute inset-0 ${step === 1 ? 'opacity-100 translate-x-0 pointer-events-auto relative' : 'opacity-0 -translate-x-8 pointer-events-none'}`}>
              
              <div className="bg-slate-100/80 p-1.5 rounded-xl inline-flex flex-wrap sm:flex-nowrap gap-1 mb-5 border border-slate-200/60">
                <button type="button" onClick={() => handleRadioChange('profile_type', 'student')} className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200 whitespace-nowrap shadow-sm text-center ${formData.profile_type === 'student' ? 'bg-white text-[#C01D38] shadow border border-slate-200/60' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 shadow-none border-transparent'}`}>Student <span className="hidden sm:inline">Profile</span></button>
                <button type="button" onClick={() => handleRadioChange('profile_type', 'employee')} className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200 whitespace-nowrap shadow-sm text-center ${formData.profile_type === 'employee' ? 'bg-white text-[#C01D38] shadow border border-slate-200/60' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 shadow-none border-transparent'}`}>Employee <span className="hidden sm:inline">Profile</span></button>
                <button type="button" onClick={() => {
                  handleRadioChange('profile_type', 'guest');
                  if (!patientId && (!formData.patient_id_number || formData.patient_id_number.startsWith('GST-'))) {
                    apiFetch('/api/index.php?route=patients&action=next_guest_id')
                      .then(res => {
                        if (res.guest_id) setFormData(prev => ({ ...prev, profile_type: 'guest', patient_id_number: res.guest_id }));
                      })
                      .catch(() => {});
                  }
                }} className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200 whitespace-nowrap shadow-sm text-center ${formData.profile_type === 'guest' ? 'bg-white text-[#C01D38] shadow border border-slate-200/60' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 shadow-none border-transparent'}`}>Guest <span className="hidden sm:inline">Visitor</span></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className={labelClass}>Patient ID (Student / Employee ID) <span className="text-red-500">*</span></label>
                    {formData.profile_type === 'student' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSscList()}
                          className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <FiDatabase className="w-3 h-3 text-slate-500" />
                          <span>SSC Directory</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSscLookup()}
                          disabled={isFetchingSsc || !formData.patient_id_number.trim()}
                          className="text-xs font-extrabold text-[#C01D38] hover:text-white hover:bg-[#A5192D] bg-red-50/80 border border-red-200/80 px-3 py-1 rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          {isFetchingSsc && <FiRefreshCw className="animate-spin w-3.5 h-3.5 text-[#C01D38]" />}
                          <span>Fetch from SSC DB</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input type="text" name="patient_id_number" value={formData.patient_id_number} onChange={handleChange} required className={`${inputClass} ${isIdDuplicate ? 'border-red-500 focus:border-red-600 bg-red-50 text-red-700' : ''} ${getInputErrorClass('patient_id_number')}`} placeholder="e.g. 2022-0027-8 or 2021-0492" />
                    {idChecking && <FiRefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                    {isIdDuplicate && !idChecking && <FiAlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
                  </div>
                  {sscStatus && (
                    <div className={`mt-1.5 text-xs font-bold px-3 py-2 rounded-xl border flex items-center gap-2 shadow-2xs ${!sscStatus.includes('not found') && !sscStatus.includes('Unable') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'}`}>
                      {!sscStatus.includes('not found') && !sscStatus.includes('Unable') ? (
                        <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FiAlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{sscStatus}</span>
                    </div>
                  )}
                  {isIdDuplicate && !idChecking && <span className="text-red-500 text-[10px] font-bold block mt-1 ml-1">This ID is already registered.</span>}
                </div>
                <div>
                  <label className={labelClass}>School Year</label>
                  <input type="text" name="school_year" value={formData.school_year} disabled className={`${inputClass} bg-slate-100 text-slate-500 cursor-not-allowed`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                <div className="md:col-span-5">
                  <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required className={`${inputClass} ${getInputErrorClass('first_name')}`} placeholder="Juan" />
                </div>
                <div className="md:col-span-5">
                  <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required className={`${inputClass} ${getInputErrorClass('last_name')}`} placeholder="Dela Cruz" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>M.I.</label>
                  <input type="text" name="middle_initial" value={formData.middle_initial} onChange={handleChange} className={inputClass} placeholder="M." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Birthdate <span className="text-red-500">*</span></label>
                  <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} required className={`${inputClass} ${getInputErrorClass('birthdate')}`} />
                </div>
                <div>
                  <label className={labelClass}>Age</label>
                  <div className="w-full px-3.5 py-2 bg-slate-100/50 border border-slate-200 rounded-lg text-sm text-slate-400 font-medium cursor-not-allowed flex items-center h-[38px]">
                    {calculateAge(formData.birthdate)} yrs
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Gender <span className="text-red-500">*</span></label>
                  <select name="gender" value={formData.gender} onChange={handleChange} required className={`${inputClass} ${getInputErrorClass('gender')}`}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Blood Type</label>
                  <select name="blood_type" value={formData.blood_type} onChange={handleChange} className={inputClass}>
                    <option value="">Unknown</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Height (cm)</label>
                  <input type="text" name="height" value={formData.height} onChange={handleChange} className={inputClass} placeholder="e.g. 165" />
                </div>
                <div>
                  <label className={labelClass}>Weight (kg)</label>
                  <input type="text" name="weight" value={formData.weight} onChange={handleChange} className={inputClass} placeholder="e.g. 60" />
                </div>
              </div>

              {/* Dynamic Type Section */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 relative overflow-hidden group hover:border-[#C01D38]/30 transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C01D38]/20 group-hover:bg-[#C01D38] transition-colors"></div>
                
                {formData.profile_type === 'student' && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 pl-2">
                      <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Student Category:</label>
                      <select 
                        name="sub_type" 
                        value={formData.sub_type} 
                        onChange={(e) => handleRadioChange('sub_type', e.target.value)}
                        className={inputClass + " md:w-64"}
                      >
                        {globalSettings.departments_hierarchy?.length > 0 && <option value="College">College</option>}
                        {globalSettings.bed_hierarchy?.length > 0 && <option value="BED">BED (Basic Ed)</option>}
                        {globalSettings.post_graduate_hierarchy?.length > 0 && <option value="Post Graduate">Post Graduate</option>}
                        {globalSettings.custom_categories_hierarchy?.map((cat: any, idx: number) => (
                          <option key={`custom-${idx}`} value={cat.category}>{cat.category}</option>
                        ))}
                        {(!globalSettings.departments_hierarchy?.length && !globalSettings.bed_hierarchy?.length && !globalSettings.post_graduate_hierarchy?.length && !globalSettings.custom_categories_hierarchy?.length) && (
                          <>
                            <option value="College">College</option>
                            <option value="BED">BED (Basic Ed)</option>
                            <option value="Post Graduate">Post Graduate</option>
                          </>
                        )}
                      </select>

                      {currentUser && currentUser.role !== 'Superadmin' && currentUser.clinic_branch && (
                        <span className="text-[11px] font-bold text-[#C01D38] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 mt-2 md:mt-0">
                          Default for {currentUser.clinic_branch}
                        </span>
                      )}
                    </div>
                    {formData.sub_type === 'College' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={labelClass}>College / Dept <span className="text-red-500">*</span></label>
                          <select name="college_dept" value={formData.college_dept} onChange={(e) => setFormData({...formData, college_dept: e.target.value, course: ''})} className={`${inputClass} ${getInputErrorClass('college_dept')}`}>
                            <option value="">Select Department</option>
                            {collegeDepartments.map((dept: string, idx: number) => (
                              <option key={idx} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Course/Program <span className="text-red-500">*</span></label>
                          <select name="course" value={formData.course} onChange={handleChange} className={`${inputClass} ${getInputErrorClass('course')}`} disabled={!formData.college_dept}>
                            <option value="">Select Course/Program</option>
                            {collegePrograms.map((course: string, idx: number) => (
                              <option key={idx} value={course}>{course}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Year Level <span className="text-red-500">*</span></label>
                          <select name="year_level" value={formData.year_level} onChange={handleChange} className={`${inputClass} ${getInputErrorClass('year_level')}`}>
                            <option value="">Select Year</option>
                            {collegeYearLevels.map((yr: string, idx: number) => (
                              <option key={idx} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : formData.sub_type === 'BED' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={labelClass}>Department <span className="text-red-500">*</span></label>
                          <input type="text" value="Basic Education" readOnly className={`${inputClass} bg-slate-100 text-slate-500 cursor-not-allowed`} />
                        </div>
                        <div>
                          <label className={labelClass}>Program <span className="text-red-500">*</span></label>
                          <select name="course" value={formData.course} onChange={(e) => setFormData({...formData, course: e.target.value, year_level: ''})} className={inputClass}>
                            <option value="">Select Program</option>
                            {bedPrograms.map((prog: string, idx: number) => (
                              <option key={idx} value={prog}>{prog}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Year Level <span className="text-red-500">*</span></label>
                          <select name="year_level" value={formData.year_level} onChange={handleChange} className={inputClass} disabled={!formData.course}>
                            <option value="">Select Year Level</option>
                            {bedYearLevels.map((yr: string, idx: number) => (
                              <option key={idx} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : formData.sub_type === 'Post Graduate' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={labelClass}>School <span className="text-red-500">*</span></label>
                          <select name="college_dept" value={formData.college_dept} onChange={(e) => setFormData({...formData, college_dept: e.target.value, course: ''})} className={inputClass}>
                            <option value="">Select School</option>
                            {postGradSchools.map((school: string, idx: number) => (
                              <option key={idx} value={school}>{school}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Program <span className="text-red-500">*</span></label>
                          <select name="course" value={formData.course} onChange={handleChange} className={inputClass} disabled={!formData.college_dept}>
                            <option value="">Select Program</option>
                            {postGradPrograms.map((prog: string, idx: number) => (
                              <option key={idx} value={prog}>{prog}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Year Level <span className="text-red-500">*</span></label>
                          <select name="year_level" value={formData.year_level} onChange={handleChange} className={inputClass}>
                            <option value="">Select Year</option>
                            {collegeYearLevels.map((yr: string, idx: number) => (
                              <option key={idx} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : customCategory ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Department/Program <span className="text-red-500">*</span></label>
                          <select name="course" value={formData.course} onChange={handleChange} className={inputClass}>
                            <option value="">Select Option</option>
                            {customPrograms.map((prog: string, idx: number) => (
                              <option key={idx} value={prog}>{prog}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Year Level (Optional)</label>
                          <select name="year_level" value={formData.year_level} onChange={handleChange} className={inputClass}>
                            <option value="">Select Year (If applicable)</option>
                            {collegeYearLevels.map((yr: string, idx: number) => (
                              <option key={idx} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {formData.profile_type === 'employee' && (
                  <div className="animate-in fade-in duration-300">
                    <div>
                      <label className={labelClass}>Department / Office <span className="text-red-500">*</span></label>
                      <select name="college_dept" value={formData.college_dept} onChange={handleChange} className={inputClass}>
                        <option value="">Select Department</option>
                        {employeeDepartments.map((dept: string, idx: number) => (
                          <option key={idx} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: Contact & Emergency */}
            <div className={`transition-all duration-500 ease-in-out absolute inset-0 ${step === 2 ? 'opacity-100 translate-x-0 pointer-events-auto relative' : 'opacity-0 translate-x-8 pointer-events-none hidden'}`}>
              
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><FiPhone className="w-3.5 h-3.5" /></span>
                Personal Contact
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Phone / Contact # <span className="text-red-500">*</span></label>
                  <input type="text" name="contact" value={formData.contact} onChange={handleChange} className={inputClass} placeholder="09XX XXX XXXX" />
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="student@cjc.edu.ph" />
                </div>
              </div>
              <div className="mb-5">
                <label className={labelClass}>Home Address</label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass} placeholder="House #, Street, Barangay, City, Province" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Mother's Name</label>
                  <input type="text" name="mother_name" value={formData.mother_name} onChange={handleChange} className={inputClass} placeholder="Full Name" />
                </div>
                <div>
                  <label className={labelClass}>Father's Name</label>
                  <input type="text" name="father_name" value={formData.father_name} onChange={handleChange} className={inputClass} placeholder="Full Name" />
                </div>
              </div>

              <div className="bg-red-50/50 border border-red-100 rounded-xl p-5 mt-5">
                <h3 className="text-sm font-semibold text-red-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  In Case of Emergency
                </h3>
                
                <div className="mb-4">
                  <label className={labelClass}>Contact Person Name <span className="text-red-500">*</span></label>
                  <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} className={inputClass} placeholder="Full Name" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Emergency Contact # <span className="text-red-500">*</span></label>
                    <input type="text" name="emergency_contact_number" value={formData.emergency_contact_number} onChange={handleChange} className={inputClass} placeholder="09XX XXX XXXX" />
                  </div>
                  <div>
                    <label className={labelClass}>Relationship</label>
                    <input type="text" name="emergency_relation" value={formData.emergency_relation} onChange={handleChange} className={inputClass} placeholder="e.g. Mother, Father, Spouse" />
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3: Medical History */}
            <div className={`transition-all duration-500 ease-in-out absolute inset-0 ${step === 3 ? 'opacity-100 translate-x-0 pointer-events-auto relative' : 'opacity-0 translate-x-8 pointer-events-none hidden'}`}>
              
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 h-full flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Health History & Allergies</label>
                  <p className="text-xs text-blue-700/70 mb-3 font-medium">Select health conditions or allergies from configured presets or enter custom entries below.</p>

                  {/* Selected Conditions Pills / Bean Chips UI */}
                  <div className="mb-3.5 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs min-h-[52px] flex flex-wrap items-center gap-2">
                    {selectedHealthConditions.length === 0 ? (
                      <span className="text-xs text-slate-400 italic font-medium px-1">
                        No health conditions selected yet. Choose from dropdown or type custom entry below.
                      </span>
                    ) : (
                      selectedHealthConditions.map((cond, idx) => (
                        <span 
                          key={idx} 
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-full text-xs font-semibold shadow-xs border border-slate-700 transition-all hover:bg-slate-900 animate-in zoom-in-95"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                          <span>{cond}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedHealthConditions(selectedHealthConditions.filter(c => c !== cond))}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full w-4 h-4 flex items-center justify-center text-xs transition-colors cursor-pointer ml-0.5"
                            title="Remove condition"
                          >
                            <FiX className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Dropdown & Custom Input Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Select from Presets:</label>
                      <select 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !selectedHealthConditions.includes(val)) {
                            setSelectedHealthConditions([...selectedHealthConditions, val]);
                          }
                          e.target.value = '';
                        }}
                        className={inputClass + " bg-white font-medium cursor-pointer"}
                      >
                        <option value="">➕ Choose Condition / Allergy...</option>
                        {(globalSettings.health_history_presets || DEFAULT_HEALTH_PRESETS)
                          .filter((p: string) => !selectedHealthConditions.includes(p))
                          .map((preset: string, idx: number) => (
                            <option key={idx} value={preset}>{preset}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Or Add Custom Condition:</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={customInputVal}
                          onChange={(e) => setCustomInputVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (customInputVal.trim() && !selectedHealthConditions.includes(customInputVal.trim())) {
                                setSelectedHealthConditions([...selectedHealthConditions, customInputVal.trim()]);
                                setCustomInputVal('');
                              }
                            }
                          }}
                          placeholder="Type custom condition..."
                          className={inputClass + " bg-white"}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customInputVal.trim() && !selectedHealthConditions.includes(customInputVal.trim())) {
                              setSelectedHealthConditions([...selectedHealthConditions, customInputVal.trim()]);
                              setCustomInputVal('');
                            }
                          }}
                          disabled={!customInputVal.trim()}
                          className="px-3 py-2 bg-[#C01D38] hover:bg-[#8c1526] text-white text-xs font-bold rounded-lg transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                        >
                          <FiPlus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Additional Health Notes / Remarks</label>
                    <input 
                      type="text" 
                      value={customHealthText} 
                      onChange={(e) => setCustomHealthText(e.target.value)} 
                      className={inputClass + " bg-white"} 
                      placeholder="Specify extra details or medication history here..." 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Initial Vital Statistics / Notes</label>
                  <p className="text-xs text-blue-700/70 mb-3 font-medium">Record baseline physical condition or visible disabilities.</p>
                  <textarea 
                    name="vital_stats" 
                    value={formData.vital_stats} 
                    onChange={handleChange}
                    rows={4}
                    className={`${inputClass} bg-white shadow-sm resize-none`}
                    placeholder="e.g. Height: 165cm, Weight: 60kg, typical BP: 120/80..."
                  ></textarea>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-2 rounded-b-3xl shrink-0">
          <div className="flex space-x-1.5 sm:space-x-2 ml-1 sm:ml-2 shrink-0">
            {[1, 2, 3].map((dot) => (
              <div key={dot} className={`w-2 h-2 rounded-full transition-all duration-300 ${step === dot ? 'bg-[#C01D38] w-5 sm:w-6' : 'bg-slate-300'}`} />
            ))}
          </div>
          
          <div className="flex gap-2 sm:gap-3 items-center shrink-0">
            {step > 1 ? (
              <button 
                type="button" 
                onClick={() => setStep(step - 1)}
                className="px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FiChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back
              </button>
            ) : (
              <button 
                type="button" 
                onClick={onClose}
                className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
            )}
            
            <button 
              type="submit" 
              form="patient-form"
              disabled={loading || isIdDuplicate}
              className="px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#C01D38] to-[#9B101E] hover:from-[#A0182E] hover:to-[#7A0D18] shadow-sm hover:shadow-md rounded-xl transition-all duration-200 disabled:opacity-50 disabled:hover:shadow-sm flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0"
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </div>
              ) : step < 3 ? (
                <>Next Step <FiChevronRight className="w-3.5 h-3.5 shrink-0" /></>
              ) : (
                <>Save Patient <FiCheck className="w-3.5 h-3.5 shrink-0" /></>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* SSC Student Database Directory Modal */}
      {showSscListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <FiDatabase className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg">SSC Student Database Directory</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSscListModal(false)}
                className="text-slate-400 hover:text-white font-bold text-xl p-1 rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Click <strong>"Select & Auto-fill"</strong> on any student profile to auto-populate their info into the registration form.
              </p>

              {loadingSscList ? (
                <div className="py-12 text-center text-slate-400 text-sm font-semibold flex items-center justify-center gap-2">
                  <FiRefreshCw className="animate-spin" /> Loading SSC Database records...
                </div>
              ) : sscStudents.length > 0 ? (
                <div className="space-y-3">
                  {sscStudents.map((st, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded-md">
                            {st.studentId}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">{st.fullName}</span>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{st.yearLevel}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Dept: <strong className="text-slate-700">{st.department || 'CCIS'}</strong></span>
                          <span>Program: <strong className="text-slate-700">{st.program || 'BS Computer Science'}</strong></span>
                          <span>DOB: <strong className="text-slate-700">{st.dateOfBirth || 'Not in SSC (fill manually)'}</strong></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSscListModal(false);
                          handleSscLookup(st.studentId);
                        }}
                        className="bg-[#C01D38] hover:bg-[#8c1526] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        Select & Auto-fill
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">No student records found in the database.</div>
              )}
            </div>

            <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-end">
              <button 
                type="button" 
                onClick={() => setShowSscListModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientModal;
