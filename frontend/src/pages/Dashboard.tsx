import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { apiFetch } from '../utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from 'recharts';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('All Branches');
  const [stats, setStats] = useState({
    visitsThisWeek: 0,
    totalRegistered: 0,
    unattended: 0,
    pendingRechecks: 0,
    inventory: 0,
    visitsByCollege: [] as {name: string, visits: number}[],
    topDiagnoses: [] as {name: string, count: number}[],
    visitTrends: [] as {date: string, visits: number}[],
    topDispensed: [] as {name: string, count: number}[],
    expiringItems: [] as any[],
    lowStockItems: [] as any[]
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#C01D38', '#455A64'];

  useEffect(() => {
    // Fetch real stats from the new MVC backend!
    apiFetch(`/api/index.php?route=dashboard&action=stats&branch=${encodeURIComponent(selectedBranch)}`)
      .then(res => {
        // Transform visitsByCollege object to array
        const colleges = res.visits_by_college ? Object.keys(res.visits_by_college).map(key => {
          // Shorten names for the chart
          let shortName = key;
          if (key.includes('(')) {
             shortName = key.split('(')[1].replace(')', '');
          } else {
             shortName = key.replace('Department', '').replace('College of', '').trim();
          }
          return {
            name: shortName, 
            visits: res.visits_by_college[key]
          };
        }) : [];

        // Transform diagnoses
        const diagnoses = res.top_diagnoses ? res.top_diagnoses.map((d: any) => ({
          name: d.diagnosis,
          count: d.count
        })) : [];

        if (res) {
          if (res.user_role) setUserRole(res.user_role);
          if (res.current_branch && res.user_role !== 'Superadmin' && res.user_role !== 'Admin') {
              setSelectedBranch(res.current_branch);
          }
          
          setStats({
            visitsThisWeek: res.visits_week || 0,
            totalRegistered: res.total_registered || 0,
            unattended: res.unattended || 0,
            pendingRechecks: res.pending_rechecks || 0,
            inventory: res.inventory_count || 0,
            visitsByCollege: colleges,
            topDiagnoses: diagnoses,
            visitTrends: res.visit_trends || [],
            topDispensed: (res.top_dispensed || []).map((i: any) => ({ name: i.generic_name, count: i.cnt })),
            expiringItems: res.expiring_items || [],
            lowStockItems: res.low_stock_items || []
          });
        }
      })
      .catch(err => console.error("Failed to fetch dashboard stats:", err));
  }, [selectedBranch]);

  const MetricCard = ({ title, value, subtext, valueColor }: { title: string, value: number, subtext: string, valueColor: string }) => (
    <div className="bg-white rounded-md shadow-[0_2px_10px_rgb(0,0,0,0.04)] p-5 flex flex-col items-center justify-center border border-slate-100 flex-1 min-w-[150px]">
      <h3 className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">{title}</h3>
      <div className={`text-3xl font-bold mb-1 ${valueColor}`}>{value}</div>
      <p className="text-[0.6rem] text-slate-300 text-center">{subtext}</p>
    </div>
  );

  return (
    <div className="p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Dashboard</h1>
          <p className="text-slate-400 text-sm font-medium">Overview of clinic activity</p>
        </div>
        <div className="flex gap-3 items-center">
          {(userRole === 'Superadmin' || userRole === 'Admin') && (
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-md text-sm font-medium shadow-sm outline-none focus:border-[#C01D38]"
            >
              <option value="All Branches">All Branches</option>
              <option value="College Clinic">College Clinic</option>
              <option value="Basic Education Clinic">Basic Education Clinic</option>
              <option value="Power Campus Clinic">Power Campus Clinic</option>
            </select>
          )}
          <button 
            onClick={() => navigate('/patient-list')} 
            className="bg-[#C01D38] hover:bg-[#a0182f] text-white px-4 py-2.5 rounded-md text-sm font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-sm">
            <FiPlus className="w-4 h-4" strokeWidth={3} /> Quick Admit
          </button>
          <button 
            onClick={() => navigate('/inventory')}
            className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-md text-sm font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-sm">
            Quick Dispense
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats.expiringItems.length > 0 || stats.lowStockItems.length > 0) && (
        <div className="mb-8 space-y-3">
          {stats.expiringItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 shadow-sm flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-500 shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-bold text-sm">Expiring Items Alert</h3>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {stats.expiringItems.map((item, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">{item.generic_name}</span> (Batch: {item.batch_number}) expires on <span className="font-semibold">{item.expired_on}</span> at {item.clinic_branch}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {stats.lowStockItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-4 shadow-sm flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-orange-500 shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-bold text-sm">Low Stock Alert</h3>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {stats.lowStockItems.map((item, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">{item.generic_name}</span> ({item.category}) is low on stock! Only <span className="font-semibold text-red-600">{item.total_stock}</span> remaining (Threshold: {item.alert_threshold}).
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="flex flex-wrap gap-4 mb-6">
        <MetricCard 
          title="VISITS THIS WEEK" 
          value={stats.visitsThisWeek} 
          subtext="This week" 
          valueColor="text-[#D32F2F]" 
        />
        <MetricCard 
          title="TOTAL REGISTERED" 
          value={stats.totalRegistered} 
          subtext="Students & Employees" 
          valueColor="text-[#1976D2]" 
        />
        <MetricCard 
          title="UNATTENDED" 
          value={stats.unattended} 
          subtext="Today: Waiting to turn" 
          valueColor="text-[#ED6C02]" 
        />
        <MetricCard 
          title="PENDING RE-CHECKS" 
          value={stats.pendingRechecks} 
          subtext="Today: Followups due" 
          valueColor="text-[#9C27B0]" 
        />
        <MetricCard 
          title="INVENTORY" 
          value={stats.inventory} 
          subtext="Overview of medicine supplies & equipments" 
          valueColor="text-[#455A64]" 
        />
      </div>

      {/* Visit Trends Line Chart */}
      <div className="mb-6 bg-white rounded-md shadow-[0_2px_10px_rgb(0,0,0,0.04)] p-6 border border-slate-100 flex flex-col h-80">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Weekly Visit Trends</h3>
        <p className="text-xs text-slate-400 mb-6">Patient visits over the last 7 days</p>
        
        <div className="flex-1 w-full">
          {stats.visitTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.visitTrends} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{stroke: '#f1f5f9', strokeWidth: 2}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="visits" stroke="#C01D38" strokeWidth={3} dot={{r: 4, fill: '#C01D38'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              <p className="text-sm font-medium">No trend data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Block: Bar Chart */}
        <div className="bg-white rounded-md shadow-[0_2px_10px_rgb(0,0,0,0.04)] p-6 border border-slate-100 h-96 flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Patient Visits by Department</h3>
          <p className="text-xs text-slate-400 mb-6">Total visits distributed across colleges</p>
          
          <div className="flex-1 w-full">
            {stats.visitsByCollege.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.visitsByCollege} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                    {stats.visitsByCollege.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p className="text-sm font-medium">No visit data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Block: Pie Chart */}
        <div className="bg-white rounded-md shadow-[0_2px_10px_rgb(0,0,0,0.04)] p-6 border border-slate-100 h-96 flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Top Diagnoses</h3>
          <p className="text-xs text-slate-400 mb-6">Most common health issues diagnosed</p>
          
          <div className="flex-1 w-full">
            {stats.topDiagnoses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.topDiagnoses}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {stats.topDiagnoses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                </svg>
                <p className="text-sm font-medium">No diagnosis data available</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Block: Top Dispensed */}
      <div className="mt-6 bg-white rounded-md shadow-[0_2px_10px_rgb(0,0,0,0.04)] p-6 border border-slate-100 flex flex-col">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Top Dispensed Medicines & Supplies</h3>
        <p className="text-xs text-slate-400 mb-6">Most frequently used items</p>
        
        <div className="w-full h-64">
          {stats.topDispensed.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topDispensed} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} width={120} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stats.topDispensed.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              <p className="text-sm font-medium">No dispensing data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

