import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiX, FiUser, FiPhone, FiActivity, FiChevronRight, FiChevronLeft, FiCheck, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  patientId?: number | null;
}

const PatientModal: React.FC<PatientModalProps> = ({ isOpen, onClose, onSave, patientId }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    profile_type: 'student',
    patient_id_number: '',
    school_year: '2026-2027',
    first_name: '',
    last_name: '',
    middle_initial: '',
    birthdate: '',
    gender: '',
    blood_type: '',
    sub_type: 'College',
    college_dept: '',
    year_level: '',
    course: '',
    contact: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    emergency_relation: '',
    health_history: '',
    vital_stats: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idChecking, setIdChecking] = useState(false);
  const [isIdDuplicate, setIsIdDuplicate] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ 
    school_year: '2026-2027', 
    departments: [], 
    courses: [],
    bed_departments: [],
    bed_programs: [],
    bed_year_levels: []
  });

  // Fetch settings once when the component mounts
  useEffect(() => {
    apiFetch('/api/index.php?route=settings&action=get')
      .then(res => {
        if (res.settings) {
          const sy = res.settings.school_year || '2026-2027';
          setGlobalSettings({
            school_year: sy,
            departments: Array.isArray(res.settings.departments) ? res.settings.departments : [],
            courses: Array.isArray(res.settings.courses) ? res.settings.courses : [],
            bed_departments: Array.isArray(res.settings.bed_departments) ? res.settings.bed_departments : [],
            bed_programs: Array.isArray(res.settings.bed_programs) ? res.settings.bed_programs : [],
            bed_year_levels: Array.isArray(res.settings.bed_year_levels) ? res.settings.bed_year_levels : []
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
            }
          })
          .catch(() => setError('Failed to load patient data'))
          .finally(() => setLoading(false));
      } else {
        // Reset form
        setFormData({
          profile_type: 'student',
          patient_id_number: '',
          school_year: globalSettings.school_year,
          first_name: '',
          last_name: '',
          middle_initial: '',
          birthdate: '',
          gender: '',
          blood_type: '',
          sub_type: 'College',
          college_dept: '',
          year_level: '',
          course: '',
          contact: '',
          email: '',
          address: '',
          emergency_contact_name: '',
          emergency_contact_number: '',
          emergency_relation: '',
          health_history: '',
          vital_stats: ''
        });
      }
    }
  }, [isOpen, patientId]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRadioChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
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
      setStep(step + 1);
      return;
    }
    
    setLoading(true);
    setError('');

    const action = patientId ? 'update' : 'create';
    const payload = patientId ? { ...formData, id: patientId } : formData;

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

  if (!isOpen) return null;

  // Input wrapper classes for a cleaner look
  const inputClass = "w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-[#C01D38] focus:ring-4 focus:ring-[#C01D38]/10 transition-all outline-none";
  const labelClass = "block text-[11px] font-semibold text-slate-600 mb-1 ml-1 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-6 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        
        {/* Sleek Gradient Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#8B0E1B] to-[#C01D38] px-6 py-3.5 flex justify-between items-center text-white">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex flex-col">
            <h2 className="text-xl font-extrabold tracking-wide">
              {patientId ? 'Edit Patient Profile' : 'Register New Patient'}
            </h2>
            <p className="text-white/70 text-[11px] mt-0.5 font-medium">Complete the form below to save patient details</p>
          </div>
          <button 
            onClick={onClose} 
            className="relative z-10 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 p-1.5 rounded-full transition-all hover:rotate-90 duration-300"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modern Stepper Indicator */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center justify-center max-w-2xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm ${step >= 1 ? 'bg-[#C01D38] border-[#C01D38] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                {step > 1 ? <FiCheck className="w-4 h-4" /> : <FiUser className="w-4 h-4" />}
              </div>
              <div className={`absolute mt-10 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 hidden sm:block ${step >= 1 ? 'text-[#C01D38]' : 'text-slate-400'}`}>Personal</div>
            </div>
            
            <div className={`flex-1 h-1 mx-3 rounded-full transition-colors duration-500 ${step >= 2 ? 'bg-[#C01D38]' : 'bg-slate-200'}`}></div>
            
            {/* Step 2 */}
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm ${step >= 2 ? 'bg-[#C01D38] border-[#C01D38] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                {step > 2 ? <FiCheck className="w-4 h-4" /> : <FiPhone className="w-4 h-4" />}
              </div>
              <div className={`absolute mt-10 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 hidden sm:block ${step >= 2 ? 'text-[#C01D38]' : 'text-slate-400'}`}>Contact</div>
            </div>

            <div className={`flex-1 h-1 mx-3 rounded-full transition-colors duration-500 ${step >= 3 ? 'bg-[#C01D38]' : 'bg-slate-200'}`}></div>
            
            {/* Step 3 */}
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm ${step >= 3 ? 'bg-[#C01D38] border-[#C01D38] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                <FiActivity className="w-4 h-4" />
              </div>
              <div className={`absolute mt-10 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 hidden sm:block ${step >= 3 ? 'text-[#C01D38]' : 'text-slate-400'}`}>Medical</div>
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
              
              <div className="bg-slate-50/50 p-1 rounded-lg inline-flex gap-1 mb-4 border border-slate-100">
                <button type="button" onClick={() => handleRadioChange('profile_type', 'student')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all shadow-sm ${formData.profile_type === 'student' ? 'bg-white text-[#C01D38] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}>Student Profile</button>
                <button type="button" onClick={() => handleRadioChange('profile_type', 'employee')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all shadow-sm ${formData.profile_type === 'employee' ? 'bg-white text-[#C01D38] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}>Employee Profile</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <div className="md:col-span-3">
                  <label className={labelClass}>Patient ID (Student / Employee ID) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="text" name="patient_id_number" value={formData.patient_id_number} onChange={handleChange} required className={`${inputClass} ${isIdDuplicate ? 'border-red-500 focus:border-red-600 bg-red-50 text-red-700' : ''}`} placeholder="e.g. 2024-0001 or EMP-0010" />
                    {idChecking && <FiRefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                    {isIdDuplicate && !idChecking && <FiAlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
                  </div>
                  {isIdDuplicate && !idChecking && <span className="text-red-500 text-[10px] font-bold block mt-1 ml-1">This ID is already registered.</span>}
                </div>
                <div>
                  <label className={labelClass}>School Year</label>
                  <input type="text" name="school_year" value={formData.school_year} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                <div className="md:col-span-5">
                  <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required className={inputClass} placeholder="Juan" />
                </div>
                <div className="md:col-span-5">
                  <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required className={inputClass} placeholder="Dela Cruz" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>M.I.</label>
                  <input type="text" name="middle_initial" value={formData.middle_initial} onChange={handleChange} className={inputClass} placeholder="M." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className={labelClass}>Birthdate <span className="text-red-500">*</span></label>
                  <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Age</label>
                  <div className="w-full px-3 py-1.5 bg-slate-100/50 border border-slate-200 rounded-lg text-sm text-slate-400 font-medium cursor-not-allowed flex items-center h-[34px]">
                    {calculateAge(formData.birthdate)} yrs
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Gender <span className="text-red-500">*</span></label>
                  <select name="gender" value={formData.gender} onChange={handleChange} required className={inputClass}>
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

              {/* Dynamic Type Section */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 relative overflow-hidden group hover:border-[#C01D38]/30 transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C01D38]/20 group-hover:bg-[#C01D38] transition-colors"></div>
                
                {formData.profile_type === 'student' && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Student Category:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="sub_type" value="College" checked={formData.sub_type === 'College'} onChange={() => handleRadioChange('sub_type', 'College')} className="w-3.5 h-3.5 text-[#C01D38] bg-slate-100 border-slate-300 focus:ring-[#C01D38]" />
                        <span className="text-xs font-medium text-slate-600">College</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="sub_type" value="BED" checked={formData.sub_type === 'BED'} onChange={() => handleRadioChange('sub_type', 'BED')} className="w-3.5 h-3.5 text-[#C01D38] bg-slate-100 border-slate-300 focus:ring-[#C01D38]" />
                        <span className="text-xs font-medium text-slate-600">BED (Basic Ed)</span>
                      </label>
                    </div>
                    {formData.sub_type === 'College' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className={labelClass}>College / Dept <span className="text-red-500">*</span></label>
                          <select name="college_dept" value={formData.college_dept} onChange={handleChange} className={inputClass}>
                            <option value="">Select Department</option>
                            {globalSettings.departments.map((dept: string, idx: number) => (
                              <option key={idx} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Year Level <span className="text-red-500">*</span></label>
                          <select name="year_level" value={formData.year_level} onChange={handleChange} className={inputClass}>
                            <option value="">Select Year</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="5th Year">5th Year</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Course/Program</label>
                          <select name="course" value={formData.course} onChange={handleChange} className={inputClass}>
                            <option value="">Select Course/Program</option>
                            {globalSettings.courses.map((course: string, idx: number) => (
                              <option key={idx} value={course}>{course}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className={labelClass}>College / Dept. <span className="text-red-500">*</span></label>
                          <select name="college_dept" value={formData.college_dept} onChange={handleChange} className={inputClass}>
                            <option value="">Select Department</option>
                            {globalSettings.bed_departments.map((dept: string, idx: number) => (
                              <option key={idx} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Program <span className="text-red-500">*</span></label>
                          <select name="course" value={formData.course} onChange={handleChange} className={inputClass}>
                            <option value="">Select Program</option>
                            {globalSettings.bed_programs.map((prog: string, idx: number) => (
                              <option key={idx} value={prog}>{prog}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Year Level <span className="text-red-500">*</span></label>
                          <select name="year_level" value={formData.year_level} onChange={handleChange} className={inputClass} disabled={!formData.course}>
                            <option value="">Select Year Level</option>
                            {globalSettings.bed_year_levels.map((yr: string, idx: number) => (
                              <option key={idx} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {formData.profile_type === 'employee' && (
                  <div className="animate-in fade-in duration-300">
                    <div>
                      <label className={labelClass}>Department / Office <span className="text-red-500">*</span></label>
                      <input type="text" name="college_dept" value={formData.college_dept} onChange={handleChange} className={inputClass} placeholder="e.g. Faculty, HR Office" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: Contact & Emergency */}
            <div className={`transition-all duration-500 ease-in-out absolute inset-0 ${step === 2 ? 'opacity-100 translate-x-0 pointer-events-auto relative' : 'opacity-0 translate-x-8 pointer-events-none hidden'}`}>
              
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><FiPhone className="w-3 h-3" /></span>
                Personal Contact
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelClass}>Phone / Contact # <span className="text-red-500">*</span></label>
                  <input type="text" name="contact" value={formData.contact} onChange={handleChange} className={inputClass} placeholder="09XX XXX XXXX" />
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="student@cjc.edu.ph" />
                </div>
              </div>
              <div className="mb-4">
                <label className={labelClass}>Home Address</label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass} placeholder="House #, Street, Barangay, City, Province" />
              </div>

              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mt-4">
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  In Case of Emergency
                </h3>
                
                <div className="mb-3">
                  <label className={labelClass}>Contact Person Name <span className="text-red-500">*</span></label>
                  <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} className={inputClass} placeholder="Full Name" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 h-full flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-blue-900 mb-1">Health History & Allergies</label>
                  <p className="text-[10px] text-blue-700/70 mb-2">Please list any known allergies, past surgeries, chronic conditions, or long-term medications.</p>
                  <textarea 
                    name="health_history" 
                    value={formData.health_history} 
                    onChange={handleChange}
                    rows={3}
                    className={`${inputClass} bg-white shadow-sm resize-none`}
                    placeholder="e.g. Allergic to penicillin. Diagnosed with asthma."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-blue-900 mb-1">Initial Vital Statistics / Notes</label>
                  <p className="text-[10px] text-blue-700/70 mb-2">Record baseline physical condition or visible disabilities.</p>
                  <textarea 
                    name="vital_stats" 
                    value={formData.vital_stats} 
                    onChange={handleChange}
                    rows={3}
                    className={`${inputClass} bg-white shadow-sm resize-none`}
                    placeholder="e.g. Height: 165cm, Weight: 60kg, typical BP: 120/80..."
                  ></textarea>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center rounded-b-3xl">
          <div className="flex space-x-1.5">
            {[1, 2, 3].map((dot) => (
              <div key={dot} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${step === dot ? 'bg-[#C01D38] w-4' : 'bg-slate-300'}`} />
            ))}
          </div>
          
          <div className="flex gap-2">
            {step > 1 ? (
              <button 
                type="button" 
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm rounded-lg transition-all flex items-center gap-1.5"
              >
                <FiChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : (
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
            
            <button 
              type="submit" 
              form="patient-form"
              disabled={loading || isIdDuplicate}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#9B101E] to-[#C01D38] hover:from-[#800d18] hover:to-[#9B101E] shadow-[0_4px_14px_0_rgba(192,29,56,0.39)] hover:shadow-[0_6px_20px_rgba(192,29,56,0.23)] hover:-translate-y-0.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-1.5"
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </div>
              ) : step < 3 ? (
                <>Next Step <FiChevronRight className="w-3.5 h-3.5" /></>
              ) : (
                <>Save Patient <FiCheck className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PatientModal;
