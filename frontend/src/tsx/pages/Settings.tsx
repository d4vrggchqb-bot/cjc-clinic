import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import { FiSettings, FiBookOpen, FiActivity, FiUsers, FiUpload, FiDownload, FiInfo, FiPlus, FiTrash2, FiSave, FiHardDrive } from 'react-icons/fi';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('academic');
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Staff' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = () => {
    apiFetch('/api/index.php?route=settings&action=get')
      .then(res => {
        if (res.settings) {
          setSettings({
            school_year: res.settings.school_year || '',
            departments: Array.isArray(res.settings.departments) ? res.settings.departments : [],
            courses: Array.isArray(res.settings.courses) ? res.settings.courses : [],
            cues: Array.isArray(res.settings.cues) ? res.settings.cues : [],
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const saveSettings = async (newSettings: any) => {
    try {
      await apiFetch('/api/index.php?route=settings&action=update', {
        method: 'POST',
        body: JSON.stringify(newSettings)
      });
      // Optionally show a toast here
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  const handleArrayAdd = (key: string, value: string) => {
    if (!value.trim()) return;
    const currentArray = settings[key] || [];
    if (!currentArray.includes(value.trim())) {
      const updated = { ...settings, [key]: [...currentArray, value.trim()] };
      setSettings(updated);
      saveSettings({ [key]: updated[key] });
    }
  };

  const handleArrayRemove = (key: string, valueToRemove: string) => {
    const currentArray = settings[key] || [];
    const updated = { ...settings, [key]: currentArray.filter((v: string) => v !== valueToRemove) };
    setSettings(updated);
    saveSettings({ [key]: updated[key] });
  };

  // User Management
  const fetchUsers = () => {
    apiFetch('/api/index.php?route=auth&action=users')
      .then(res => { if (res.users) setUsers(res.users); })
      .catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return alert('Username and password required');
    try {
      const res = await apiFetch('/api/index.php?route=auth&action=create_user', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      if (res.success) {
        setNewUser({ username: '', password: '', role: 'Staff' });
        fetchUsers();
      } else {
        alert(res.message);
      }
    } catch (e) { alert('Failed to add user'); }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await apiFetch('/api/index.php?route=auth&action=delete_user', { method: 'POST', body: JSON.stringify({ id }) });
      fetchUsers();
    } catch (e) { alert('Failed to delete user'); }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) return alert('Passwords do not match!');
    try {
      const res = await apiFetch('/api/index.php?route=auth&action=change_password', {
        method: 'POST',
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.new })
      });
      if (res.success) {
        alert('Password changed successfully');
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        alert(res.message);
      }
    } catch (e) { alert('Failed to change password'); }
  };

  // CSV Import
  const handleImport = async () => {
    if (!file) return alert('Please select a file');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/index.php?route=settings&action=import', {
        method: 'POST',
        body: formData,
        // No Content-Type header so browser sets multipart boundary
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Import successful' : 'Import failed'));
      setFile(null);
    } catch (e) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Backup & Export
  const handleBackup = async () => {
    try {
      const res = await apiFetch('/api/index.php?route=settings&action=backup_db', { method: 'POST' });
      alert(res.message);
    } catch (e) { alert('Backup failed'); }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <div className="bg-white px-6 py-4 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#A5192D] tracking-tight mb-1">Settings</h1>
        <p className="text-slate-500 text-sm">Manage clinic configuration, accounts, and preferences</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-1 pt-2 shadow-sm z-10 relative">
        {[
          { id: 'academic', label: 'Academic Setup', icon: FiBookOpen },
          { id: 'clinical', label: 'Clinical Presets', icon: FiActivity },
          { id: 'users', label: 'User Accounts', icon: FiUsers },
          { id: 'import', label: 'Data Import', icon: FiUpload },
          { id: 'backup', label: 'Backup', icon: FiHardDrive },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-[#8c1526] text-[#8c1526] bg-red-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ACADEMIC SETUP TAB */}
          {activeTab === 'academic' && (
            <>
              {/* School Year */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-[#8c1526] font-bold text-lg mb-2">School Year</h3>
                <p className="text-slate-500 text-sm mb-4">The active school year shown on records and reports.</p>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700">School Year:</span>
                  <input 
                    type="text" 
                    value={settings.school_year} 
                    onChange={e => setSettings({...settings, school_year: e.target.value})}
                    className="border border-slate-300 rounded px-3 py-1.5 focus:border-[#8c1526] focus:outline-none"
                  />
                  <button 
                    onClick={() => saveSettings({ school_year: settings.school_year })}
                    className="bg-[#8c1526] text-white px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-[#7a1221]"
                  >
                    <FiSave /> Save
                  </button>
                </div>
              </div>

              {/* Departments */}
              <ConfigListEditor 
                title="Departments / Colleges" 
                description="Abbreviations shown in the College/Dept dropdown when enrolling a patient (e.g. CCIS, COE)."
                items={settings.departments}
                onAdd={(v) => handleArrayAdd('departments', v)}
                onRemove={(v) => handleArrayRemove('departments', v)}
              />

              {/* Courses */}
              <ConfigListEditor 
                title="Courses / Programs" 
                description="Course names shown in the Course dropdown when enrolling a patient (e.g. BSCS, BSN)."
                items={settings.courses}
                onAdd={(v) => handleArrayAdd('courses', v)}
                onRemove={(v) => handleArrayRemove('courses', v)}
              />
            </>
          )}

          {/* CLINICAL PRESETS TAB */}
          {activeTab === 'clinical' && (
            <ConfigListEditor 
              title="Cues Presets" 
              description="Cues nurses can select from when checking in a patient (e.g. Headache, Fever, Stomach Ache)."
              items={settings.cues}
              onAdd={(v) => handleArrayAdd('cues', v)}
              onRemove={(v) => handleArrayRemove('cues', v)}
            />
          )}

          {/* USER ACCOUNTS TAB */}
          {activeTab === 'users' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-[#8c1526] font-bold text-lg mb-2">System Users</h3>
                <p className="text-slate-500 text-sm mb-4">Accounts that can log in to CJC-Clinic+.</p>
                
                <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                  <input type="text" placeholder="Username" className="border px-2 py-1 text-sm rounded flex-1" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})}/>
                  <input type="password" placeholder="Password" className="border px-2 py-1 text-sm rounded flex-1" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})}/>
                  <select className="border px-2 py-1 text-sm rounded" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
                    <option>Staff</option>
                    <option>Nurse</option>
                    <option>Doctor</option>
                    <option>Admin</option>
                  </select>
                  <button onClick={handleAddUser} className="bg-[#28a745] text-white px-3 py-1 rounded text-sm font-bold">+ Add User</button>
                </div>

                <table className="w-full text-left text-sm border-collapse border border-slate-200">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr><th className="px-4 py-2 font-bold">Username</th><th className="px-4 py-2 font-bold">Role</th><th className="px-4 py-2 font-bold">Action</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2">{u.username}</td>
                        <td className="px-4 py-2">{u.role}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800 text-xs font-bold bg-red-50 px-2 py-1 rounded">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-[#8c1526] font-bold text-lg mb-4">Change My Password</h3>
                <div className="max-w-md space-y-3">
                  <div className="flex"><span className="w-1/3 text-sm font-bold text-slate-700 py-1.5">Current Password:</span> <input type="password" value={passwords.current} onChange={e=>setPasswords({...passwords, current: e.target.value})} className="flex-1 border rounded px-3 py-1.5 text-sm"/></div>
                  <div className="flex"><span className="w-1/3 text-sm font-bold text-slate-700 py-1.5">New Password:</span> <input type="password" value={passwords.new} onChange={e=>setPasswords({...passwords, new: e.target.value})} className="flex-1 border rounded px-3 py-1.5 text-sm"/></div>
                  <div className="flex"><span className="w-1/3 text-sm font-bold text-slate-700 py-1.5">Confirm Password:</span> <input type="password" value={passwords.confirm} onChange={e=>setPasswords({...passwords, confirm: e.target.value})} className="flex-1 border rounded px-3 py-1.5 text-sm"/></div>
                  <div className="flex pt-2">
                    <span className="w-1/3"></span>
                    <button onClick={handleChangePassword} className="bg-[#8c1526] text-white px-4 py-2 rounded text-sm font-bold">Change Password</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DATA IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-[#8c1526] font-bold text-lg mb-2">Import Enrollee List</h3>
              <p className="text-slate-500 text-sm mb-4">Import the registrar's enrollment list to automatically add new patients. Existing IDs will be skipped.</p>
              
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-md mb-6">
                <h4 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2"><FiInfo /> Required Column Order (Row 1 = Headers, data starts Row 2):</h4>
                <div className="grid grid-cols-2 text-xs text-amber-700 font-mono gap-y-1">
                  <div>A: Student/Employee ID</div><div>B: Last Name</div>
                  <div>C: First Name</div><div>D: Middle Initial</div>
                  <div>E: Gender (M/F)</div><div>F: Birthdate (YYYY-MM-DD)</div>
                  <div>G: Course</div><div>H: Year Level</div>
                  <div>I: College/Dept</div><div>J: Contact Number</div>
                  <div>K: Type (Student/Employee)</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  className="text-sm border border-slate-300 p-1.5 rounded w-64"
                />
                <button 
                  onClick={handleImport}
                  disabled={!file || uploading}
                  className="bg-[#8c1526] text-white px-4 py-2.5 rounded font-bold text-sm flex items-center gap-2 hover:bg-[#7a1221] disabled:opacity-50"
                >
                  <FiUpload /> {uploading ? 'Importing...' : 'Import Now'}
                </button>
              </div>
            </div>
          )}

          {/* BACKUP TAB */}
          {activeTab === 'backup' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-[#8c1526] font-bold text-lg mb-2">Manual Backup & Export</h3>
                <p className="text-slate-500 text-sm mb-4">Create a full database backup or export records as CSV.</p>
                
                <div className="flex gap-3">
                  <button onClick={handleBackup} className="bg-[#8c1526] hover:bg-[#7a1221] text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-sm">
                    <FiHardDrive /> Backup Database
                  </button>
                  <a href="/api/index.php?route=settings&action=export_health" className="bg-[#28a745] hover:bg-[#218838] text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-sm">
                    <FiDownload /> Export Health Records (CSV)
                  </a>
                  <a href="/api/index.php?route=settings&action=export_visits" className="bg-[#007bff] hover:bg-[#0069d9] text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-sm">
                    <FiDownload /> Export Visit Log (CSV)
                  </a>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// Reusable component for string array lists
const ConfigListEditor = ({ title, description, items = [], onAdd, onRemove }: any) => {
  const [val, setVal] = useState('');
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h3 className="text-[#8c1526] font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-4">{description}</p>
      
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={val} 
          onChange={e=>setVal(e.target.value)}
          placeholder={`e.g. Add to ${title}...`}
          className="border border-slate-300 rounded px-3 py-1.5 focus:border-[#007bff] focus:outline-none w-64 text-sm"
        />
        <button 
          onClick={() => { onAdd(val); setVal(''); }}
          className="bg-[#007bff] hover:bg-[#0069d9] text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 shadow-sm"
        >
          <FiPlus /> Add
        </button>
      </div>

      <div className="border border-slate-200 rounded max-h-48 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-3 text-sm text-slate-400">No items added yet.</div>
        ) : (
          items.map((item: string, idx: number) => (
            <div key={idx} className="flex justify-between items-center p-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
              <span className="text-sm font-bold text-slate-700">{item}</span>
              <button 
                onClick={() => onRemove(item)}
                className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                <FiTrash2 />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
