import React, { useState, useEffect } from 'react';
import { apiFetch, apiDownload } from '../utils/api';
import { FiX, FiUser, FiActivity, FiPhone, FiInfo, FiMail, FiMapPin, FiCalendar, FiUsers, FiAlertCircle, FiPaperclip, FiUpload, FiDownload, FiFile, FiBox, FiPackage } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';


interface PatientViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number | null;
}

const PatientViewModal: React.FC<PatientViewModalProps> = ({ isOpen, onClose, patientId }) => {
  const { confirm } = useConfirm();
  const [patient, setPatient] = useState<any>(null);
  
  const calculateAge = (dob: string) => {
    if (!dob) return '--';
    const diff_ms = Date.now() - new Date(dob).getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };
  const [history, setHistory] = useState<any[]>([]);
  const [borrowingHistory, setBorrowingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 5MB.');
      return;
    }
    
    setUploadError('');
    if (e.target) e.target.value = ''; // Reset so the same file can be selected again if canceled

    const confirmed = await confirm({
      title: 'Confirm Upload',
      message: `Are you sure you want to attach ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) to this patient's profile?`,
      type: 'info'
    });
    
    if (!confirmed) return;
    await handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    if (!patientId) return;
    
    setIsUploading(true);
    setUploadError('');
    
    const formData = new FormData();
    formData.append('attachment', file);
    formData.append('profile_id', patientId.toString());
    
    try {
      const res = await apiFetch('/api/index.php?route=patients&action=upload', {
        method: 'POST',
        body: formData // Note: apiFetch should handle FormData without setting Content-Type header manually
      });
      
      if (res.success) {
        // Refresh patient to get new attachments
        const profileRes = await apiFetch(`/api/index.php?route=patients&action=get&id=${patientId}`);
        if (profileRes.profile) setPatient(profileRes.profile);
      } else {
        setUploadError(res.message || 'Upload failed');
      }
    } catch (err) {
      setUploadError('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };


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

      apiFetch(`/api/index.php?route=consultations&action=history&profile_id=${patientId}`)
        .then(res => {
          if (res.history) setHistory(res.history);
        })
        .catch(console.error);

      apiFetch(`/api/index.php?route=borrowings&action=profile_history&profile_id=${patientId}`)
        .then(res => {
          if (res.borrowings) setBorrowingHistory(res.borrowings);
        })
        .catch(console.error);
    }
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Personal Section */}
                <div className="col-span-full mb-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Personal Information</h4>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                    <FiCalendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Birthdate / Age</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {patient.birthdate ? `${new Date(patient.birthdate).toLocaleDateString()} (${calculateAge(patient.birthdate)} yrs)` : 'Unknown'}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                    <FiUsers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Gender</p>
                    <p className="text-sm font-semibold text-slate-700 capitalize">{patient.gender || 'Unknown'}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-[#C01D38]">
                    <FiActivity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Blood Type</p>
                    <p className="text-sm font-semibold text-slate-700">{patient.blood_type || 'Unknown'}</p>
                  </div>
                </div>

                {patient.profile_type === 'student' && (
                  <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                      <FiInfo className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Course & Year</p>
                      <p className="text-sm font-semibold text-slate-700">{patient.course || 'N/A'} {patient.year_level ? `- ${patient.year_level}` : ''}</p>
                    </div>
                  </div>
                )}

                {/* Contact Section */}
                <div className="col-span-full mt-4 mb-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Contact Information</h4>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                    <FiPhone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-semibold text-slate-700">{patient.contact || 'Not provided'}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                    <FiMail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-semibold text-slate-700">{patient.email || 'Not provided'}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3 md:col-span-2 lg:col-span-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                    <FiMapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                    <p className="text-sm font-semibold text-slate-700">{patient.address || 'Not provided'}</p>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="col-span-full mt-4 mb-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Emergency Contact</h4>
                </div>

                <div className="bg-red-50/50 p-4 rounded-lg border border-red-100 shadow-sm flex items-center gap-3 lg:col-span-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-[#C01D38]">
                    <FiAlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-red-400 uppercase tracking-wider">Contact Person</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {patient.emergency_contact_name || 'Not provided'} 
                      {patient.emergency_relation ? <span className="text-slate-500 text-xs ml-2 border-l border-slate-300 pl-2">{patient.emergency_relation}</span> : ''}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50/50 p-4 rounded-lg border border-red-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-[#C01D38]">
                    <FiPhone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-red-400 uppercase tracking-wider">Emergency Number</p>
                    <p className="text-sm font-semibold text-slate-800">{patient.emergency_contact_number || 'Not provided'}</p>
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
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden mb-6">
                <div className="border-b border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FiPaperclip className="w-4 h-4" /> Lab Results & Attachments
                  </h4>
                  <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded shadow-sm text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors">
                    {isUploading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-700"></div>
                    ) : (
                      <FiUpload className="w-3.5 h-3.5" />
                    )}
                    {isUploading ? 'Uploading...' : 'Upload File'}
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileSelect} disabled={isUploading} />
                  </label>
                </div>
                {uploadError && (
                  <div className="px-4 py-2 bg-red-50 text-red-600 text-xs font-medium border-b border-red-100">
                    {uploadError}
                  </div>
                )}
                
                {!patient.attachments || patient.attachments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <FiFile className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No attachments uploaded yet.</p>
                    <p className="text-xs mt-1">Upload lab results, X-rays, or medical certificates.</p>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {patient.attachments.map((file: any) => (
                      <div key={file.id} className="flex flex-col p-3 border border-slate-200 rounded-lg hover:border-slate-300 bg-slate-50/50 transition-colors">
                        <div className="flex items-center group">
                          <div className="w-10 h-10 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 mr-3 shadow-sm">
                            {file.filename.toLowerCase().endsWith('.pdf') ? <FiFile className="w-5 h-5 text-red-500" /> : <FiPaperclip className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate" title={file.filename}>{file.filename}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span>{new Date(file.created_at).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>{file.uploaded_by}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => apiDownload(`/${file.file_url}`, file.filename)} 
                            className="ml-3 p-2 text-slate-400 hover:text-[#9B101E] hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            title="Download File"
                          >
                            <FiDownload className="w-4 h-4" />
                          </button>
                        </div>
                        {file.extracted_text && (
                          <div className="mt-3 p-3 bg-white border border-indigo-100 rounded text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto relative shadow-inner">
                            <div className="sticky top-0 float-right ml-2 mb-2 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 text-[0.6rem] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> AI Extract
                            </div>
                            {file.extracted_text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FiActivity className="w-4 h-4" /> Consultation History
                  </h4>
                  <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{history.length} Records</span>
                </div>
                
                {history.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <FiInfo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No consultation records found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-semibold text-[0.65rem] uppercase tracking-wider border-b border-slate-200">
                          <th className="px-3 py-3">Date & Time</th>
                          <th className="px-3 py-3">Branch</th>
                          <th className="px-3 py-3">Vitals (BP / Temp / Wt)</th>
                          <th className="px-3 py-3 max-w-[150px]">Purpose</th>
                          <th className="px-3 py-3 max-w-[200px]">Findings (Diagnosis)</th>
                          <th className="px-3 py-3 max-w-[200px]">Medication / Treatment</th>
                          <th className="px-3 py-3">Attended By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((record: any) => {
                          const dateObj = new Date(record.date);
                          return (
                            <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-3 align-top">
                                <div className="font-semibold text-slate-800">{dateObj.toLocaleDateString()}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="px-3 py-3 align-top text-slate-700">
                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[0.65rem] font-bold text-slate-500 uppercase">
                                  {record.clinic_branch || 'College Clinic'}
                                </span>
                              </td>
                              <td className="px-3 py-3 align-top text-slate-600">
                                <div className="text-xs space-y-0.5">
                                  <div><span className="font-semibold text-slate-400">BP:</span> {record.blood_pressure || '--'}</div>
                                  <div><span className="font-semibold text-slate-400">T:</span> {record.temperature ? `${record.temperature}°C` : '--'}</div>
                                  <div><span className="font-semibold text-slate-400">W:</span> {record.weight ? `${record.weight}kg` : '--'}</div>
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top font-medium text-slate-800 max-w-[150px] whitespace-normal">
                                {record.purpose}
                              </td>
                              <td className="px-3 py-3 align-top text-slate-600 max-w-[200px] whitespace-normal">
                                {record.diagnosis || <span className="text-slate-400 italic">None</span>}
                              </td>
                              <td className="px-3 py-3 align-top text-slate-600 max-w-[200px] whitespace-normal">
                                {record.treatment ? record.treatment : (record.prescriptions ? record.prescriptions : <span className="text-slate-400 italic">None</span>)}
                              </td>
                              <td className="px-3 py-3 align-top text-slate-600 text-xs font-medium">
                                {record.attended_by || 'Staff'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Borrowing History */}
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FiBox className="w-4 h-4" /> Equipment Borrowing History
                  </h4>
                  <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{borrowingHistory.length} Records</span>
                </div>
                
                {borrowingHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <FiPackage className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No borrowing records found.</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {borrowingHistory.map((record: any) => (
                      <div key={record.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                              record.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {record.status}
                            </span>
                            <p className="font-semibold text-slate-700 mt-2">Purpose: {record.purpose}</p>
                            <p className="text-xs text-slate-500">Borrowed: {new Date(record.created_at).toLocaleString()}</p>
                            {record.returned_at && <p className="text-xs text-slate-500">Returned: {new Date(record.returned_at).toLocaleString()}</p>}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Items:</p>
                          <ul className="space-y-1">
                            {record.items.map((item: any) => (
                              <li key={item.item_id} className="flex justify-between text-sm">
                                <span className="text-slate-700 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5192D]"></span>
                                  {item.name} <span className="text-slate-400">x{item.quantity}</span>
                                </span>
                                <span className={`text-xs font-bold ${
                                  item.status === 'returned' ? 'text-green-600' : 
                                  item.status === 'dispensed' ? 'text-slate-400' : 'text-amber-600'
                                }`}>
                                  {item.status.toUpperCase()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

