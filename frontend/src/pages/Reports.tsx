import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiDownload, FiCalendar, FiFilter, FiFileText, FiActivity, FiUsers, FiTrendingUp, FiX } from 'react-icons/fi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Reports: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  
  // New Filters
  const [department, setDepartment] = useState('All Departments');
  const [program, setProgram] = useState('All Programs');
  const [yearLevel, setYearLevel] = useState('All Year Levels');
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  
  const [globalSettings, setGlobalSettings] = useState<any>({ 
    departments_hierarchy: [],
    bed_hierarchy: [],
    college_year_levels: []
  });
  
  // Modal State
  const [showExportModal, setShowExportModal] = useState(false);

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

  // Fetch settings on mount
  useEffect(() => {
    apiFetch('/api/index.php?route=settings&action=get')
      .then(res => {
        if (res.settings) {
          setGlobalSettings({
            departments_hierarchy: Array.isArray(res.settings.departments_hierarchy) ? res.settings.departments_hierarchy : [],
            bed_hierarchy: Array.isArray(res.settings.bed_hierarchy) ? res.settings.bed_hierarchy : [],
            college_year_levels: Array.isArray(res.settings.college_year_levels) ? res.settings.college_year_levels : []
          });
        }
      })
      .catch(() => console.error("Failed to fetch settings"));
  }, []);

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/index.php?route=reports&action=generate&start_date=${startDate}&end_date=${endDate}&branch=${encodeURIComponent(selectedBranch)}&department=${encodeURIComponent(department)}&program=${encodeURIComponent(program)}&year_level=${encodeURIComponent(yearLevel)}`);
      setData(res);
      setUserRole(res.user_role);
      
      if (res.current_branch && res.user_role !== 'Superadmin') {
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
  }, [startDate, endDate, selectedBranch, department, program, yearLevel]);

  const handleExportClick = () => {
    if (!data || !data.export_data || data.export_data.length === 0) {
      alert("No data available to export for this date range and filters.");
      return;
    }
    setShowExportModal(true);
  };

  const confirmExportCSV = () => {
    const exportData = data.export_data;
    const headers = Object.keys(exportData[0]).join(',');
    const rows = exportData.map((row: any) => {
      return Object.values(row).map((val: any) => {
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
    setShowExportModal(false);
  };

  // Chart Data Preparation
  const getVisitsChartData = () => {
    if (!data || !data.visits_by_type) return null;
    const labels = data.visits_by_type.map((v: any) => v.type);
    const chartData = data.visits_by_type.map((v: any) => v.count);
    return {
      labels,
      datasets: [
        {
          data: chartData,
          backgroundColor: ['#A5192D', '#1e293b', '#64748b', '#cbd5e1'],
          borderWidth: 0,
        },
      ],
    };
  };

  const getDiagnosesChartData = () => {
    if (!data || !data.top_diagnoses) return null;
    const labels = data.top_diagnoses.map((d: any) => d.diagnosis.length > 20 ? d.diagnosis.substring(0, 20) + '...' : d.diagnosis);
    const chartData = data.top_diagnoses.map((d: any) => d.count);
    return {
      labels,
      datasets: [
        {
          label: 'Number of Cases',
          data: chartData,
          backgroundColor: '#A5192D',
          borderRadius: 4,
        },
      ],
    };
  };

  // Computed Arrays for Filters
  const allDepartments = [
    ...(globalSettings.departments_hierarchy.map((d: any) => d.department)),
    "Basic Education"
  ];
  
  let dynamicPrograms: string[] = [];
  let dynamicYearLevels: string[] = [];

  if (department === 'Basic Education') {
    dynamicPrograms = globalSettings.bed_hierarchy.map((b: any) => b.program);
    if (program && program !== 'All Programs') {
      const selectedBedProgram = globalSettings.bed_hierarchy.find((b: any) => b.program === program);
      if (selectedBedProgram) {
        dynamicYearLevels = selectedBedProgram.year_levels;
      }
    }
  } else if (department !== 'All Departments') {
    const selectedCollegeDept = globalSettings.departments_hierarchy.find((d: any) => d.department === department);
    if (selectedCollegeDept) {
      dynamicPrograms = selectedCollegeDept.programs;
    }
    dynamicYearLevels = globalSettings.college_year_levels;
  }

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start w-full mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-2">Reports & Analytics</h1>
            <p className="text-slate-500 text-sm font-medium">Generate specific date-range reports and visualize clinic data</p>
          </div>
          <button 
            onClick={handleExportClick}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 h-11 rounded-lg text-sm font-bold tracking-wide flex items-center gap-2 transition-colors shadow-md"
          >
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-11 focus-within:border-[#A5192D] focus-within:ring-1 focus-within:ring-[#A5192D] transition-all">
            <span className="px-3 text-slate-400 flex items-center">
              <FiCalendar />
            </span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-2 text-sm outline-none text-slate-700 bg-transparent"
            />
            <span className="px-2 text-slate-400 font-medium text-sm">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-2 text-sm outline-none text-slate-700 pr-3 bg-transparent"
            />
          </div>

          {(userRole === 'Superadmin') && (
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-11 focus-within:border-[#A5192D] focus-within:ring-1 focus-within:ring-[#A5192D] transition-all">
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 text-sm outline-none text-slate-700 bg-transparent pr-4"
              >
                <option value="All Branches">All Branches</option>
                <option value="College Clinic">College Clinic</option>
                <option value="Basic Education Clinic">Basic Education Clinic</option>
                <option value="Power Campus Clinic">Power Campus Clinic</option>
              </select>
            </div>
          )}

          {/* New Filters */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-11 focus-within:border-[#A5192D] focus-within:ring-1 focus-within:ring-[#A5192D] transition-all">
            <span className="px-3 text-slate-400 flex items-center">
              <FiFilter />
            </span>
            <select 
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setProgram('All Programs'); setYearLevel('All Year Levels'); }}
              className="px-3 py-2 text-sm outline-none text-slate-700 bg-transparent"
            >
              <option value="All Departments">All Departments</option>
              {allDepartments.map((dept: string, idx: number) => (
                <option key={idx} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-11 focus-within:border-[#A5192D] focus-within:ring-1 focus-within:ring-[#A5192D] transition-all">
            <select 
              value={program}
              onChange={(e) => { setProgram(e.target.value); setYearLevel('All Year Levels'); }}
              className="px-3 py-2 text-sm outline-none text-slate-700 bg-transparent"
            >
              <option value="All Programs">All Programs</option>
              {dynamicPrograms.map((prog: string, idx: number) => (
                <option key={idx} value={prog}>{prog}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-11 focus-within:border-[#A5192D] focus-within:ring-1 focus-within:ring-[#A5192D] transition-all">
            <select 
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              className="px-3 py-2 text-sm outline-none text-slate-700 bg-transparent pr-4"
            >
              <option value="All Year Levels">All Year Levels</option>
              {dynamicYearLevels.map((yr: string, idx: number) => (
                <option key={idx} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#A5192D] rounded-full animate-spin mb-4"></div>
          <div className="text-slate-500 font-medium">Crunching data...</div>
        </div>
      )}

      {!loading && data && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-6 transform hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-[#A5192D]">
                <FiUsers className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Visitors</p>
                <h3 className="text-3xl font-black text-slate-800">
                  {data.visits_by_type.reduce((sum: number, item: any) => sum + item.count, 0)}
                </h3>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-6 transform hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <FiActivity className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Diagnoses</p>
                <h3 className="text-3xl font-black text-slate-800">
                  {data.top_diagnoses.reduce((sum: number, item: any) => sum + item.count, 0)}
                </h3>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-6 transform hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <FiTrendingUp className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Meds Dispensed</p>
                <h3 className="text-3xl font-black text-slate-800">
                  {data.medicines_dispensed.reduce((sum: number, item: any) => sum + item.count, 0)}
                </h3>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pie Chart: Visitor Demographics */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
              <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-[#A5192D] rounded-full"></div>
                Visitor Demographics
              </h3>
              <div className="flex-1 flex items-center justify-center min-h-[250px]">
                {data.visits_by_type.length === 0 ? (
                  <div className="text-slate-400 text-sm">No visitor data found.</div>
                ) : (
                  <div className="w-full max-w-[250px]">
                    <Pie 
                      data={getVisitsChartData()!} 
                      options={{
                        plugins: {
                          legend: { position: 'bottom', labels: { padding: 20, font: { family: 'Montserrat', weight: 'bold' } } }
                        }
                      }} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bar Chart: Top Diagnoses */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
              <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-slate-800 rounded-full"></div>
                Top Diagnoses (Morbidity)
              </h3>
              <div className="flex-1 min-h-[250px] w-full">
                {data.top_diagnoses.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">No diagnoses recorded in this period.</div>
                ) : (
                  <Bar 
                    data={getDiagnosesChartData()!} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false }
                      },
                      scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                      }
                    }} 
                  />
                )}
              </div>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Medicines List */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-1">
              <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                Medicines Dispensed Log
              </h3>
              {data.medicines_dispensed.length === 0 ? (
                <div className="text-slate-400 text-sm py-4 text-center">No medicines dispensed.</div>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {data.medicines_dispensed.map((m: any, i: number) => (
                    <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-700 font-semibold text-sm">{m.medicine}</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs">
                          {m.count} qty
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Patient: <span className="font-medium text-slate-700">{m.patient}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logbook Preview */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                  Logbook Preview
                </h3>
                <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{data.export_data.length} Total Records</span>
              </div>
              
              {data.export_data.length === 0 ? (
                <div className="text-slate-400 text-sm py-10 text-center flex flex-col items-center">
                  <FiFileText className="w-12 h-12 text-slate-200 mb-3" />
                  No logbook entries found for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        <th className="p-3 rounded-tl-lg">Date</th>
                        <th className="p-3">Patient Name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Purpose</th>
                        <th className="p-3">Diagnosis</th>
                        <th className="p-3 rounded-tr-lg text-right">Attended By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.export_data.slice(0, 8).map((row: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-sm text-slate-500 whitespace-nowrap">
                            {new Date(row.Date).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-700 text-sm">{row.Patient_Name}</div>
                            <div className="text-xs text-slate-400">{row.ID_Number}</div>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full uppercase">
                              {row.Type}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-[#A5192D] font-medium">{row.Purpose}</td>
                          <td className="p-3 text-sm text-slate-600 truncate max-w-[150px]">{row.Diagnosis}</td>
                          <td className="p-3 text-sm text-slate-500 text-right">{row.Attended_By}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.export_data.length > 8 && (
                    <div className="text-center pt-4 pb-2 border-t border-slate-50">
                      <button onClick={handleExportClick} className="text-sm font-semibold text-[#A5192D] hover:underline">
                        Export CSV to see all {data.export_data.length} records
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}

      {/* Export Confirmation Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Confirm Export</h2>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <FiX />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-6">
              You are about to download a CSV file of the logbook with the following filters applied:
            </p>
            
            <div className="bg-slate-50 rounded-xl p-5 mb-8 space-y-3 border border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date Range:</span>
                <span className="font-semibold text-slate-700">{startDate} to {endDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Branch:</span>
                <span className="font-semibold text-slate-700">{selectedBranch}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Department:</span>
                <span className="font-semibold text-slate-700">{department}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Program:</span>
                <span className="font-semibold text-slate-700">{program}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Year Level:</span>
                <span className="font-semibold text-slate-700">{yearLevel}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Total Records:</span>
                <span className="font-bold text-[#A5192D]">{data?.export_data?.length || 0}</span>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmExportCSV}
                className="px-5 py-2.5 text-sm font-bold text-white bg-[#A5192D] hover:bg-[#8a1425] rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <FiDownload /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
