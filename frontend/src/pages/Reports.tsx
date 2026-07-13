import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiDownload, FiCalendar, FiFilter, FiFileText } from 'react-icons/fi';

const Reports: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');

  // Default to today and first day of month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format YYYY-MM-DD
    const formatDate = (date: Date) => {
      const d = new Date(date);
      let month = '' + (d.getMonth() + 1);
      let day = '' + d.getDate();
      const year = d.getFullYear();
      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;
      return [year, month, day].join('-');
    };

    setEndDate(formatDate(today));
    setStartDate(formatDate(firstDay));
  }, []);

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/index.php?route=reports&action=generate&start_date=${startDate}&end_date=${endDate}&branch=${encodeURIComponent(selectedBranch)}`);
      setData(res);
      setUserRole(res.user_role);
      
      if (res.current_branch && res.user_role !== 'Superadmin' && res.user_role !== 'Admin') {
        setSelectedBranch(res.current_branch);
      }
    } catch (err) {
      console.error('Failed to load report', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate, selectedBranch]);

  const handleExportCSV = () => {
    if (!data || !data.export_data || data.export_data.length === 0) {
      alert("No data available to export for this date range.");
      return;
    }

    const exportData = data.export_data;
    
    // Get headers
    const headers = Object.keys(exportData[0]).join(',');
    
    // Get rows
    const rows = exportData.map((row: any) => {
      return Object.values(row).map((val: any) => {
        // Escape quotes and commas
        let cell = val === null ? '' : String(val);
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Clinic_Report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Reports & Analytics</h1>
          <p className="text-slate-400 text-sm font-medium">Generate specific date-range reports and exports</p>
        </div>
        
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden h-10">
            <span className="px-3 text-slate-400 bg-slate-50 border-r border-slate-200 h-full flex items-center">
              <FiCalendar />
            </span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm outline-none text-slate-700"
            />
            <span className="px-2 text-slate-400 font-medium text-sm">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm outline-none text-slate-700"
            />
          </div>

          {(userRole === 'Superadmin' || userRole === 'Admin') && (
            <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden h-10">
              <span className="px-3 text-slate-400 bg-slate-50 border-r border-slate-200 h-full flex items-center">
                <FiFilter />
              </span>
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 text-sm outline-none text-slate-700 bg-transparent"
              >
                <option value="All Branches">All Branches</option>
                <option value="College Clinic">College Clinic</option>
                <option value="Basic Education Clinic">Basic Education Clinic</option>
                <option value="Power Campus Clinic">Power Campus Clinic</option>
              </select>
            </div>
          )}

          <button 
            onClick={handleExportCSV}
            className="bg-[#28a745] hover:bg-[#218838] text-white px-4 py-2.5 h-10 rounded-md text-sm font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-sm"
          >
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-slate-400 font-medium">Generating report...</div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Total Visitors</h3>
              <div className="text-4xl font-bold text-[#A5192D] mb-4">
                {data.visits_by_type.reduce((sum: number, item: any) => sum + item.count, 0)}
              </div>
              <div className="space-y-2">
                {data.visits_by_type.map((type: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-500">{type.type}</span>
                    <span className="font-semibold text-slate-700">{type.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm md:col-span-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Top 10 Diagnoses</h3>
              {data.top_diagnoses.length === 0 ? (
                <div className="text-slate-400 text-sm py-4">No diagnoses recorded in this period.</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {data.top_diagnoses.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm items-center border-b border-slate-100 pb-2">
                      <span className="text-slate-700 truncate pr-4" title={d.diagnosis}>{i + 1}. {d.diagnosis}</span>
                      <span className="font-bold text-[#A5192D] bg-red-50 px-2 py-0.5 rounded-full text-xs">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Medicines & Raw Data Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Medicines Dispensed</h3>
              {data.medicines_dispensed.length === 0 ? (
                <div className="text-slate-400 text-sm py-4">No medicines dispensed in this period.</div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {data.medicines_dispensed.map((m: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm items-center">
                      <span className="text-slate-600 font-medium">{m.medicine}</span>
                      <span className="font-bold text-slate-700">{m.count} qty</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Logbook Preview</h3>
                <span className="text-xs text-slate-400 font-medium">{data.export_data.length} records</span>
              </div>
              {data.export_data.length === 0 ? (
                <div className="text-slate-400 text-sm py-4">No logbook entries found.</div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {data.export_data.slice(0, 15).map((row: any, i: number) => (
                    <div key={i} className="flex gap-3 text-sm items-start border-b border-slate-50 pb-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                        <FiFileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className="font-bold text-slate-700 truncate">{row.Patient_Name}</p>
                          <span className="text-[0.65rem] text-slate-400 whitespace-nowrap">{new Date(row.Date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-[#A5192D] font-medium truncate">{row.Purpose}</p>
                        <p className="text-xs text-slate-500 truncate">{row.Diagnosis}</p>
                      </div>
                    </div>
                  ))}
                  {data.export_data.length > 15 && (
                    <div className="text-center pt-2">
                      <span className="text-xs text-slate-400 italic">...and {data.export_data.length - 15} more records (Export CSV to see all)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
