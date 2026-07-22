import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FiSettings, FiBookOpen, FiActivity, FiUsers, FiUpload, FiDownload, FiInfo, FiPlus, FiTrash2, FiSave, FiHardDrive, FiEdit2, FiCheck, FiX, FiChevronRight, FiChevronDown } from 'react-icons/fi';
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
            departments_hierarchy: Array.isArray(res.settings.departments_hierarchy) ? res.settings.departments_hierarchy : [],
            bed_hierarchy: Array.isArray(res.settings.bed_hierarchy) ? res.settings.bed_hierarchy : [],
            college_year_levels: Array.isArray(res.settings.college_year_levels) ? res.settings.college_year_levels : [],
            cues: Array.isArray(res.settings.cues) ? res.settings.cues : [],
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const saveSettings = async (newSettings: any) => {
    try {
      const res = await apiFetch('/api/index.php?route=settings&action=update', {
        method: 'POST',
        body: JSON.stringify(newSettings)
      });
      if (res && res.success === false) {
        alert('Failed to save settings: ' + (res.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Failed to save settings due to a network error.');
    }
  };

  // FLAT ARRAY HANDLERS (for cues, college_year_levels)
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

  // HIERARCHY HANDLERS
  const handleHierarchySave = (key: string, newHierarchy: any[]) => {
    const updated = { ...settings, [key]: newHierarchy };
    setSettings(updated);
    saveSettings({ [key]: newHierarchy });
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

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {activeTab === 'academic' && (
            <>
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

              {/* Hierarchical Editor for College Departments and Programs */}
              <HierarchyEditor
                title="College Departments & Programs"
                description="Manage colleges and their respective Bachelor's degrees."
                items={settings.departments_hierarchy}
                parentKey="department"
                childKey="programs"
                childLabel="Program"
                onSave={(newHierarchy) => handleHierarchySave('departments_hierarchy', newHierarchy)}
              />

              {/* College Year Levels - Flat Array */}
              <ConfigListEditor 
                title="Year Levels (College)" 
                description="Year levels shown when enrolling a College patient (e.g. 1st Year, 2nd Year)."
                items={settings.college_year_levels}
                onAdd={(v) => handleArrayAdd('college_year_levels', v)}
                onRemove={(v) => handleArrayRemove('college_year_levels', v)}
                onEdit={(oldVal, newVal) => handleArrayEdit('college_year_levels', oldVal, newVal)}
              />

              {/* BED Config - Hierarchical */}
              <div className="mt-8 border-t border-slate-200 pt-6">
                <HierarchyEditor
                  title="Basic Education (BED) Setup"
                  description="Manage BED Programs (e.g., Grade School, Junior High School) and their specific Year Levels."
                  items={settings.bed_hierarchy}
                  parentKey="program"
                  childKey="year_levels"
                  childLabel="Year Level"
                  onSave={(newHierarchy) => handleHierarchySave('bed_hierarchy', newHierarchy)}
                />
              </div>
            </>
          )}

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

// Flat Array Editor Component
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


// Master-Detail Hierarchy Editor Component
const HierarchyEditor = ({ title, description, items = [], parentKey, childKey, childLabel, onSave }: any) => {
  const [val, setVal] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(-1);
  const { confirm } = useConfirm();

  const handleAddParent = async () => {
    if (!val.trim()) return;
    const exists = items.some((i: any) => i[parentKey].toLowerCase() === val.trim().toLowerCase());
    if (exists) return alert('This item already exists.');

    const confirmed = await confirm({
      title: 'Add Category',
      message: `Are you sure you want to add "${val.trim()}"?`,
      type: 'info'
    });
    if (confirmed) {
      const newItems = [...items, { [parentKey]: val.trim(), [childKey]: [] }];
      onSave(newItems);
      setVal('');
    }
  };

  const handleDeleteParent = async (idx: number, parentName: string) => {
    const confirmed = await confirm({
      title: 'Delete Category',
      message: `Are you sure you want to completely delete "${parentName}" and ALL of its nested items? This cannot be undone.`,
      type: 'danger'
    });
    if (confirmed) {
      const newItems = [...items];
      newItems.splice(idx, 1);
      onSave(newItems);
      if (expandedIdx === idx) setExpandedIdx(-1);
    }
  };

  const handleAddChild = async (parentIdx: number, parentName: string, childVal: string) => {
    if (!childVal.trim()) return;
    const parentObj = items[parentIdx];
    if (parentObj[childKey].includes(childVal.trim())) return alert('Item already exists.');

    const confirmed = await confirm({
      title: `Add ${childLabel}`,
      message: `Are you sure you want to add "${childVal.trim()}" to "${parentName}"?`,
      type: 'info'
    });
    if (confirmed) {
      const newItems = [...items];
      newItems[parentIdx][childKey].push(childVal.trim());
      onSave(newItems);
    }
  };

  const handleDeleteChild = async (parentIdx: number, childIdx: number, parentName: string, childName: string) => {
    const confirmed = await confirm({
      title: `Delete ${childLabel}`,
      message: `Are you sure you want to delete "${childName}" from "${parentName}"?`,
      type: 'danger'
    });
    if (confirmed) {
      const newItems = [...items];
      newItems[parentIdx][childKey].splice(childIdx, 1);
      onSave(newItems);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h3 className="text-[#8c1526] font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-4">{description}</p>
      
      {/* Add Parent */}
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={val} 
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddParent()}
          placeholder={`Add new category...`}
          className="border border-slate-300 rounded px-3 py-1.5 focus:border-[#007bff] focus:outline-none w-64 text-sm"
        />
        <button 
          onClick={handleAddParent}
          disabled={!val.trim()}
          className="bg-[#007bff] hover:bg-[#0069d9] text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
        >
          <FiPlus /> Add
        </button>
      </div>

      <div className="border border-slate-200 rounded bg-slate-50">
        {items.length === 0 ? (
          <div className="p-3 text-sm text-slate-400 bg-white">No categories found.</div>
        ) : (
          items.map((item: any, idx: number) => {
            const isExpanded = expandedIdx === idx;
            const parentName = item[parentKey];
            const children = item[childKey] || [];
            return (
              <div key={idx} className="border-b border-slate-200 last:border-0 bg-white">
                <div 
                  className={`flex justify-between items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                  onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <FiChevronDown className="text-slate-400" /> : <FiChevronRight className="text-slate-400" />}
                    <span className="font-bold text-slate-800">{parentName}</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{children.length} {childLabel}s</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteParent(idx, parentName); }}
                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                    title="Delete Category"
                  >
                    <FiTrash2 />
                  </button>
                </div>
                
                {isExpanded && (
                  <div className="pl-8 pr-4 pb-4 pt-2 bg-slate-50/50">
                    <ChildEditor 
                      parentName={parentName}
                      childrenItems={children}
                      childLabel={childLabel}
                      onAdd={(childVal) => handleAddChild(idx, parentName, childVal)}
                      onRemove={(childIdx, childName) => handleDeleteChild(idx, childIdx, parentName, childName)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const ChildEditor = ({ parentName, childrenItems, childLabel, onAdd, onRemove }: any) => {
  const [val, setVal] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input 
          type="text" 
          value={val} 
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && val.trim()) {
              onAdd(val);
              setVal('');
            }
          }}
          placeholder={`Add ${childLabel} under ${parentName}...`}
          className="border border-slate-300 rounded px-2 py-1 text-sm focus:border-[#007bff] focus:outline-none flex-1"
        />
        <button 
          onClick={() => { onAdd(val); setVal(''); }}
          disabled={!val.trim()}
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded text-sm font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <FiPlus /> Add
        </button>
      </div>

      <div className="grid grid-cols-1 gap-1">
        {childrenItems.length === 0 ? (
          <div className="text-xs text-slate-400 italic">No items yet.</div>
        ) : (
          childrenItems.map((child: string, cIdx: number) => (
            <div key={cIdx} className="flex justify-between items-center bg-white border border-slate-200 p-1.5 px-3 rounded shadow-sm group">
              <span className="text-sm text-slate-700">{child}</span>
              <button 
                onClick={() => onRemove(cIdx, child)}
                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FiX />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
