import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiX, FiUser, FiPhone, FiActivity, FiChevronRight, FiChevronLeft } from 'react-icons/fi';

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
      }
    }
  }, [isOpen, patientId]);

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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-[#f0f0f0] rounded shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Matching Mockup */}
        <div className="bg-[#9B101E] px-4 py-3 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold tracking-wide">
            {patientId ? 'Edit Patient' : 'Add New Patient'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-white/90 hidden sm:inline-block">Enter Student or Employee ID</span>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors bg-black/10 hover:bg-black/20 p-1.5 rounded">
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-4 bg-[#e8e8e8] border-b border-gray-300 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium border border-b-0 rounded-t-md transition-colors ${step === 1 ? 'bg-white text-slate-800 border-gray-300 relative translate-y-px z-10' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
          >
            <FiUser className="w-4 h-4" /> Personal Info
          </button>
          <button 
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium border border-b-0 rounded-t-md transition-colors ${step === 2 ? 'bg-white text-slate-800 border-gray-300 relative translate-y-px z-10' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
          >
            <FiPhone className="w-4 h-4" /> Contact & Emergency
          </button>
          <button 
            onClick={() => setStep(3)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium border border-b-0 rounded-t-md transition-colors ${step === 3 ? 'bg-white text-slate-800 border-gray-300 relative translate-y-px z-10' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
          >
            <FiActivity className="w-4 h-4" /> Medical History
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 bg-white overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
              {error}
            </div>
          )}

          <form id="patient-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* STEP 1: Personal Info */}
            <div className={step === 1 ? 'block' : 'hidden'}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Patient ID (Student / Employee ID) *</label>
                  <input type="text" name="patient_id_number" value={formData.patient_id_number} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="e.g. 2024-0001 or EMP-0010" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">School Year</label>
                  <input type="text" name="school_year" value={formData.school_year} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-10 gap-4 mb-6">
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Last Name *</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-600 mb-1">First Name *</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Middle Initial</label>
                  <input type="text" name="middle_initial" value={formData.middle_initial} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Birthdate *</label>
                  <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Age (auto)</label>
                  <input type="text" value={calculateAge(formData.birthdate)} disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none bg-gradient-to-b from-white to-gray-50">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Blood Type</label>
                  <select name="blood_type" value={formData.blood_type} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none bg-gradient-to-b from-white to-gray-50">
                    <option value="">Unknown</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              {/* Type Section */}
              <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-200">
                <span className="text-sm font-bold text-gray-800">Type *</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="profile_type" value="student" checked={formData.profile_type === 'student'} onChange={() => handleRadioChange('profile_type', 'student')} className="accent-[#9B101E]" />
                  <span className="text-sm">Student</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="profile_type" value="employee" checked={formData.profile_type === 'employee'} onChange={() => handleRadioChange('profile_type', 'employee')} className="accent-[#9B101E]" />
                  <span className="text-sm">Employee</span>
                </label>
              </div>

              {formData.profile_type === 'student' && (
                <div className="bg-gray-50 p-4 border border-gray-200 rounded mb-6">
                  <div className="flex items-center gap-6 mb-4">
                    <span className="text-sm text-gray-600">Sub-type:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="sub_type" value="College" checked={formData.sub_type === 'College'} onChange={() => handleRadioChange('sub_type', 'College')} className="accent-[#9B101E]" />
                      <span className="text-sm">College</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="sub_type" value="BED" checked={formData.sub_type === 'BED'} onChange={() => handleRadioChange('sub_type', 'BED')} className="accent-[#9B101E]" />
                      <span className="text-sm">BED (Basic Education)</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">College / Dept *</label>
                      <select name="college_dept" value={formData.college_dept} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none bg-gradient-to-b from-white to-gray-50">
                        <option value="">Select College</option>
                        <option value="BED Department">BED Department</option>
                        <option value="College of Accounting, Business and Entreprenueurship (CABE)">CABE</option>
                        <option value="College of Education and Sciences (CEDAS)">CEDAS</option>
                        <option value="College of Health Sciences (CHS)">CHS</option>
                        <option value="College of Computing and Information Sciences (CCIS)">CCIS</option>
                        <option value="College of Engineering (COE)">COE</option>
                        <option value="College of Special Programs (CSP)">CSP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Year Level *</label>
                      <select name="year_level" value={formData.year_level} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none bg-gradient-to-b from-white to-gray-50">
                        <option value="">Select Year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="5th Year">5th Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Course (type or select)</label>
                      <input type="text" name="course" value={formData.course} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="e.g. BSCS, BSN, Grade 10" />
                    </div>
                  </div>
                </div>
              )}
              {formData.profile_type === 'employee' && (
                <div className="bg-gray-50 p-4 border border-gray-200 rounded mb-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Department / Office *</label>
                    <input type="text" name="college_dept" value={formData.college_dept} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="e.g. Faculty, HR Office" />
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: Contact & Emergency */}
            <div className={step === 2 ? 'block' : 'hidden'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Phone / Contact # *</label>
                  <input type="text" name="contact" value={formData.contact} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="09XX XXX XXXX" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="student@cjc.edu.ph" />
                </div>
              </div>
              <div className="mb-8">
                <label className="block text-xs font-bold text-gray-600 mb-1">Address</label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="House #, Street, Barangay, City" />
              </div>

              <h3 className="text-sm font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Emergency Contact Information</h3>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-600 mb-1">Contact Person Name</label>
                <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="Full Name" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Contact Number</label>
                  <input type="text" name="emergency_contact_number" value={formData.emergency_contact_number} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="09XX XXX XXXX" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Relationship</label>
                  <input type="text" name="emergency_relation" value={formData.emergency_relation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none" placeholder="e.g. Mother, Father, Spouse" />
                </div>
              </div>
            </div>

            {/* STEP 3: Medical History */}
            <div className={step === 3 ? 'block' : 'hidden'}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-600 mb-1">Health History / Allergies</label>
                <textarea 
                  name="health_history" 
                  value={formData.health_history} 
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none"
                  placeholder="Any known allergies, past surgeries, or chronic conditions..."
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Initial Vital Statistics</label>
                <textarea 
                  name="vital_stats" 
                  value={formData.vital_stats} 
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#9B101E] focus:outline-none"
                  placeholder="Height, Weight, typical BP, disabilities..."
                ></textarea>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="bg-[#f8f8f8] px-6 py-4 border-t border-gray-300 flex justify-between items-center">
          <div className="text-xs text-gray-500 font-medium">
            Step {step} of 3
          </div>
          <div className="flex gap-3">
            {step > 1 ? (
              <button 
                type="button" 
                onClick={() => setStep(step - 1)}
                className="px-5 py-2 text-sm font-semibold text-gray-600 bg-gray-200 border border-gray-300 hover:bg-gray-300 rounded shadow-sm transition-colors flex items-center gap-1"
              >
                <FiChevronLeft /> Previous
              </button>
            ) : (
              <button 
                type="button" 
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold text-gray-600 bg-gray-200 border border-gray-300 hover:bg-gray-300 rounded shadow-sm transition-colors"
              >
                Cancel
              </button>
            )}
            
            <button 
              type="submit" 
              form="patient-form"
              disabled={loading}
              className="px-6 py-2 text-sm font-bold text-white bg-[#9B101E] hover:bg-[#800d18] border border-[#7a0c16] rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {loading ? 'Saving...' : step < 3 ? (
                <>Next <FiChevronRight /></>
              ) : 'Save Record'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PatientModal;
