import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { FiX, FiUser, FiActivity, FiPhone, FiInfo } from 'react-icons/fi';

interface PatientViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number | null;
}

const PatientViewModal: React.FC<PatientViewModalProps> = ({ isOpen, onClose, patientId }) => {
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && patientId) {
      setLoading(true);
      setError('');
      apiFetch(`/api/index.php?route=patients&action=get&id=${patientId}`)
        .then(res => {
          if (res.profile) setPatient(res.profile);
          else setError('Patient data not found');
        })
        .catch(() => setError('Failed to load patient details'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#9B101E] px-6 py-4 flex justify-between items-center text-white relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute -right-6 -top-10 opacity-10">
            <FiUser className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-xl font-bold tracking-wide">Patient Profile</h2>
            <p className="text-xs text-white/80 uppercase tracking-wider mt-0.5">
              {patient?.profile_type === 'student' ? 'Student Record' : patient?.profile_type === 'employee' ? 'Employee Record' : 'Record Details'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors relative z-10">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9B101E]"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-md text-center">{error}</div>
          ) : patient ? (
            <div className="space-y-6">
              
              {/* Primary Info Card */}
              <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                    <FiUser className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-800 truncate">{patient.first_name} {patient.last_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider rounded-full ${
                        patient.profile_type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {patient.profile_type}
                      </span>
                      <span className="text-sm text-slate-500 truncate">{patient.patient_id_number || 'No ID assigned'}</span>
                      <span className="text-sm text-slate-500 truncate border-l border-slate-300 pl-2 ml-1">{patient.college_dept || 'No department specified'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-[#C01D38]">
                    <FiActivity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Blood Type</p>
                    <p className="text-sm font-semibold text-slate-700">{patient.blood_type || 'Unknown'}</p>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                    <FiPhone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Contact</p>
                    <p className="text-sm font-semibold text-slate-700">{patient.contact || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Text Areas */}
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 p-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FiInfo className="w-4 h-4" /> Health History & Allergies
                  </h4>
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {patient.health_history || <span className="text-slate-400 italic">No health history recorded.</span>}
                  </p>
                </div>
                <div className="p-4 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FiActivity className="w-4 h-4" /> Vital Statistics
                  </h4>
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {patient.vital_stats || <span className="text-slate-400 italic">No vital statistics recorded.</span>}
                  </p>
                </div>
              </div>
              
              <div className="text-center text-xs text-slate-400">
                Registered: {new Date(patient.created_at).toLocaleDateString()}
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md transition-colors shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default PatientViewModal;
