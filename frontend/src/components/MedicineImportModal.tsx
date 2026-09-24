import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../utils/api';
import { 
  FiX, FiUpload, FiDownload, FiCheckCircle, FiAlertCircle, 
  FiFileText, FiRefreshCw, FiCheck, FiHelpCircle, FiPackage 
} from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

interface MedicineImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  clinicBranch?: string;
}

interface ParsedMedicineRow {
  _rowIndex: number;
  _isValid: boolean;
  _errorReason: string;
  brand_name: string;
  dosage: string;
  generic_name: string;
  lot_number: string;
  quantity: number;
  date_arrived: string;
  expired_on: string;
  restock_semester: string;
  school_year: string;
  clinic_branch?: string;
}

const MedicineImportModal: React.FC<MedicineImportModalProps> = ({ 
  isOpen, 
  onClose, 
  onImportSuccess, 
  clinicBranch = 'College Clinic' 
}) => {
  const { confirm } = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedMedicineRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [filterInvalidOnly, setFilterInvalidOnly] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    success: boolean;
    message: string;
    added_count?: number;
    skipped_count?: number;
    total_count?: number;
    errors?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

  const formatExcelDate = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number') {
      // Excel serial date number
      const date = new Date((val - (25567 + 2)) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim();
    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      const d = new Date(timestamp);
      return d.toISOString().split('T')[0];
    }
    return str;
  };

  const today = new Date();
  const curMonth = today.getMonth() + 1;
  const curYear = today.getFullYear();
  const defaultCurrentSY = curMonth >= 8 ? `${curYear}-${curYear + 1}` : `${curYear - 1}-${curYear}`;
  const defaultCurrentSem = (curMonth >= 8 || curMonth <= 12) ? '1st Semester' : (curMonth >= 1 && curMonth <= 5 ? '2nd Semester' : 'Summer');

  const mapRowToMedicineFields = (row: Record<string, any>): Omit<ParsedMedicineRow, '_rowIndex' | '_isValid' | '_errorReason'> => {
    const mapped: any = {
      brand_name: '',
      dosage: '',
      generic_name: '',
      lot_number: '',
      quantity: 50,
      date_arrived: new Date().toISOString().split('T')[0],
      expired_on: '',
      restock_semester: defaultCurrentSem,
      school_year: defaultCurrentSY,
      clinic_branch: clinicBranch || 'College Clinic'
    };

    const keys = Object.keys(row);
    keys.forEach(key => {
      const norm = normalizeKey(key);
      const val = row[key] !== undefined && row[key] !== null ? row[key] : '';

      if (['brandname', 'brand', 'tradename', 'medicinename', 'itemname'].includes(norm)) {
        mapped.brand_name = String(val).trim();
      } else if (['dosage', 'strength', 'dosagestrength', 'dose', 'mg'].includes(norm)) {
        mapped.dosage = String(val).trim();
      } else if (['genericname', 'generic', 'genericdrug', 'moleculename'].includes(norm)) {
        mapped.generic_name = String(val).trim();
      } else if (['lotnumber', 'lotno', 'batchnumber', 'batchno', 'lot', 'batch', 'lotbatchno'].includes(norm)) {
        mapped.lot_number = String(val).trim();
      } else if (['quantity', 'quantityunits', 'qty', 'units', 'stock', 'amount', 'count'].includes(norm)) {
        const parsedQty = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        mapped.quantity = isNaN(parsedQty) ? 0 : parsedQty;
      } else if (['datearrived', 'date_arrived', 'arrivaldate', 'datereceived', 'receiveddate', 'dateadded', 'arrival', 'date'].includes(norm)) {
        const d = formatExcelDate(val);
        if (d) mapped.date_arrived = d;
      } else if (['expirationdate', 'expirydate', 'expiredon', 'expiry', 'expdate', 'exp', 'expiration'].includes(norm)) {
        mapped.expired_on = formatExcelDate(val);
      } else if (['restocksemester', 'semester', 'sem'].includes(norm)) {
        mapped.restock_semester = String(val).trim();
      } else if (['schoolyear', 'sy', 'academicyear', 'acadyear'].includes(norm)) {
        mapped.school_year = String(val).trim();
      } else if (['clinicbranch', 'branch'].includes(norm)) {
        mapped.clinic_branch = String(val).trim();
      }
    });

    if (!mapped.date_arrived) {
      mapped.date_arrived = new Date().toISOString().split('T')[0];
    }

    if (!mapped.generic_name && mapped.brand_name) {
      mapped.generic_name = mapped.brand_name;
    }

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
          setError('The uploaded file contains no rows or records.');
          setParsedRows([]);
          setParsing(false);
          return;
        }

        const mappedList: ParsedMedicineRow[] = rawJson.map((row, idx) => {
          const mapped = mapRowToMedicineFields(row);
          const errors: string[] = [];

          if (!mapped.brand_name) {
            errors.push('Brand Name is required');
          }
          if (!mapped.quantity || mapped.quantity <= 0) {
            errors.push('Quantity must be greater than 0');
          }
          if (!mapped.expired_on) {
            errors.push('Expiration Date is required');
          } else {
            const expDate = new Date(mapped.expired_on);
            if (isNaN(expDate.getTime())) {
              errors.push('Invalid Expiration Date format');
            }
          }

          const isValid = errors.length === 0;

          return {
            _rowIndex: idx + 2,
            _isValid: isValid,
            _errorReason: errors.join(', '),
            ...mapped
          };
        });

        setParsedRows(mappedList);
      } catch (err: any) {
        console.error(err);
        setError('Failed to parse file. Please verify it is a valid Excel or CSV document.');
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file from disk.');
      setParsing(false);
    };

    reader.readAsArrayBuffer(selected);
  };

  const handleDownloadTemplate = () => {
    const templateHeaders = [
      'Brand Name',
      'Dosage / Strength',
      'Generic Name',
      'LOT / Batch No.',
      'Quantity (Units)',
      'Date Arrived',
      'Expiration Date',
      'Restock Semester',
      'School Year'
    ];

    const today = new Date().toISOString().split('T')[0];

    const sampleRows = [
      {
        'Brand Name': 'Biogesic',
        'Dosage / Strength': '500mg',
        'Generic Name': 'Paracetamol',
        'LOT / Batch No.': 'LOT-2025-001',
        'Quantity (Units)': 100,
        'Date Arrived': today,
        'Expiration Date': '2027-08-31',
        'Restock Semester': '1st Semester',
        'School Year': '2025-2026'
      },
      {
        'Brand Name': 'Neozep Forte',
        'Dosage / Strength': '10mg/2mg/500mg',
        'Generic Name': 'Phenylephrine HCl / Chlorphenamine / Paracetamol',
        'LOT / Batch No.': 'LOT-2025-002',
        'Quantity (Units)': 50,
        'Date Arrived': today,
        'Expiration Date': '2026-11-30',
        'Restock Semester': '1st Semester',
        'School Year': '2025-2026'
      },
      {
        'Brand Name': 'Amoxil',
        'Dosage / Strength': '500mg',
        'Generic Name': 'Amoxicillin',
        'LOT / Batch No.': 'LOT-2025-003',
        'Quantity (Units)': 75,
        'Date Arrived': today,
        'Expiration Date': '2027-05-15',
        'Restock Semester': '1st Semester',
        'School Year': '2025-2026'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: templateHeaders });
    
    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 20 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');
    XLSX.writeFile(workbook, 'cjc_medicine_import_template.xlsx');
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._isValid);
    if (validRows.length === 0) {
      setError('There are no valid medicine records to import.');
      return;
    }

    const confirmed = await confirm({
      title: 'Confirm Bulk Medicine Import',
      message: `Are you sure you want to import ${validRows.length} medicine batch(es) into the Main Inventory bulk pool for ${clinicBranch}?`,
      confirmText: `Import ${validRows.length} Items`
    });

    if (!confirmed) return;

    setImporting(true);
    setError('');

    try {
      const payload = {
        clinic_branch: clinicBranch,
        items: validRows.map(({ _rowIndex, _isValid, _errorReason, ...fields }) => fields)
      };

      const res = await apiFetch('/api/index.php?route=inventory&action=import_medicines', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setResultSummary({
          success: true,
          message: res.message || 'Medicines imported successfully!',
          added_count: res.added_count,
          skipped_count: res.skipped_count,
          total_count: res.total_count,
          errors: res.errors
        });
        onImportSuccess();
      } else {
        setError(res.error || 'Failed to import medicine records.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r._isValid).length;
  const invalidCount = parsedRows.length - validCount;
  const displayedRows = filterInvalidOnly ? parsedRows.filter(r => !r._isValid) : parsedRows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <FiPackage className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Import Medicines to Main Inventory
              </h2>
              <p className="text-xs text-slate-500">
                Bulk upload medicine stock batches into {clinicBranch} bulk pool via Excel or CSV.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={importing}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Success Banner */}
          {resultSummary && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
              <FiCheckCircle className="text-xl text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Import Complete!</h4>
                <p className="text-xs leading-relaxed">{resultSummary.message}</p>
                <div className="flex gap-4 text-xs font-medium pt-1 text-emerald-700">
                  <span>Added: <strong>{resultSummary.added_count}</strong> batches</span>
                  {resultSummary.skipped_count ? <span>Skipped: <strong>{resultSummary.skipped_count}</strong></span> : null}
                  <span>Total Rows: <strong>{resultSummary.total_count}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
              <FiAlertCircle className="text-xl text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">Error</h4>
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Upload & Template Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Dropzone */}
            <div className="md:col-span-2 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-5 text-center transition-all bg-slate-50/50 hover:bg-emerald-50/20 flex flex-col items-center justify-center relative cursor-pointer group">
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                disabled={parsing || importing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:scale-105 transition-all mb-2">
                {parsing ? (
                  <FiRefreshCw className="animate-spin text-xl text-emerald-600" />
                ) : (
                  <FiUpload className="text-xl" />
                )}
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {file ? file.name : 'Choose an Excel or CSV file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Click to browse or drag & drop file here'}
              </p>
            </div>

            {/* Template Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <FiHelpCircle className="text-emerald-600" /> Standard Template
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Download the pre-formatted template with exact fields matching the Add Medicine modal.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-3 w-full bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <FiDownload className="text-sm" /> Download Template (.xlsx)
              </button>
            </div>
          </div>

          {/* Parsed Rows Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    File Preview:
                  </span>
                  <span className="text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium">
                    Total: {parsedRows.length}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium flex items-center gap-1">
                    <FiCheck className="text-xs" /> {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-xs px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full font-medium flex items-center gap-1">
                      <FiAlertCircle className="text-xs" /> {invalidCount} Invalid
                    </span>
                  )}
                </div>

                {invalidCount > 0 && (
                  <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterInvalidOnly}
                      onChange={(e) => setFilterInvalidOnly(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    Show invalid rows only ({invalidCount})
                  </label>
                )}
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Brand Name *</th>
                      <th className="py-2.5 px-3">Dosage / Strength</th>
                      <th className="py-2.5 px-3">Generic Name</th>
                      <th className="py-2.5 px-3">LOT / Batch No.</th>
                      <th className="py-2.5 px-3">Quantity *</th>
                      <th className="py-2.5 px-3">Date Arrived</th>
                      <th className="py-2.5 px-3">Expiration Date *</th>
                      <th className="py-2.5 px-3">Semester</th>
                      <th className="py-2.5 px-3">School Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {displayedRows.map((row) => (
                      <tr 
                        key={row._rowIndex} 
                        className={`hover:bg-slate-50/80 transition-colors ${!row._isValid ? 'bg-rose-50/40' : ''}`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                          {row._rowIndex}
                        </td>
                        <td className="py-2 px-3">
                          {row._isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <FiCheck className="text-xs" /> Valid
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full"
                              title={row._errorReason}
                            >
                              <FiAlertCircle className="text-xs" /> {row._errorReason}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {row.brand_name || <span className="text-rose-500 italic">Required</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {row.dosage || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {row.generic_name || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                          {row.lot_number || <span className="text-slate-400 italic">Auto-gen</span>}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800">
                          {row.quantity > 0 ? (
                            row.quantity
                          ) : (
                            <span className="text-rose-500 italic">{row.quantity}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                          {row.date_arrived || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {row.expired_on ? (
                            row.expired_on
                          ) : (
                            <span className="text-rose-500 italic">Required</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {row.restock_semester}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {row.school_year}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-all cursor-pointer"
          >
            {resultSummary?.success ? 'Close' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            {parsedRows.length > 0 && !resultSummary?.success && (
              <button
                type="button"
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {importing ? (
                  <>
                    <FiRefreshCw className="animate-spin text-sm" /> Importing...
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="text-sm" /> Import {validCount} Valid {validCount === 1 ? 'Medicine' : 'Medicines'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineImportModal;
