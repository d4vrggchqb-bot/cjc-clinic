import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { FiX, FiPlus, FiPackage, FiCalendar, FiTag, FiHash } from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clinicBranch?: string;
}

const AddMedicineModal: React.FC<AddMedicineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clinicBranch = 'College Clinic'
}) => {
  const { confirm } = useConfirm();
  const [submitting, setSubmitting] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const curMonth = today.getMonth() + 1;
  const curYear = today.getFullYear();
  const defaultCurrentSY = curMonth >= 8 ? `${curYear}-${curYear + 1}` : `${curYear - 1}-${curYear}`;
  const defaultCurrentSem = (curMonth >= 8 || curMonth <= 12) ? '1st Semester' : (curMonth >= 1 && curMonth <= 5 ? '2nd Semester' : 'Summer');

  // Form State matching Page 2
  const [formData, setFormData] = useState({
    generic_name: '',
    brand_name: '',
    dosage: '',
    lot_number: '',
    quantity: 50,
    date_arrived: todayStr,
    expired_on: '',
    restock_semester: defaultCurrentSem,
    school_year: defaultCurrentSY,
    clinic_branch: clinicBranch || 'College Clinic',
    category: 'medicine'
  });

  React.useEffect(() => {
    if (clinicBranch) {
      setFormData(prev => ({ ...prev, clinic_branch: clinicBranch }));
    }
  }, [clinicBranch, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.brand_name.trim()) {
      alert('Please enter a brand name.');
      return;
    }

    if (!formData.expired_on) {
      alert('Please specify an expiration date.');
      return;
    }

    if (formData.quantity <= 0) {
      alert('Quantity must be greater than 0.');
      return;
    }

    const confirmed = await confirm({
      title: 'Add New Medicine Stock',
      message: `Are you sure you want to add ${formData.quantity} units of ${formData.brand_name} to Main Inventory?`,
      confirmLabel: 'Add Medicine'
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/index.php?route=inventory&action=add_medicine', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (res.success) {
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          generic_name: '',
          brand_name: '',
          dosage: '',
          lot_number: '',
          quantity: 50,
          date_arrived: new Date().toISOString().split('T')[0],
          expired_on: '',
          restock_semester: defaultCurrentSem,
          school_year: defaultCurrentSY,
          clinic_branch: clinicBranch || 'College Clinic',
          category: 'medicine'
        });
      } else {
        alert(res.error || 'Failed to add medicine stock.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving medicine.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Modal Header matching Clinic Page 2 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FiPlus className="text-[#A5192D]" /> Add New Medicine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Stock will be initially stored in Main Inventory bulk pool.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="brand_name"
                value={formData.brand_name}
                onChange={handleChange}
                placeholder="e.g. Biogesic, Neozep"
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* Dosage / Strength */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dosage / Strength
              </label>
              <input
                type="text"
                name="dosage"
                value={formData.dosage}
                onChange={handleChange}
                placeholder="e.g. 500mg, 10ml, 5mg/5ml"
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* Medicine Name (Generic) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Generic Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="generic_name"
                value={formData.generic_name}
                onChange={handleChange}
                placeholder="e.g. Paracetamol, Amoxicillin, Ibuprofen (Optional)"
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* LOT Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                LOT / Batch No.
              </label>
              <input
                type="text"
                name="lot_number"
                value={formData.lot_number}
                onChange={handleChange}
                placeholder="e.g. LOT-2025-001"
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity (Units) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="quantity"
                min={1}
                value={formData.quantity}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* Date Arrived / Received */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <FiCalendar className="text-slate-400" /> Date Arrived / Received <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="date_arrived"
                value={formData.date_arrived}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <FiCalendar className="text-rose-400" /> Expiration Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="expired_on"
                value={formData.expired_on}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>

            {/* Restock Semester */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Restock Semester
              </label>
              <select
                name="restock_semester"
                value={formData.restock_semester}
                onChange={handleChange}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-[#A5192D]"
              >
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
                <option value="Summer">Summer</option>
              </select>
            </div>

            {/* School Year */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Year
              </label>
              <input
                type="text"
                name="school_year"
                value={formData.school_year}
                onChange={handleChange}
                placeholder="2025-2026"
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#A5192D] focus:ring-1 focus:ring-[#A5192D]"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#A5192D] hover:bg-[#8c1526] rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <FiPlus className="text-sm" />
              {submitting ? 'Saving...' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMedicineModal;
