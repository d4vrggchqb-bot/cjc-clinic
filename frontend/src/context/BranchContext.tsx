import React, { createContext, useContext, useState, useEffect } from 'react';

interface BranchContextType {
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  displayBranch: string;
  userRole: string;
  setUserRole: (role: string) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode; user?: any }> = ({ children, user }) => {
  const [userRole, setUserRole] = useState<string>(user?.role || '');
  const [userBranch, setUserBranch] = useState<string>(user?.clinic_branch || 'College Clinic');
  
  const [selectedBranch, setSelectedBranchState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('cjc_selected_branch');
      if (saved) return saved;
    } catch {}
    return 'All Branches';
  });

  useEffect(() => {
    if (user?.role) setUserRole(user.role);
    if (user?.clinic_branch) setUserBranch(user.clinic_branch);
  }, [user]);

  const setSelectedBranch = (branch: string) => {
    setSelectedBranchState(branch);
    try {
      localStorage.setItem('cjc_selected_branch', branch);
    } catch {}
  };

  const displayBranch = userRole === 'Superadmin'
    ? selectedBranch
    : (userBranch || 'College Clinic');

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      setSelectedBranch,
      displayBranch,
      userRole,
      setUserRole
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
