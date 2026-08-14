import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, resolveValue, Toast } from 'react-hot-toast';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { apiFetch } from './utils/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import Consultation from './pages/Consultation';
import Layout from './components/Layout';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Appointments from './pages/Appointments';
import Reports from './pages/Reports';
import Borrowings from './pages/Borrowings';
import { ConfirmProvider } from './context/ConfirmContext';
import { SyncProvider } from './context/SyncContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsAuthenticated(prev => (prev === null ? false : prev));
      }
    }, 3500);

    apiFetch('/api/index.php?action=check_session')
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success) {
          setIsAuthenticated(true);
          setUser(res.user);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsAuthenticated(false);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout user={user}>{children}</Layout>;
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="px-5 py-5 w-full h-full flex flex-col">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-[#A5192D] tracking-tight mb-1">{title}</h1>
      <p className="text-slate-400 text-sm font-medium">Under construction</p>
    </div>
    
    <div className="bg-white rounded-md shadow-sm border border-slate-100 p-8 flex flex-col items-center justify-center flex-1 min-h-[400px]">
      <span className="text-4xl block mb-4">🚧</span>
      <h3 className="text-xl font-bold text-slate-800">{title} Module</h3>
      <p className="text-slate-500 mt-2">Currently being built into a modern React component.</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <SyncProvider>
      <ConfirmProvider>
        <Toaster position="top-center">
          {(t: Toast) => {
            const isError = t.type === 'error';
            const isSuccess = t.type === 'success';
            const iconBg = isError ? 'bg-red-100' : isSuccess ? 'bg-emerald-100' : 'bg-blue-100';
            const iconColor = isError ? 'text-red-600' : isSuccess ? 'text-emerald-600' : 'text-blue-600';
            const title = isError ? 'Error' : isSuccess ? 'Success' : 'Notice';
            
            return (
              <div
                className={`${
                  t.visible ? 'animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300' : 'animate-out fade-out zoom-out-95 slide-out-to-top-4 duration-200'
                } max-w-sm w-full bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] rounded-2xl pointer-events-auto flex overflow-hidden border border-slate-100/60`}
              >
                <div className="p-4 px-5 w-full">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                      {isError ? <FiAlertTriangle className={`w-5 h-5 ${iconColor}`} /> : isSuccess ? <FiCheckCircle className={`w-5 h-5 ${iconColor}`} /> : <FiInfo className={`w-5 h-5 ${iconColor}`} />}
                    </div>
                    <div className="flex-1 mt-0.5">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight mb-1">{title}</h3>
                      <p className="text-sm text-slate-500 font-medium">{resolveValue(t.message, t)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        </Toaster>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/patients" element={<ProtectedRoute allowedRoles={['Admin', 'Staff', 'Doctor', 'Nurse']}><PatientList /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute allowedRoles={['Admin', 'Staff', 'Doctor', 'Nurse']}><Appointments /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute allowedRoles={['Admin', 'Staff', 'Doctor', 'Nurse']}><Inventory /></ProtectedRoute>} />
            <Route path="/consultation" element={<ProtectedRoute allowedRoles={['Admin', 'Staff', 'Doctor', 'Nurse']}><Consultation /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['Superadmin', 'Admin', 'Staff', 'Doctor', 'Nurse']}><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['Superadmin']}><Settings /></ProtectedRoute>} />
            <Route path="/borrowings" element={<ProtectedRoute allowedRoles={['Admin', 'Staff', 'Doctor', 'Nurse']}><Borrowings /></ProtectedRoute>} />
            
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </SyncProvider>
  );
};

export default App;
