import React, { createContext, useContext, useState, useEffect } from 'react';

export const ALL_BRANCHES = [
  'College Clinic',
  'Basic Education Clinic',
  'Power Campus Clinic'
];

export interface BranchContextType {
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  displayBranch: string;
  userRole: string;
  setUserRole: (role: string) => void;
  userBranch: string;
  isSuperAdmin: boolean;
  availableBranches: string[];
  currentUser?: any;
  currentUserName: string;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode; user?: any }> = ({ children, user }) => {
  const [currentUser, setCurrentUser] = useState<any>(user || null);
  const [userRole, setUserRole] = useState<string>(user?.role || '');
  const [userBranch, setUserBranch] = useState<string>(user?.clinic_branch || 'College Clinic');
  
  const isSuperAdmin = (user?.role || userRole).toLowerCase() === 'superadmin';

  const [selectedBranch, setSelectedBranchState] = useState<string>(() => {
    if (!isSuperAdmin) {
      return user?.clinic_branch || 'College Clinic';
    }
    try {
      const saved = localStorage.getItem('cjc_selected_branch');
      if (saved) return saved;
    } catch {}
    return 'All Branches';
  });

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
      if (user.role) setUserRole(user.role);
      if (user.clinic_branch) {
        setUserBranch(user.clinic_branch);
        if (user.role?.toLowerCase() !== 'superadmin') {
          setSelectedBranchState(user.clinic_branch);
        }
      }
    }
  }, [user]);

  const setSelectedBranch = (branch: string) => {
    if (!isSuperAdmin) {
      // Non-superadmin is strictly locked to their assigned branch
      setSelectedBranchState(userBranch);
      return;
    }
    setSelectedBranchState(branch);
    try {
      localStorage.setItem('cjc_selected_branch', branch);
    } catch {}
  };

  const displayBranch = isSuperAdmin
    ? selectedBranch
    : (userBranch || 'College Clinic');

  const availableBranches = isSuperAdmin
    ? ['All Branches', ...ALL_BRANCHES]
    : [userBranch || 'College Clinic'];

  const currentUserName = currentUser?.name || currentUser?.username || '';

  return (
    <BranchContext.Provider value={{
      selectedBranch: isSuperAdmin ? selectedBranch : userBranch,
      setSelectedBranch,
      displayBranch,
      userRole,
      setUserRole,
      userBranch,
      isSuperAdmin,
      availableBranches,
      currentUser,
      currentUserName
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
