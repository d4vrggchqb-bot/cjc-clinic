import React from 'react';
import { FiWifi, FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { useSync } from '../context/SyncContext';

export const SyncStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, isForcedOffline, triggerSync, toggleForceOffline } = useSync();

  if (isSyncing) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold shadow-xs animate-pulse cursor-wait"
        title="Syncing pending offline data to central server..."
      >
        <FiRefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span>Syncing{pendingCount > 0 ? ` (${pendingCount})` : '...'}</span>
      </button>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            if (pendingCount > 0) triggerSync();
            else toggleForceOffline();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold shadow-xs hover:bg-rose-100 transition-colors cursor-pointer"
          title={
            pendingCount > 0
              ? `${pendingCount} offline records queued. Click to force sync attempt.`
              : isForcedOffline
              ? 'Simulation Offline Mode. Click to switch to Online.'
              : 'Disconnected from Internet. Click to reconnect / retry.'
          }
        >
          <FiWifiOff className="w-3.5 h-3.5 text-rose-600" />
          <span>Offline{pendingCount > 0 ? ` (${pendingCount} queued)` : ''}</span>
        </button>

        {isForcedOffline && (
          <button
            onClick={() => toggleForceOffline()}
            className="text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-200 px-1.5 py-1 rounded-md font-semibold border border-rose-300 cursor-pointer"
            title="Click to exit offline simulation"
          >
            Go Online
          </button>
        )}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={() => triggerSync()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold shadow-xs hover:bg-amber-100 transition-colors cursor-pointer"
        title="Click to sync pending offline records to central server"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
        <span>{pendingCount} Pending Sync</span>
        <FiRefreshCw className="w-3 h-3 text-amber-700 ml-0.5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => toggleForceOffline()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-2xs hover:bg-emerald-100 transition-all cursor-pointer"
      title="Connected to Server. Click to test / switch to Offline Mode."
    >
      <FiWifi className="w-3.5 h-3.5 text-emerald-600" />
      <span>Online</span>
    </button>
  );
};

export default SyncStatusBadge;
