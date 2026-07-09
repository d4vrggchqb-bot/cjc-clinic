import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiClock, FiTrendingUp, FiTrendingDown, FiEdit3 } from 'react-icons/fi';

interface InventoryLog {
  id: number;
  batch_number: string;
  clinic_branch: string;
  generic_name: string;
  category: string;
  action_type: 'restock' | 'dispense' | 'dispose' | 'adjust';
  quantity_changed: number;
  disposed_to: string | null;
  processor_name: string | null;
  created_at: string;
}

const InventoryLogs: React.FC = () => {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await apiFetch('/api/index.php?route=inventory&action=logs');
        setLogs(res.logs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'restock': return <FiTrendingUp className="text-emerald-500" />;
      case 'dispense': return <FiTrendingDown className="text-orange-500" />;
      case 'dispose': return <FiTrendingDown className="text-red-500" />;
      case 'adjust': return <FiEdit3 className="text-blue-500" />;
      default: return <FiClock />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'restock': return 'bg-emerald-100 text-emerald-800';
      case 'dispense': return 'bg-orange-100 text-orange-800';
      case 'dispose': return 'bg-red-100 text-red-800';
      case 'adjust': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading activity logs...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Inventory Activity Logs</h2>
      </div>

      <div className="overflow-auto flex-1 border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Item & Branch</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Qty Changed</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Details (Disposed To)</th>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 text-sm text-slate-600 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    {getActionIcon(log.action_type)}
                    <span className={`px-2 py-1 text-xs rounded-md capitalize font-medium ${getActionColor(log.action_type)}`}>
                      {log.action_type}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="font-medium text-slate-800">{log.generic_name} <span className="text-xs font-normal text-slate-400">({log.category})</span></div>
                  <div className="text-xs text-slate-500">{log.clinic_branch} • Batch: {log.batch_number || 'N/A'}</div>
                </td>
                <td className={`p-3 text-right font-medium ${log.quantity_changed > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed}
                </td>
                <td className="p-3 text-sm text-slate-600 italic">
                  {log.disposed_to || '-'}
                </td>
                <td className="p-3 text-sm text-slate-600">
                  {log.processor_name || 'System'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No activity logs recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryLogs;
