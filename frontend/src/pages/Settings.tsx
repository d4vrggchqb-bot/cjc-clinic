import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { FiSettings, FiBookOpen, FiActivity, FiUsers, FiUpload, FiDownload, FiInfo, FiPlus, FiTrash2, FiSave, FiHardDrive, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

export default function Settings() {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('academic');
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Staff', clinic_branch: 'College Clinic' });
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
            bed_departments: Array.isArray(res.settings.bed_departments) ? res.settings.bed_departments : [],
            bed_programs: Array.isArray(res.settings.bed_programs) ? res.settings.bed_programs : [],
            bed_year_levels: Array.isArray(res.settings.bed_year_levels) ? res.settings.bed_year_levels : [],
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

  const handleArrayEdit = (key: string, oldVal: string, newVal: string) => {
    if (!newVal.trim() || oldVal === newVal) return;
    const currentArray = settings[key] || [];
    const updatedArray = currentArray.map((v: string) => v === oldVal ? newVal.trim() : v);
    const updated = { ...settings, [key]: updatedArray };
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
    if (!newUser.username) return alert('Email / Username is required');
    try {
      const res = await apiFetch('/api/index.php?route=auth&action=create_user', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      if (res.success) {
        setNewUser({ username: '', password: '', role: 'Staff', clinic_branch: 'College Clinic' });
        fetchUsers();
      } else {
        alert(res.error || res.message || 'Failed to add user');
      }
    } catch (e) { alert('Failed to add user'); }
  };

  const handleDeleteUser = async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user?',
      type: 'danger'
    });
    if (!confirmed) return;
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
  const handleBackupDb = async () => {
    const confirmed = await confirm({
      title: 'Backup Database',
      message: 'Are you sure you want to backup the database now?',
      type: 'info'
    });
    if (!confirmed) return;
    try {
      const res = await apiFetch('/api/index.php?route=settings&action=backup_db', { method: 'POST' });
      alert(res.message);
    } catch (e) { alert('Backup failed'); }
  };

  const handleSaveSettings = async () => {
    const confirmed = await confirm({
      title: 'Save Settings',
      message: 'Are you sure you want to save these settings?',
      type: 'info'
    });
    if (!confirmed) return;
    await saveSettings({ school_year: settings.school_year });
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
                    onClick={handleSaveSettings}
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
                onEdit={(oldVal, newVal) => handleArrayEdit('departments', oldVal, newVal)}
              />

              {/* Courses */}
              <ConfigListEditor 
                title="Courses / Programs (College)" 
                description="Course names shown in the Course dropdown when enrolling a patient (e.g. BSCS, BSN)."
                items={settings.courses}
                onAdd={(v) => handleArrayAdd('courses', v)}
                onRemove={(v) => handleArrayRemove('courses', v)}
                onEdit={(oldVal, newVal) => handleArrayEdit('courses', oldVal, newVal)}
              />

              {/* BED Config */}
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h2 className="text-xl font-bold text-[#8c1526] mb-4">Basic Education (BED) Setup</h2>
                <div className="space-y-6">
                  <ConfigListEditor 
                    title="BED Departments" 
                    description="Departments for BED (e.g. BED Department)."
                    items={settings.bed_departments}
                    onAdd={(v) => handleArrayAdd('bed_departments', v)}
                    onRemove={(v) => handleArrayRemove('bed_departments', v)}
                    onEdit={(oldVal, newVal) => handleArrayEdit('bed_departments', oldVal, newVal)}
                  />
                  <ConfigListEditor 
                    title="BED Programs" 
                    description="Programs for BED (e.g. Senior High School, Grade School)."
                    items={settings.bed_programs}
                    onAdd={(v) => handleArrayAdd('bed_programs', v)}
                    onRemove={(v) => handleArrayRemove('bed_programs', v)}
                    onEdit={(oldVal, newVal) => handleArrayEdit('bed_programs', oldVal, newVal)}
                  />
                  <ConfigListEditor 
                    title="BED Year/Grade Levels" 
                    description="Year or Grade levels for BED (e.g. Grade 11, Grade 12)."
                    items={settings.bed_year_levels}
                    onAdd={(v) => handleArrayAdd('bed_year_levels', v)}
                    onRemove={(v) => handleArrayRemove('bed_year_levels', v)}
                    onEdit={(oldVal, newVal) => handleArrayEdit('bed_year_levels', oldVal, newVal)}
                  />
                </div>
              </div>
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
              onEdit={(oldVal, newVal) => handleArrayEdit('cues', oldVal, newVal)}
            />
          )}

          {/* USER ACCOUNTS TAB */}
          {activeTab === 'users' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-[#8c1526] font-bold text-lg mb-2">System Users</h3>
                <p className="text-slate-500 text-sm mb-4">Accounts that can log in to CJC-Clinic+.</p>
                
                <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                  <input type="text" placeholder="Google Email (@g.cjc.edu.ph)" className="border px-2 py-1 text-sm rounded flex-1" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})}/>
                  <input type="password" placeholder="Password (Optional)" className="border px-2 py-1 text-sm rounded flex-1" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})}/>
                  <select className="border px-2 py-1 text-sm rounded" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
                    <option>Staff</option>
                    <option>Nurse</option>
                    <option>Doctor</option>
                    <option>Admin</option>
                    <option>Superadmin</option>
                  </select>
                  <select className="border px-2 py-1 text-sm rounded" value={newUser.clinic_branch || 'College Clinic'} onChange={e=>setNewUser({...newUser, clinic_branch: e.target.value})}>
                    <option>College Clinic</option>
                    <option>Basic Education Clinic</option>
                    <option>Power Campus Clinic</option>
                  </select>
                  <button onClick={handleAddUser} className="bg-[#28a745] text-white px-3 py-1 rounded text-sm font-bold">+ Add User</button>
                </div>

                <table className="w-full text-left text-sm border-collapse border border-slate-200">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 font-bold">Email / Username</th>
                      <th className="px-4 py-2 font-bold">Role</th>
                      <th className="px-4 py-2 font-bold">Branch</th>
                      <th className="px-4 py-2 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2">{u.username}</td>
                        <td className="px-4 py-2">{u.role}</td>
                        <td className="px-4 py-2 text-slate-500">{u.clinic_branch || 'College Clinic'}</td>
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
                  <button onClick={handleBackupDb} className="bg-[#8c1526] hover:bg-[#7a1221] text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-sm">
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
const ConfigListEditor = ({ title, description, items = [], onAdd, onRemove, onEdit }: any) => {
  const [val, setVal] = useState('');
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editVal, setEditVal] = useState('');
  const { confirm } = useConfirm();

  const handleAdd = async () => {
    if (!val.trim()) return;
    const confirmed = await confirm({
      title: 'Add Item',
      message: `Are you sure you want to add "${val.trim()}" to ${title}?`,
      type: 'info'
    });
    if (confirmed) {
      onAdd(val);
      setVal('');
    }
  };

  const handleDelete = async (item: string) => {
    const confirmed = await confirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item}" from ${title}?`,
      type: 'danger'
    });
    if (confirmed) {
      onRemove(item);
    }
  };

  const handleEditSave = async (oldItem: string) => {
    if (!editVal.trim() || editVal === oldItem) {
      setEditingIdx(-1);
      return;
    }
    const confirmed = await confirm({
      title: 'Save Changes',
      message: `Are you sure you want to change "${oldItem}" to "${editVal.trim()}"?`,
      type: 'info'
    });
    if (confirmed) {
      onEdit(oldItem, editVal);
      setEditingIdx(-1);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h3 className="text-[#8c1526] font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-4">{description}</p>
      
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={val} 
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`e.g. Add to ${title}...`}
          className="border border-slate-300 rounded px-3 py-1.5 focus:border-[#007bff] focus:outline-none w-64 text-sm"
        />
        <button 
          onClick={handleAdd}
          disabled={!val.trim()}
          className="bg-[#007bff] hover:bg-[#0069d9] text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
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
              {editingIdx === idx ? (
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text"
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEditSave(item);
                      if (e.key === 'Escape') setEditingIdx(-1);
                    }}
                    autoFocus
                    className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 focus:border-[#007bff] focus:outline-none"
                  />
                  <button onClick={() => handleEditSave(item)} className="text-green-600 hover:bg-green-100 p-1 rounded transition-colors"><FiCheck /></button>
                  <button onClick={() => setEditingIdx(-1)} className="text-red-500 hover:bg-red-100 p-1 rounded transition-colors"><FiX /></button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-bold text-slate-700">{item}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingIdx(idx); setEditVal(item); }}
                      className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      onClick={() => handleDelete(item)}
                      className="text-red-500 hover:text-red-700 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
