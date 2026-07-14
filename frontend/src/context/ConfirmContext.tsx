import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FiAlertTriangle, FiInfo, FiCheckCircle, FiX } from 'react-icons/fi';

type ConfirmType = 'info' | 'warning' | 'danger';

interface ConfirmOptions {
  title: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

interface ConfirmProviderProps {
  children: ReactNode;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = (opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    if (resolvePromise) resolvePromise(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolvePromise) resolvePromise(false);
    setIsOpen(false);
  };

  const getTypeStyles = (type: ConfirmType = 'info') => {
    switch (type) {
      case 'danger':
        return {
          icon: <FiAlertTriangle className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-100',
          btnBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        };
      case 'warning':
        return {
          icon: <FiAlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-100',
          btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
        };
      case 'info':
      default:
        return {
          icon: <FiInfo className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
          btnBg: 'bg-[#C01D38] hover:bg-[#a0182f] focus:ring-[#C01D38]',
        };
    }
  };

  const currentStyles = options ? getTypeStyles(options.type) : getTypeStyles('info');

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={handleCancel}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden z-10 animate-in zoom-in-95 fade-in duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${currentStyles.iconBg}`}>
                  {currentStyles.icon}
                </div>
                <div className="flex-1 mt-1">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2">{options.title}</h3>
                  <p className="text-sm text-slate-500 font-medium">{options.message}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${currentStyles.btnBg}`}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
