import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../utils/api';
import { 
  FiX, FiUpload, FiDownload, FiCheckCircle, FiAlertCircle, 
  FiFileText, FiRefreshCw, FiCheck, FiHelpCircle, FiDatabase 
} from 'react-icons/fi';

interface PatientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const PatientImportModal: React.FC<PatientImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [resultSummary, setResultSummary] = useState<{
    success: boolean;
    message: string;
    added_count?: number;
    skipped_count?: number;
    total_count?: number;
  } | null>(null);

  if (!isOpen) return null;

  const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

  const mapRowToPatientFields = (row: Record<string, any>) => {
    const mapped: Record<string, any> = {};
    const keys = Object.keys(row);

    keys.forEach(key => {
      const norm = normalizeKey(key);
      const val = row[key] !== undefined && row[key] !== null ? String(row[key]).trim() : '';

      if (['patientid', 'idnumber', 'studentid', 'employeeid', 'id', 'patientidnumber', 'idnum'].includes(norm)) {
        mapped['patient_id_number'] = val;
      } else if (['profiletype', 'type', 'category', 'classification'].includes(norm)) {
        mapped['profile_type'] = val.toLowerCase();
      } else if (['firstname', 'fname', 'givenname', 'first'].includes(norm)) {
        mapped['first_name'] = val;
      } else if (['lastname', 'lname', 'surname', 'familyname', 'last'].includes(norm)) {
        mapped['last_name'] = val;
      } else if (['middleinitial', 'middlename', 'mi'].includes(norm)) {
        mapped['middle_initial'] = val;
      } else if (['birthdate', 'dob', 'dateofbirth', 'birth'].includes(norm)) {
        mapped['birthdate'] = val;
      } else if (['gender', 'sex'].includes(norm)) {
        mapped['gender'] = val;
      } else if (['studentcategory', 'subtype', 'category'].includes(norm)) {
        mapped['sub_type'] = val;
      } else if (['department', 'collegedept', 'office', 'school', 'collegedepartment', 'dept'].includes(norm)) {
        mapped['college_dept'] = val;
      } else if (['course', 'program', 'degree'].includes(norm)) {
        mapped['course'] = val;
      } else if (['yearlevel', 'year', 'grade', 'gradelevel'].includes(norm)) {
        mapped['year_level'] = val;
      } else if (['schoolyear', 'sy', 'academicyear'].includes(norm)) {
        mapped['school_year'] = val;
      } else if (['contactnumber', 'phone', 'phonenumber', 'contact', 'mobile'].includes(norm)) {
        mapped['contact'] = val;
      } else if (['email', 'emailaddress'].includes(norm)) {
        mapped['email'] = val;
      } else if (['address', 'homeaddress', 'location'].includes(norm)) {
        mapped['address'] = val;
      } else if (['bloodtype', 'blood'].includes(norm)) {
        mapped['blood_type'] = val;
      } else if (['height', 'heightcm'].includes(norm)) {
        mapped['height'] = val;
      } else if (['weight', 'weightkg'].includes(norm)) {
        mapped['weight'] = val;
      } else if (['mothername', 'mothersname', 'mother'].includes(norm)) {
        mapped['mother_name'] = val;
      } else if (['fathername', 'fathersname', 'father'].includes(norm)) {
        mapped['father_name'] = val;
      } else if (['emergencycontactname', 'emergencycontactperson', 'emergencyname', 'emergencycontact'].includes(norm)) {
        mapped['emergency_contact_name'] = val;
      } else if (['emergencycontactnumber', 'emergencyphone', 'emergencynumber', 'emergencycontactno'].includes(norm)) {
        mapped['emergency_contact_number'] = val;
      } else if (['emergencyrelation', 'emergencyrelationship', 'relationship', 'relation'].includes(norm)) {
        mapped['emergency_relation'] = val;
      } else if (['healthhistory', 'allergies', 'medicalhistory'].includes(norm)) {
        mapped['health_history'] = val;
      } else if (['vitalstats', 'vitals', 'vitalstatistics', 'remarks'].includes(norm)) {
        mapped['vital_stats'] = val;
      }
    });

    return mapped;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setResultSummary(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Invalid file type. Only CSV (.csv) and Excel (.xlsx, .xls) files are supported.');
      return;
    }

    setFile(selected);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setError('The uploaded file is empty or contains no records.');
          setParsedRows([]);
          setParsing(false);
          return;
        }

        const mappedList = rawJson.map((row, idx) => {
          const mapped = mapRowToPatientFields(row);
          const isValid = !!(mapped.first_name && mapped.last_name);
          return {
            _rowIndex: idx + 2,
            _isValid: isValid,
            _errorReason: !isValid ? 'Missing First or Last Name' : '',
            ...mapped
          };
        });

        setParsedRows(mappedList);
      } catch (err) {
        console.error(err);
        setError('Failed to parse file. Please ensure it is a valid CSV or Excel document.');
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file.');
      setParsing(false);
    };

    reader.readAsArrayBuffer(selected);
  };

  const handleDownloadTemplate = () => {
    const templateHeaders = [
      'Patient ID',
      'Profile Type',
      'First Name',
      'Last Name',
      'Middle Initial',
      'Birthdate',
      'Gender',
      'Student Category',
      'Department / Office',
      'Course / Program',
      'Year Level',
      'School Year',
      'Contact Number',
      'Email',
      'Home Address',
      'Blood Type',
      'Height (cm)',
      'Weight (kg)',
      "Mother's Name",
      "Father's Name",
      'Emergency Contact Name',
      'Emergency Contact Number',
      'Emergency Relationship',
      'Health History / Allergies',
      'Vital Stats / Remarks'
    ];

    const sampleRows = [
      {
        'Patient ID': '2022-0027-8',
        'Profile Type': 'Student',
        'First Name': 'Juan',
        'Last Name': 'Dela Cruz',
        'Middle Initial': 'M.',
        'Birthdate': '2003-05-15',
        'Gender': 'Male',
        'Student Category': 'College',
        'Department / Office': 'CCIS',
        'Course / Program': 'BS Computer Science',
        'Year Level': '1st Year',
        'School Year': '2026-2027',
        'Contact Number': '09123456789',
        'Email': 'juan.delacruz@g.cjc.edu.ph',
        'Home Address': 'Digos City, Davao del Sur',
        'Blood Type': 'O+',
        'Height (cm)': '168',
        'Weight (kg)': '62',
        "Mother's Name": 'Maria Dela Cruz',
        "Father's Name": 'Pedro Dela Cruz',
        'Emergency Contact Name': 'Maria Dela Cruz',
        'Emergency Contact Number': '09987654321',
        'Emergency Relationship': 'Mother',
        'Health History / Allergies': 'Asthma',
        'Vital Stats / Remarks': 'BP: 120/80'
      },
      {
        'Patient ID': 'EMP-2021-004',
        'Profile Type': 'Employee',
        'First Name': 'Maria',
        'Last Name': 'Santos',
        'Middle Initial': 'A.',
        'Birthdate': '1988-11-20',
        'Gender': 'Female',
        'Student Category': '',
        'Department / Office': 'HR Office',
        'Course / Program': '',
        'Year Level': '',
        'School Year': '2026-2027',
        'Contact Number': '09171234567',
        'Email': 'maria.santos@cjc.edu.ph',
        'Home Address': 'Bansalan, Davao del Sur',
        'Blood Type': 'A+',
        'Height (cm)': '160',
        'Weight (kg)': '54',
        "Mother's Name": '',
        "Father's Name": '',
        'Emergency Contact Name': 'John Santos',
        'Emergency Contact Number': '09179876543',
        'Emergency Relationship': 'Spouse',
        'Health History / Allergies': 'None',
        'Vital Stats / Remarks': 'Baseline clear'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: templateHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patient Import Template');
    XLSX.writeFile(workbook, 'CJC_Clinic_Patient_Import_Template.xlsx');
  };

  const handleStartImport = async () => {
    const validRows = parsedRows.filter(r => r._isValid);
    if (validRows.length === 0) {
      setError('No valid patient records found in the file to import.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const cleanPayload = validRows.map(({ _rowIndex, _isValid, _errorReason, ...rest }) => rest);

      const res = await apiFetch('/api/index.php?route=patients&action=import', {
        method: 'POST',
        body: JSON.stringify({ patients: cleanPayload })
      });

      if (res && res.success) {
        setResultSummary({
          success: true,
          message: res.message || 'Import process completed successfully.',
          added_count: res.added_count ?? 0,
          skipped_count: res.skipped_count ?? 0,
          total_count: cleanPayload.length
        });
        onImportSuccess();
      } else {
        setError(res?.message || 'Failed to import patients.');
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred during import: ' + (err?.message || 'Network error'));
    } finally {
      setImporting(false);
    }
  };

  const handleResetModal = () => {
    setFile(null);
    setParsedRows([]);
    setError('');
    setResultSummary(null);
  };

  const validCount = parsedRows.filter(r => r._isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-[100] p-4 sm:p-6 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 px-6 py-5 text-white flex justify-between items-center relative overflow-hidden shrink-0">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <FiUpload className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Import Patient Records</h2>
              <p className="text-white/80 text-xs mt-0.5">Upload CSV or Excel (.xlsx, .xls) files containing patient details</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer relative z-10"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">

          {/* Download Template Banner */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FiFileText className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-950">Patient Registration Data Template</h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Includes all fields requested when registering new patients (ID, Name, Birthdate, Department, Program, Contact, Medical History, etc.).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FiDownload className="w-4 h-4" /> Download Excel Template
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in slide-in-from-top-2">
              <FiAlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultSummary && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-3 animate-in zoom-in-95">
              <div className="flex items-center gap-2.5 font-bold text-base text-emerald-800">
                <FiCheckCircle className="w-6 h-6 text-emerald-600" />
                <span>{resultSummary.message}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 text-center">
                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-xs text-slate-500 font-bold uppercase">Total Processed</div>
                  <div className="text-xl font-black text-slate-800 mt-1">{resultSummary.total_count}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-xs text-emerald-600 font-bold uppercase">Successfully Added</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">+{resultSummary.added_count}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-xs text-amber-600 font-bold uppercase">Skipped / Existing</div>
                  <div className="text-xl font-black text-amber-700 mt-1">{resultSummary.skipped_count}</div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Box */}
          {!resultSummary && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Select CSV or Excel File
              </label>
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl bg-white p-8 text-center transition-all group relative cursor-pointer">
                <input 
                  type="file" 
                  accept=".csv, .xlsx, .xls" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {parsing ? <FiRefreshCw className="w-6 h-6 animate-spin" /> : <FiUpload className="w-6 h-6" />}
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {file ? file.name : 'Click or Drag & Drop CSV / Excel File Here'}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Supports <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> formats
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && !resultSummary && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Preview & Verification ({parsedRows.length} Rows Found)
                </label>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full border border-red-200">
                      {invalidCount} Invalid (Skipped)
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white max-h-64 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">ID Number</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Dept / Program</th>
                      <th className="p-3">Birthdate</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className={row._isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                        <td className="p-3 font-mono text-slate-400">{row._rowIndex}</td>
                        <td className="p-3 font-semibold text-slate-800">{row.patient_id_number || '—'}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.first_name || row.last_name ? `${row.first_name} ${row.last_name}` : '—'}
                        </td>
                        <td className="p-3 uppercase font-semibold text-slate-600">{row.profile_type || 'student'}</td>
                        <td className="p-3 text-slate-600">{row.college_dept || row.course || '—'}</td>
                        <td className="p-3 text-slate-500">{row.birthdate || '—'}</td>
                        <td className="p-3">
                          {row._isValid ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Valid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                              {row._errorReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 15 && (
                  <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 font-medium">
                    + {parsedRows.length - 15} more rows ready for import
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
          {resultSummary ? (
            <button
              type="button"
              onClick={handleResetModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Import Another File
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          {resultSummary ? (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              Done & Close
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartImport}
              disabled={importing || validCount === 0}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {importing ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" /> Importing {validCount} Patients...
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" /> Import {validCount} Valid Patients
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default PatientImportModal;
