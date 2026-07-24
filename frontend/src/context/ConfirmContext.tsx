import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FiAlertTriangle, FiInfo, FiCheckCircle, FiX } from 'react-icons/fi';

type ConfirmType = 'info' | 'warning' | 'danger';

interface ConfirmOptions {
  title: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={handleCancel}></div>
          <div className="bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-sm overflow-hidden z-10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-white/20">
            <div className="p-8 pb-6 flex flex-col items-center text-center">
              <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center mb-5 shadow-inner ${currentStyles.iconBg}`}>
                {React.cloneElement(currentStyles.icon as React.ReactElement, { className: 'w-8 h-8 ' + (currentStyles.icon as any).props.className.replace('w-6 h-6', '') })}
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 leading-tight mb-2 tracking-tight">{options.title}</h3>
              <p className="text-[15px] text-slate-500 font-medium leading-relaxed">{options.message}</p>
            </div>
            <div className="bg-slate-50/80 px-6 py-5 flex gap-3 justify-center border-t border-slate-100">
              {!options.hideCancel && (
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[15px] font-bold hover:bg-slate-50 hover:text-slate-900 transition-all focus:outline-none focus:ring-4 focus:ring-slate-100 shadow-sm active:scale-95"
                >
                  {options.cancelText || 'Cancel'}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-3 text-white rounded-xl text-[15px] font-bold transition-all focus:outline-none focus:ring-4 ring-opacity-50 ${currentStyles.btnBg} shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95`}
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
