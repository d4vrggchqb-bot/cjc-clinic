import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    visitsThisWeek: 0,
    totalRegistered: 0,
    unattended: 0,
    pendingRechecks: 0,
    inventory: 0,
    visitsByCollege: [] as {name: string, visits: number}[],
    topDiagnoses: [] as {name: string, count: number}[]
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#C01D38', '#455A64'];

  useEffect(() => {
    // Fetch real stats from the new MVC backend!
    apiFetch('/api/index.php?route=dashboard&action=stats')
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

        // We receive the data directly from the PHP controller
        setStats({
          visitsThisWeek: res.visits_this_week || 0,
          totalRegistered: res.total_registered || 0,
          unattended: res.unattended || 0,
          pendingRechecks: res.pending_rechecks || 0,
          inventory: res.inventory_count || 0,
          visitsByCollege: colleges,
          topDiagnoses: diagnoses
        });
      })
      .catch(err => console.error("Failed to fetch dashboard stats:", err));
  }, []);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">Dashboard</h1>
        <p className="text-slate-400 text-sm font-medium">Overview of clinic activity</p>
      </div>

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
    </div>
  );
};

export default Dashboard;
