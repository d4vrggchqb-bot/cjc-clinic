import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiCheckCircle, FiPackage, FiUser, FiBox, FiBriefcase, FiSearch,
  FiPrinter, FiClock, FiAlertTriangle, FiChevronRight, FiX, FiRotateCcw,
  FiCalendar, FiInfo, FiEye, FiInbox
} from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';
import { useBranch } from '../context/BranchContext';

/* ─────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────── */
interface BorrowedItemDetail {
  borrowed_item_id: number;
  inventory_item_id: number;
  generic_name: string;
  brand_name: string;
  category: string;
  quantity: number;
  item_type: 'equipment' | 'supply';
  status: 'borrowed' | 'returned' | 'dispensed';
  stock_reserved: boolean;
  quantity_returned: number | null;
  quantity_consumed: number | null;
  item_returned_at: string | null;
  condition_status?: 'good' | 'damaged' | 'lost';
  settlement_action?: 'none' | 'to_replace' | 'to_pay' | 'replaced' | 'paid';
  settlement_notes?: string | null;
  charge_amount?: number | null;
  settled_at?: string | null;
  batch_id?: number | null;
  batch_number?: string | null;
}

interface BorrowingDetail {
  borrowing_id: number;
  booking_code: string;
  purpose: string;
  clinic_branch?: string | null;
  borrowing_status: 'active' | 'returned';
  expected_return_date: string | null;
  created_at: string;
  returned_at: string | null;
  is_overdue: boolean;
  first_name: string;
  last_name: string;
  course: string;
  year_level: string;
  profile_type: string;
  department: string;
  items: BorrowedItemDetail[];
}

interface CheckedOutRow {
  borrowing_id: number;
  booking_code: string;
  purpose: string;
  clinic_branch?: string | null;
  expected_return_date: string | null;
  created_at: string;
  is_overdue: boolean;
  is_due_soon: boolean;
  first_name: string;
  last_name: string;
  course: string;
  year_level: string;
  profile_type: string;
  department: string;
  items: BorrowedItemDetail[];
}

/* ─────────────────────────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────────────────────────── */
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}
function fmtDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────
   Official CJC Slip Header
───────────────────────────────────────────────────────────────── */
interface OfficialHeaderProps {
  indexNo: string;
  revisionNo: string;
  effectiveDate: string;
  controlNo: string;
  variant?: 'standard' | 'compact';
}

const OfficialHeader: React.FC<OfficialHeaderProps> = ({
  indexNo,
  revisionNo,
  effectiveDate,
  controlNo,
  variant = 'standard'
}) => {
  const isCompact = variant === 'compact';

  return (
    <div className={`relative w-full select-none ${isCompact ? 'mb-1.5' : 'mb-3'}`}>
      {/* Official Header Letterhead */}
      <img src="/med_cert_header.png" alt="CJC Header" className="w-full h-auto block" />

      {/* Control Box Overlay Covering the Image's Right Control Box */}
      <div className="absolute top-[3%] right-[0.2%] w-[17.8%] h-[46%] z-10 overflow-visible">
        {isCompact ? (
          <div className="w-[300%] h-[300%] scale-[0.333] origin-top-left bg-white border border-slate-900 flex flex-col justify-evenly px-1.5 py-0.5 font-sans leading-none shadow-xs">
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[12px] font-semibold">Index:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-extrabold pb-0.5 text-[12px]">{indexNo}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[12px] font-semibold">Rev:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-extrabold pb-0.5 text-[12px]">{revisionNo}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[12px] font-semibold">Date:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-0.5 whitespace-nowrap tracking-tighter text-[12px]">{effectiveDate}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[11px] font-semibold">Ctrl:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-0.5 whitespace-nowrap tracking-tighter text-[11px]">{controlNo}</span>
            </div>
          </div>
        ) : (
          <div className="w-[200%] h-[200%] scale-50 origin-top-left bg-white border border-slate-900 flex flex-col justify-evenly px-2 py-1 font-sans leading-none shadow-xs">
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[13px] font-semibold">Index No.:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-extrabold pb-0.5 text-[13px]">{indexNo}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[13px] font-semibold">Revision No.:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-extrabold pb-0.5 text-[13px]">{revisionNo}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[13px] font-semibold">Effective Date:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-0.5 whitespace-nowrap tracking-tighter text-[13px]">{effectiveDate}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="text-slate-800 whitespace-nowrap text-[12px] font-semibold">Control No.:</span>
              <span className="border-b-[1.5px] border-slate-700 flex-1 text-center font-bold pb-0.5 whitespace-nowrap tracking-tighter text-[12px]">{controlNo}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* Format date helper for slips */
function fmtSlipDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
         dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/* Global handler reference for opening the slip modal */
let globalOpenBorrowingSlip: ((data: any, mode?: 'checkout' | 'history') => void) | null = null;

export function printBorrowingSlip(b: any, mode: 'checkout' | 'history' = 'checkout') {
  if (globalOpenBorrowingSlip) {
    globalOpenBorrowingSlip(b, mode);
  }
}

/* ─────────────────────────────────────────────────────────────────
   Borrowing Slip Print Modal (1/4 Folio / Long Bond default)
───────────────────────────────────────────────────────────────── */
interface BorrowingSlipModalProps {
  data: any;
  mode: 'checkout' | 'history';
  paperSize: 'quarter_long' | 'half_long' | 'full_long';
  onPaperSizeChange: (size: 'quarter_long' | 'half_long' | 'full_long') => void;
  onClose: () => void;
}

const BorrowingSlipModal: React.FC<BorrowingSlipModalProps> = ({
  data,
  mode,
  paperSize,
  onPaperSizeChange,
  onClose,
}) => {
  if (!data) return null;

  const isHistory = mode === 'history' || data.borrowing_status === 'returned' || Boolean(data.returned_at);
  const items = data.items || [];
  const hasUnsettled = items.some((item: any) =>
    item.item_type === 'equipment' &&
    (item.condition_status === 'damaged' || item.condition_status === 'lost') &&
    (item.settlement_action === 'to_replace' || item.settlement_action === 'to_pay')
  );

  const docTitle = isHistory ? 'EQUIPMENT BORROWING & RETURN RECEIPT' : 'EQUIPMENT BORROWING SLIP';
  const controlNumber = data.booking_code ? `9.8-E-${data.booking_code.replace(/[^a-zA-Z0-9]/g, '')}` : '9.8 -E- 2025';

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] overflow-auto flex flex-col items-center py-8 print:py-0 print:bg-white print:block">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${paperSize === 'quarter_long' ? '4.25in 6.5in portrait' : paperSize === 'half_long' ? '8.5in 6.5in landscape' : '8.5in 13in portrait'};
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: ${paperSize === 'quarter_long' ? '4.25in' : '8.5in'} !important;
            height: ${paperSize === 'quarter_long' ? '6.5in' : paperSize === 'half_long' ? '6.5in' : '13in'} !important;
          }
          .borrowingslip-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      ` }} />

      {/* Action Header Bar (Hidden during printing) */}
      <div className={`w-full ${paperSize === 'quarter_long' ? 'max-w-[4.25in]' : 'max-w-[8.5in]'} flex justify-between items-center bg-slate-800 text-white px-4 py-2.5 rounded-2xl mb-4 print:hidden shadow-lg gap-2`}>
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm truncate">
          <FiPrinter className="text-[#C01D38] shrink-0" /> Equipment Borrowing Slip
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-700/80 px-2 py-1 rounded-xl border border-slate-600">
            <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">Size:</span>
            <select 
              value={paperSize} 
              onChange={e => onPaperSizeChange(e.target.value as any)} 
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="quarter_long" className="bg-slate-800 text-white">1/4 Long Bond (4.25" × 6.5") - 1/4 Folio</option>
              <option value="half_long" className="bg-slate-800 text-white">1/2 Crosswise Long Bond (8.5" × 6.5")</option>
              <option value="full_long" className="bg-slate-800 text-white">Full Long Bond (8.5" × 13")</option>
            </select>
          </div>

          <button 
            onClick={() => window.print()} 
            className="px-3.5 py-1.5 bg-[#C01D38] hover:bg-[#A5192D] text-white rounded-xl font-bold text-xs shadow transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FiPrinter /> Print
          </button>
          <button 
            onClick={onClose} 
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold text-xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      {paperSize === 'quarter_long' ? (
        /* 1/4 Long Bond Paper (4.25in x 6.5in) - Perfectly proportioned 1/4 Folio */
        <div className="borrowingslip-sheet w-[4.25in] h-[6.5in] max-h-[6.5in] min-h-[6.5in] bg-white shadow-2xl print:shadow-none p-3.5 relative flex flex-col justify-between text-slate-900 font-sans border border-slate-200 print:border-none print:p-3 overflow-hidden select-none">
          <div>
            {/* Official CJC Header (Compact) */}
            <OfficialHeader 
              indexNo="9.8"
              revisionNo="01"
              effectiveDate="08/01/2024"
              controlNo={controlNumber}
              variant="compact"
            />

            {/* Title */}
            <div className="text-center my-0.5">
              <h3 className="text-[11.5px] font-black uppercase tracking-wider text-slate-800 font-sans border-b border-slate-300 pb-0.5 inline-block px-3">
                {docTitle}
              </h3>
            </div>

            {/* Form Fields */}
            <div className="text-slate-800 text-[9.5px] space-y-1 font-sans leading-tight mt-1">
              <div className="flex justify-between items-end gap-2">
                <div className="flex items-end gap-1 flex-1 min-w-0">
                  <span className="text-slate-600 font-semibold whitespace-nowrap">Date:</span>
                  <span className="border-b border-black flex-1 pb-0.5 font-medium truncate">
                    {fmtDateShort(data.created_at || new Date().toISOString())}
                  </span>
                </div>
                <div className="flex items-end gap-1 flex-1 min-w-0">
                  <span className="text-slate-600 font-semibold whitespace-nowrap">Ref Code:</span>
                  <span className="border-b border-black flex-1 pb-0.5 font-mono font-bold text-[#A5192D] truncate">
                    {data.booking_code}
                  </span>
                </div>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Borrower:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-bold uppercase truncate">
                  {data.first_name} {data.last_name}
                </span>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Yr &amp; Course/Dept:</span>
                <span className="border-b border-black flex-1 pb-0.5 truncate">
                  {[data.course, data.year_level, data.department, data.profile_type ? `(${data.profile_type})` : ''].filter(Boolean).join(' ')}
                </span>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Purpose:</span>
                <span className="border-b border-black flex-1 pb-0.5 truncate font-medium">
                  {data.purpose}
                </span>
              </div>

              <div className="flex justify-between items-end gap-2">
                <div className="flex items-end gap-1 flex-1 min-w-0">
                  <span className="text-slate-600 font-semibold whitespace-nowrap">Expected Return:</span>
                  <span className={`border-b border-black flex-1 pb-0.5 truncate ${data.is_overdue ? 'font-bold text-red-700' : 'font-medium'}`}>
                    {fmtSlipDate(data.expected_return_date)}
                  </span>
                </div>
                {data.clinic_branch && (
                  <div className="flex items-end gap-1 flex-1 min-w-0">
                    <span className="text-slate-600 font-semibold whitespace-nowrap">Branch:</span>
                    <span className="border-b border-black flex-1 pb-0.5 font-medium truncate uppercase">
                      {data.clinic_branch}
                    </span>
                  </div>
                )}
              </div>

              {isHistory && data.returned_at && (
                <div className="flex justify-between items-end gap-2">
                  <div className="flex items-end gap-1 flex-1 min-w-0">
                    <span className="text-slate-600 font-semibold whitespace-nowrap">Actual Return:</span>
                    <span className="border-b border-black flex-1 pb-0.5 font-bold text-emerald-800 truncate">
                      {fmtSlipDate(data.returned_at)}
                    </span>
                  </div>
                  {data.returned_to_name && (
                    <div className="flex items-end gap-1 flex-1 min-w-0">
                      <span className="text-slate-600 font-semibold whitespace-nowrap">Received by:</span>
                      <span className="border-b border-black flex-1 pb-0.5 font-medium truncate">
                        {data.returned_to_name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mt-1.5 border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-slate-800 text-[8px] leading-tight">
                <thead className="bg-[#A5192D] text-white uppercase text-[7px] font-bold">
                  <tr>
                    <th className="py-0.5 px-1 text-center w-4">#</th>
                    <th className="py-0.5 px-1 text-left">Item Description</th>
                    <th className="py-0.5 px-0.5 text-center w-7">Qty</th>
                    {isHistory && (
                      <>
                        <th className="py-0.5 px-0.5 text-center w-7">Ret</th>
                        <th className="py-0.5 px-1 text-center w-12">Condition</th>
                        <th className="py-0.5 px-1 text-center w-14">Settlement</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item: any, idx: number) => {
                    const isSupply = item.item_type === 'supply';
                    const cond = item.condition_status || 'good';
                    const settle = item.settlement_action || 'none';
                    const ret = item.quantity_returned !== null ? item.quantity_returned : (item.status === 'returned' ? item.quantity : 0);

                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="py-0.5 px-1 text-center font-medium text-slate-500">{idx + 1}</td>
                        <td className="py-0.5 px-1 font-semibold text-slate-800">
                          {item.brand_name ? `${item.brand_name} - ` : ''}{item.generic_name}
                          {item.settlement_notes && (
                            <div className="text-[6.5px] text-slate-500 font-normal italic leading-none mt-0.5">
                              Note: {item.settlement_notes}
                            </div>
                          )}
                        </td>
                        <td className="py-0.5 px-0.5 text-center font-bold">{item.quantity}</td>
                        {isHistory && (
                          <>
                            <td className="py-0.5 px-0.5 text-center font-bold text-emerald-700">{ret}</td>
                            <td className="py-0.5 px-1 text-center">
                              {!isSupply ? (
                                cond === 'good' ? (
                                  <span className="text-emerald-700 font-bold text-[7px]">GOOD</span>
                                ) : cond === 'damaged' ? (
                                  <span className="bg-red-100 text-red-700 font-bold px-1 rounded text-[6.5px]">DAMAGED</span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-700 font-bold px-1 rounded text-[6.5px]">LOST</span>
                                )
                              ) : (
                                <span className="text-slate-500 text-[6.5px] italic">{ret > 0 ? `Restocked (${ret})` : 'Consumed'}</span>
                              )}
                            </td>
                            <td className="py-0.5 px-1 text-center">
                              {!isSupply && (cond === 'damaged' || cond === 'lost') ? (
                                settle === 'to_replace' ? (
                                  <span className="text-red-700 font-bold text-[6.5px]">To Replace</span>
                                ) : settle === 'to_pay' ? (
                                  <span className="text-red-700 font-bold text-[6.5px]">To Pay {item.charge_amount > 0 ? `₱${Number(item.charge_amount).toFixed(0)}` : ''}</span>
                                ) : settle === 'replaced' ? (
                                  <span className="text-emerald-700 font-bold text-[6.5px]">Replaced</span>
                                ) : settle === 'paid' ? (
                                  <span className="text-emerald-700 font-bold text-[6.5px]">Paid {item.charge_amount > 0 ? `₱${Number(item.charge_amount).toFixed(0)}` : ''}</span>
                                ) : (
                                  <span className="text-slate-400 text-[6.5px]">—</span>
                                )
                              ) : (
                                <span className="text-emerald-700 text-[7px] font-semibold">Cleared</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Unsettled Alert Box (if any) */}
            {hasUnsettled && (
              <div className="mt-1 p-1 bg-red-50 border border-red-300 rounded text-[7px] text-red-900 leading-tight">
                <div className="font-extrabold text-[7.5px] text-red-700">
                  ⚠️ NOTICE OF SETTLEMENT (ILISAN / BAYARAN):
                </div>
                <ul className="list-disc pl-3 mt-0.5">
                  {items.filter((i: any) => i.item_type === 'equipment' && (i.condition_status === 'damaged' || i.condition_status === 'lost') && (i.settlement_action === 'to_replace' || i.settlement_action === 'to_pay')).map((i: any, k: number) => (
                    <li key={k}>
                      <strong>{i.brand_name || i.generic_name}</strong>: {i.condition_status?.toUpperCase()} — <strong>{i.settlement_action === 'to_replace' ? 'To Replace (Ilisan)' : `To Pay ₱${Number(i.charge_amount || 0).toFixed(2)}`}</strong>
                      {i.settlement_notes ? ` (${i.settlement_notes})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Signatures & Footer */}
          <div className="pt-1.5">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="border-b border-black font-bold uppercase text-[9px] pb-0.5 truncate">
                  {data.released_by_name || 'Clinic Personnel'}
                </div>
                <div className="text-[7px] text-slate-600 mt-0.5">Released By / School Nurse</div>
              </div>
              <div>
                <div className="border-b border-black font-bold uppercase text-[9px] pb-0.5 truncate">
                  {data.first_name} {data.last_name}
                </div>
                <div className="text-[7px] text-slate-600 mt-0.5">Received By / Borrower</div>
              </div>
              {isHistory && (
                <>
                  <div className="mt-1">
                    <div className="border-b border-black font-bold uppercase text-[9px] pb-0.5 truncate">
                      {data.returned_to_name || 'Clinic Personnel'}
                    </div>
                    <div className="text-[7px] text-slate-600 mt-0.5">Returned To / Inspected By</div>
                  </div>
                  <div className="mt-1">
                    <div className="border-b border-black font-bold uppercase text-[9px] pb-0.5 truncate">
                      {data.first_name} {data.last_name}
                    </div>
                    <div className="text-[7px] text-slate-600 mt-0.5">Borrower's Signature</div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-1.5 pt-1 border-t border-dashed border-slate-300 text-[6px] text-slate-500 leading-tight">
              <div><strong>Terms:</strong> Borrower is accountable for equipment in good condition. Damaged/lost items must be replaced or paid. Supplies are consumable.</div>
              <div className="text-center text-slate-400 mt-0.5 font-medium">
                Cor Jesu College Clinic Records • 1/4 Folio Slip • Ref: {data.booking_code}
              </div>
            </div>
          </div>
        </div>
      ) : paperSize === 'half_long' ? (
        /* 1/2 Crosswise Long Bond (8.5in x 6.5in) */
        <div className="borrowingslip-sheet w-[8.5in] h-[6.5in] max-h-[6.5in] min-h-[6.5in] bg-white shadow-2xl print:shadow-none p-5 relative flex flex-col justify-between text-slate-900 font-sans border border-slate-200 print:border-none print:p-5 overflow-hidden select-none">
          <div>
            <OfficialHeader 
              indexNo="9.8"
              revisionNo="01"
              effectiveDate="08/01/2024"
              controlNo={controlNumber}
              variant="standard"
            />
            <div className="text-center my-1">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 font-sans border-b border-slate-300 pb-0.5 inline-block px-4">
                {docTitle}
              </h3>
            </div>

            {/* 2-column details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-800 mt-2">
              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Booking Ref:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-mono font-bold text-[#A5192D] truncate">{data.booking_code}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Date Borrowed:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-medium truncate">{fmtSlipDate(data.created_at)}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Borrower Name:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-bold uppercase truncate">{data.first_name} {data.last_name}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Yr/Course/Dept:</span>
                <span className="border-b border-black flex-1 pb-0.5 truncate">{[data.course, data.year_level, data.department, data.profile_type ? `(${data.profile_type})` : ''].filter(Boolean).join(' ')}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Purpose:</span>
                <span className="border-b border-black flex-1 pb-0.5 truncate font-medium">{data.purpose}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Expected Return:</span>
                <span className="border-b border-black flex-1 pb-0.5 truncate font-medium">{fmtSlipDate(data.expected_return_date)}</span>
              </div>
              {isHistory && data.returned_at && (
                <>
                  <div className="flex items-end gap-1">
                    <span className="text-slate-600 font-semibold whitespace-nowrap">Actual Return:</span>
                    <span className="border-b border-black flex-1 pb-0.5 font-bold text-emerald-800 truncate">{fmtSlipDate(data.returned_at)}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-slate-600 font-semibold whitespace-nowrap">Received By:</span>
                    <span className="border-b border-black flex-1 pb-0.5 font-medium truncate">{data.returned_to_name || 'Clinic Personnel'}</span>
                  </div>
                </>
              )}
            </div>

            {/* Table */}
            <div className="mt-3 border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-slate-800 text-[10px] leading-tight">
                <thead className="bg-[#A5192D] text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="py-1 px-2 text-center w-6">#</th>
                    <th className="py-1 px-2 text-left">Item / Apparatus</th>
                    <th className="py-1 px-2 text-center w-12">Qty</th>
                    {isHistory && (
                      <>
                        <th className="py-1 px-2 text-center w-12">Ret</th>
                        <th className="py-1 px-2 text-center w-24">Condition</th>
                        <th className="py-1 px-2 text-center w-28">Settlement</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-1 px-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-1 px-2 font-bold text-slate-800">
                        {item.brand_name ? `${item.brand_name} - ` : ''}{item.generic_name}
                        {item.settlement_notes && <span className="text-slate-500 font-normal italic ml-2">({item.settlement_notes})</span>}
                      </td>
                      <td className="py-1 px-2 text-center font-bold">{item.quantity}</td>
                      {isHistory && (
                        <>
                          <td className="py-1 px-2 text-center font-bold text-emerald-700">{item.quantity_returned !== null ? item.quantity_returned : item.quantity}</td>
                          <td className="py-1 px-2 text-center uppercase font-semibold text-[9px]">{item.condition_status || 'good'}</td>
                          <td className="py-1 px-2 text-center font-semibold text-[9px]">{item.settlement_action || 'cleared'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasUnsettled && (
              <div className="mt-2 p-2 bg-red-50 border border-red-300 rounded text-xs text-red-900">
                <strong>⚠️ Notice of Settlement:</strong> Damaged/lost equipment requires replacement or payment.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="border-b border-black font-bold uppercase text-xs pb-0.5 truncate">{data.released_by_name || 'Clinic Personnel'}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">Released By / School Nurse</div>
              </div>
              <div>
                <div className="border-b border-black font-bold uppercase text-xs pb-0.5 truncate">{data.first_name} {data.last_name}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">Received By / Borrower</div>
              </div>
              {isHistory && (
                <>
                  <div>
                    <div className="border-b border-black font-bold uppercase text-xs pb-0.5 truncate">{data.returned_to_name || 'Clinic Personnel'}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Returned To / Inspected By</div>
                  </div>
                  <div>
                    <div className="border-b border-black font-bold uppercase text-xs pb-0.5 truncate">{data.first_name} {data.last_name}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Borrower's Signature</div>
                  </div>
                </>
              )}
            </div>
            <div className="text-center text-slate-400 text-[9px] mt-2">
              Cor Jesu College Clinic • 1/2 Crosswise Long Bond Slip • Ref: {data.booking_code}
            </div>
          </div>
        </div>
      ) : (
        /* Full Long Bond (8.5in x 13in) */
        <div className="borrowingslip-sheet w-[8.5in] min-h-[13in] bg-white shadow-2xl print:shadow-none p-8 relative flex flex-col justify-between text-slate-900 font-sans border border-slate-200 print:border-none print:p-8 select-none">
          <div>
            <OfficialHeader 
              indexNo="9.8"
              revisionNo="01"
              effectiveDate="08/01/2024"
              controlNo={controlNumber}
              variant="standard"
            />
            <div className="text-center my-3">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-800 font-sans border-b-2 border-slate-300 pb-1 inline-block px-6">
                {docTitle}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-slate-800 mt-4">
              <div className="flex items-end gap-2">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Booking Ref:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-mono font-bold text-[#A5192D] text-base">{data.booking_code}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Date Borrowed:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-medium">{fmtSlipDate(data.created_at)}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Borrower:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-bold uppercase">{data.first_name} {data.last_name}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Yr/Course/Dept:</span>
                <span className="border-b border-black flex-1 pb-0.5">{[data.course, data.year_level, data.department, data.profile_type ? `(${data.profile_type})` : ''].filter(Boolean).join(' ')}</span>
              </div>
              <div className="flex items-end gap-2 col-span-2">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Purpose:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-medium">{data.purpose}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-slate-600 font-semibold whitespace-nowrap">Expected Return:</span>
                <span className="border-b border-black flex-1 pb-0.5 font-medium">{fmtSlipDate(data.expected_return_date)}</span>
              </div>
              {data.clinic_branch && (
                <div className="flex items-end gap-2">
                  <span className="text-slate-600 font-semibold whitespace-nowrap">Branch:</span>
                  <span className="border-b border-black flex-1 pb-0.5 uppercase">{data.clinic_branch}</span>
                </div>
              )}
            </div>

            <div className="mt-6 border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-slate-800 text-xs">
                <thead className="bg-[#A5192D] text-white uppercase font-bold">
                  <tr>
                    <th className="py-2 px-3 text-center w-8">#</th>
                    <th className="py-2 px-3 text-left">Item / Apparatus</th>
                    <th className="py-2 px-3 text-center w-16">Qty</th>
                    {isHistory && (
                      <>
                        <th className="py-2 px-3 text-center w-16">Ret</th>
                        <th className="py-2 px-3 text-center w-28">Condition</th>
                        <th className="py-2 px-3 text-center w-36">Settlement</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {item.brand_name ? `${item.brand_name} - ` : ''}{item.generic_name}
                        {item.settlement_notes && <p className="text-slate-500 text-xs italic mt-0.5">Note: {item.settlement_notes}</p>}
                      </td>
                      <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                      {isHistory && (
                        <>
                          <td className="py-2 px-3 text-center font-bold text-emerald-700">{item.quantity_returned !== null ? item.quantity_returned : item.quantity}</td>
                          <td className="py-2 px-3 text-center uppercase font-semibold">{item.condition_status || 'good'}</td>
                          <td className="py-2 px-3 text-center font-semibold">{item.settlement_action || 'cleared'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-8 text-center">
              <div>
                <div className="border-b border-black font-bold uppercase text-sm pb-1 truncate">{data.released_by_name || 'Clinic Personnel'}</div>
                <div className="text-xs text-slate-600 mt-1">Released By / School Nurse</div>
              </div>
              <div>
                <div className="border-b border-black font-bold uppercase text-sm pb-1 truncate">{data.first_name} {data.last_name}</div>
                <div className="text-xs text-slate-600 mt-1">Received By / Borrower</div>
              </div>
            </div>
            <div className="text-center text-slate-400 text-xs mt-6">
              Cor Jesu College Clinic • Full Long Bond Slip • Ref: {data.booking_code}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};







/* ─────────────────────────────────────────────────────────────────
   Return Reconciliation Modal
───────────────────────────────────────────────────────────────── */
interface ReconcileModalProps {
  borrowingId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemReconcile {
  returned: number;
  consumed: number;
  condition_status: 'good' | 'damaged' | 'lost';
  settlement_action: 'none' | 'to_replace' | 'to_pay' | 'replaced' | 'paid';
  settlement_notes: string;
  charge_amount: number;
}

const ReconcileModal: React.FC<ReconcileModalProps> = ({ borrowingId, onClose, onSuccess }) => {
  const [detail, setDetail] = useState<BorrowingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [reconcile, setReconcile] = useState<Record<number, ItemReconcile>>({});

  useEffect(() => {
    if (!borrowingId) return;
    setLoading(true);
    apiFetch(`/api/index.php?route=borrowings&action=detail&borrowing_id=${borrowingId}`)
      .then(res => {
        setDetail(res.borrowing);
        const init: Record<number, ItemReconcile> = {};
        (res.borrowing?.items || []).forEach((item: BorrowedItemDetail) => {
          if (item.status === 'borrowed') {
            init[item.borrowed_item_id] = {
              returned: item.quantity,
              consumed: 0,
              condition_status: 'good',
              settlement_action: 'none',
              settlement_notes: '',
              charge_amount: 0
            };
          }
        });
        setReconcile(init);
      })
      .catch(() => toast.error('Failed to load borrowing details'))
      .finally(() => setLoading(false));
  }, [borrowingId]);

  const handleReturnedChange = (biId: number, maxQty: number, val: number) => {
    const ret = Math.max(0, Math.min(maxQty, isNaN(val) ? 0 : val));
    const cons = maxQty - ret;
    setReconcile(prev => ({
      ...prev,
      [biId]: { ...(prev[biId] || { condition_status: 'good', settlement_action: 'none', settlement_notes: '', charge_amount: 0 }), returned: ret, consumed: cons }
    }));
  };

  const handleConsumedChange = (biId: number, maxQty: number, val: number) => {
    const cons = Math.max(0, Math.min(maxQty, isNaN(val) ? 0 : val));
    const ret = maxQty - cons;
    setReconcile(prev => ({
      ...prev,
      [biId]: { ...(prev[biId] || { condition_status: 'good', settlement_action: 'none', settlement_notes: '', charge_amount: 0 }), returned: ret, consumed: cons }
    }));
  };

  const handleConditionChange = (biId: number, condition: 'good' | 'damaged' | 'lost') => {
    setReconcile(prev => {
      const curr = prev[biId] || { returned: 0, consumed: 0, condition_status: 'good', settlement_action: 'none', settlement_notes: '', charge_amount: 0 };
      const defaultSettle = condition === 'good' ? 'none' : (curr.settlement_action === 'none' ? 'to_replace' : curr.settlement_action);
      return {
        ...prev,
        [biId]: {
          ...curr,
          condition_status: condition,
          settlement_action: defaultSettle,
        }
      };
    });
  };

  const handleSettlementActionChange = (biId: number, action: 'none' | 'to_replace' | 'to_pay' | 'replaced' | 'paid') => {
    setReconcile(prev => ({
      ...prev,
      [biId]: { ...(prev[biId] || { returned: 0, consumed: 0, condition_status: 'damaged', settlement_action: 'to_replace', settlement_notes: '', charge_amount: 0 }), settlement_action: action }
    }));
  };

  const handleSettlementNotesChange = (biId: number, notesText: string) => {
    setReconcile(prev => ({
      ...prev,
      [biId]: { ...(prev[biId] || { returned: 0, consumed: 0, condition_status: 'damaged', settlement_action: 'to_replace', settlement_notes: '', charge_amount: 0 }), settlement_notes: notesText }
    }));
  };

  const handleChargeAmountChange = (biId: number, amount: number) => {
    setReconcile(prev => ({
      ...prev,
      [biId]: { ...(prev[biId] || { returned: 0, consumed: 0, condition_status: 'damaged', settlement_action: 'to_replace', settlement_notes: '', charge_amount: 0 }), charge_amount: isNaN(amount) ? 0 : amount }
    }));
  };

  const handleSubmit = async () => {
    if (!detail) return;
    const items = detail.items
      .filter(i => i.status === 'borrowed')
      .map(i => {
        const r = reconcile[i.borrowed_item_id] ?? {
          returned: i.quantity,
          consumed: 0,
          condition_status: 'good',
          settlement_action: 'none',
          settlement_notes: '',
          charge_amount: 0
        };
        return {
          borrowed_item_id: i.borrowed_item_id,
          quantity_returned: r.returned,
          quantity_consumed: r.consumed,
          condition_status: i.item_type === 'equipment' ? r.condition_status : 'good',
          settlement_action: i.item_type === 'equipment' ? r.settlement_action : 'none',
          settlement_notes: r.settlement_notes,
          charge_amount: r.charge_amount || 0,
        };
      });

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/index.php?route=borrowings&action=return_borrowing', {
        method: 'POST',
        body: JSON.stringify({ borrowing_id: detail.borrowing_id, notes, items })
      });
      if (res.fully_returned) {
        toast.success('Return processed! Inventory updated and returned supplies/medicines synced to Drawer.');
      } else {
        toast.success('Partial return processed! Returned supplies/medicines synced to Drawer.');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  if (!borrowingId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <FiRotateCcw className="text-[#A5192D]" size={18} />
              <h2 className="text-lg font-bold text-slate-800">Process Return &amp; Inventory Sync</h2>
              {detail && (
                <span className="font-mono text-xs font-extrabold bg-[#A5192D] text-white px-2 py-0.5 rounded">
                  {detail.booking_code}
                </span>
              )}
            </div>
            {detail && (
              <p className="text-sm text-slate-500 mt-0.5">
                {detail.first_name} {detail.last_name} · {detail.course || detail.department} {detail.year_level}
                {detail.clinic_branch && <span className="ml-2 font-medium text-slate-400">({detail.clinic_branch})</span>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <FiX size={20} />
          </button>
        </div>

        {/* Borrowing meta */}
        {detail && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs shrink-0">
            <span className="flex items-center gap-1 text-slate-600">
              <FiCalendar size={12} />
              <span>Borrowed: <strong>{fmtDate(detail.created_at)}</strong></span>
            </span>
            <span className={`flex items-center gap-1 font-semibold ${detail.is_overdue ? 'text-red-600' : 'text-slate-600'}`}>
              <FiClock size={12} />
              <span>Expected Return: <strong>{fmtDate(detail.expected_return_date)}</strong></span>
              {detail.is_overdue && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ml-1">Overdue</span>}
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <FiBox size={12} />
              <span>Purpose: <strong>{detail.purpose}</strong></span>
            </span>
          </div>
        )}

        {/* Items reconciliation */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center text-slate-500 py-8">Loading details...</div>
          ) : detail ? (
            <div className="space-y-3">
              {/* Info Banner */}
              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <FiInfo size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900">Equipment Inspection &amp; Drawer Inventory Synchronization</p>
                  <p className="text-emerald-800 leading-relaxed">
                    Check the physical condition of returned equipment or apparatus. Functional equipment returned in good condition will be automatically restocked into active equipment inventory. Any <strong>damaged</strong> or <strong>lost</strong> item will be held out of active inventory and flagged for borrower replacement (ilisan) or payment (bayaran).
                  </p>
                  <p className="text-emerald-950 leading-relaxed font-medium bg-emerald-100/80 rounded p-1.5 border border-emerald-300/60 flex items-center gap-1.5">
                    <FiInbox size={13} className="shrink-0 text-emerald-700" />
                    <span><strong>Unused Supplies &amp; Medicines:</strong> Returned supplies or medicines will automatically sync directly into <strong>Drawer Inventory</strong> (dispensing cart/counter) and will not be mixed back into the Main Stockroom.</span>
                  </p>
                </div>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Item / Apparatus</div>
                <div className="col-span-1 text-center">Borrowed</div>
                <div className="col-span-2 text-center">Returned</div>
                <div className="col-span-2 text-center">Consumed</div>
                <div className="col-span-3 text-center">Condition</div>
              </div>

              {detail.items.map(item => {
                const isSettled = item.status !== 'borrowed';
                const r = reconcile[item.borrowed_item_id] ?? {
                  returned: item.quantity,
                  consumed: 0,
                  condition_status: 'good',
                  settlement_action: 'none',
                  settlement_notes: '',
                  charge_amount: 0
                };
                const isSupply = item.item_type === 'supply';
                const isEquipment = item.item_type === 'equipment';
                const isDamagedOrLost = isEquipment && (r.condition_status === 'damaged' || r.condition_status === 'lost');
                const total = r.returned + r.consumed;
                const overAllocated = total !== item.quantity;

                return (
                  <div key={item.borrowed_item_id} className={`rounded-xl border p-3 transition-colors ${isSettled ? 'bg-slate-50 border-slate-200 opacity-60' : overAllocated ? 'bg-red-50 border-red-200' : isDamagedOrLost ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Item name */}
                      <div className="col-span-4">
                        <p className="font-bold text-slate-800 text-sm leading-tight">
                          {item.brand_name || item.generic_name}
                        </p>
                        {item.brand_name && item.generic_name && (
                          <p className="text-[11px] text-slate-500">{item.generic_name}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isSupply ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isSupply ? 'Consumable Supply' : 'Equipment / Apparatus'}
                          </span>
                          {item.batch_number && (
                            <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              Batch: {item.batch_number}
                            </span>
                          )}
                          {isSettled && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Settled</span>}
                        </div>
                      </div>

                      {/* Qty borrowed */}
                      <div className="col-span-1 text-center">
                        <span className="text-sm font-bold text-slate-700">{item.quantity}</span>
                      </div>

                      {/* Qty returned */}
                      <div className="col-span-2 text-center">
                        {isSettled ? (
                          <span className="text-sm font-bold text-emerald-600">{item.quantity_returned ?? '—'}</span>
                        ) : (
                          <input
                            type="number" min={0} max={item.quantity}
                            value={r.returned}
                            onChange={e => handleReturnedChange(item.borrowed_item_id, item.quantity, parseInt(e.target.value))}
                            className="w-16 mx-auto block text-center border border-slate-300 rounded-md p-1 text-sm font-bold text-emerald-700 bg-emerald-50 focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>

                      {/* Qty consumed */}
                      <div className="col-span-2 text-center">
                        {isSettled ? (
                          <span className="text-sm font-bold text-amber-600">{item.quantity_consumed ?? '—'}</span>
                        ) : (
                          <input
                            type="number" min={0} max={item.quantity}
                            value={r.consumed}
                            onChange={e => handleConsumedChange(item.borrowed_item_id, item.quantity, parseInt(e.target.value))}
                            className="w-16 mx-auto block text-center border border-slate-300 rounded-md p-1 text-sm font-bold text-amber-700 bg-amber-50 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>

                      {/* Condition selector */}
                      <div className="col-span-3">
                        {isEquipment ? (
                          isSettled ? (
                            <div className="text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${item.condition_status === 'good' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {item.condition_status === 'good' ? 'Good' : item.condition_status}
                              </span>
                            </div>
                          ) : (
                            <select
                              value={r.condition_status}
                              onChange={e => handleConditionChange(item.borrowed_item_id, e.target.value as any)}
                              className={`w-full text-xs font-bold rounded-lg p-1.5 border transition-all cursor-pointer ${
                                r.condition_status === 'good'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:border-emerald-500'
                                  : r.condition_status === 'damaged'
                                  ? 'bg-red-50 border-red-300 text-red-800 focus:border-red-500 ring-2 ring-red-200'
                                  : 'bg-amber-50 border-amber-300 text-amber-800 focus:border-amber-500 ring-2 ring-amber-200'
                              }`}
                            >
                              <option value="good">🟢 Good / Functional (Walay Guba)</option>
                              <option value="damaged">🔴 Damaged / Broken (May Guba)</option>
                              <option value="lost">⚠️ Lost / Missing (Nawala)</option>
                            </select>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-center">
                            <span className="text-[11px] font-semibold text-slate-500">Consumable Supply</span>
                            {isSettled ? (
                              (item.quantity_returned ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-md">
                                  <FiInbox size={11} className="text-teal-600" />
                                  Drawer ({item.quantity_returned}){item.batch_number ? ` • ${item.batch_number}` : ''}
                                </span>
                              ) : null
                            ) : (
                              r.returned > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-md">
                                  <FiInbox size={11} className="text-teal-600" />
                                  Syncs to Drawer ({r.returned}){item.batch_number ? ` • ${item.batch_number}` : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">All consumed</span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Over-allocated warning */}
                    {overAllocated && (
                      <div className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1.5 bg-red-100/70 p-2 rounded-lg">
                        <FiAlertTriangle size={14} className="shrink-0" />
                        <span>Returned ({r.returned}) + Consumed ({r.consumed}) must equal borrowed quantity ({item.quantity}).</span>
                      </div>
                    )}

                    {/* Damage & Settlement Section for Equipment */}
                    {!isSettled && isDamagedOrLost && (
                      <div className="mt-3 p-3 bg-red-50/90 border border-red-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-red-200/60">
                          <span className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                            <FiAlertTriangle className="text-red-600" size={14} />
                            Equipment {r.condition_status === 'damaged' ? 'Damaged / Guba' : 'Lost / Missing'} &mdash; Settlement Policy:
                          </span>
                          <span className="text-[11px] font-semibold text-red-700">
                            {r.settlement_action === 'replaced'
                              ? '✓ Replacement unit will be added to inventory'
                              : '⚠️ Damaged item will NOT be restocked to active stock'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          {/* Required Action */}
                          <div>
                            <label className="block text-[10px] font-bold text-red-900 uppercase tracking-wide mb-1">
                              Action Required (Aksyon)
                            </label>
                            <select
                              value={r.settlement_action}
                              onChange={e => handleSettlementActionChange(item.borrowed_item_id, e.target.value as any)}
                              className="w-full bg-white border border-red-300 text-red-900 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="to_replace">🔄 To Replace (Ilisan sa Borrower)</option>
                              <option value="to_pay">💰 To Pay / Reimburse (Bayaran sa Borrower)</option>
                              <option value="replaced">✅ Replaced on the Spot (Nailisan na Dayon)</option>
                              <option value="paid">💵 Paid on the Spot (Nabayran na Dayon)</option>
                            </select>
                          </div>

                          {/* Cost / Charge Amount */}
                          <div>
                            <label className="block text-[10px] font-bold text-red-900 uppercase tracking-wide mb-1">
                              Cost / Amount (₱) {r.settlement_action === 'to_pay' || r.settlement_action === 'paid' ? '*' : '(Optional)'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              value={r.charge_amount || ''}
                              onChange={e => handleChargeAmountChange(item.borrowed_item_id, parseFloat(e.target.value))}
                              className="w-full bg-white border border-red-300 text-slate-800 font-semibold rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>

                          {/* Damage Notes */}
                          <div>
                            <label className="block text-[10px] font-bold text-red-900 uppercase tracking-wide mb-1">
                              Damage Details / Notes
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Broken lens, damaged cord, receipt #..."
                              value={r.settlement_notes || ''}
                              onChange={e => handleSettlementNotesChange(item.borrowed_item_id, e.target.value)}
                              className="w-full bg-white border border-red-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 mt-2">Return Remarks / Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Apparatus inspected in presence of student; no defects found..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#A5192D] resize-none transition-colors"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={() => detail && printBorrowingSlip(detail, 'history')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors"
          >
            <FiPrinter size={15} />
            Print Slip
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="bg-[#A5192D] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-[#8B1424] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              <FiCheckCircle size={15} />
              {submitting ? 'Processing...' : 'Confirm Return & Sync Inventory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Checked Out List (compact, grouped by borrowing)
───────────────────────────────────────────────────────────────── */
const CheckedOutList: React.FC = () => {
  const { selectedBranch, isSuperAdmin } = useBranch();
  const [items, setItems] = useState<CheckedOutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<number | null>(null);

  const fetchCheckedOut = async () => {
    setLoading(true);
    try {
      const branchParam = isSuperAdmin && selectedBranch && selectedBranch !== 'All Branches'
        ? `&branch=${encodeURIComponent(selectedBranch)}`
        : '';
      const res = await apiFetch(`/api/index.php?route=borrowings&action=checked_out${branchParam}`);
      setItems(res.checked_out || []);
    } catch (e) {
      toast.error('Failed to load checked out equipment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckedOut();
  }, [selectedBranch]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-5 h-full overflow-y-auto">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-20">
          <FiPackage size={48} className="mb-4 opacity-40" />
          <h3 className="text-xl font-semibold text-slate-600">No equipment currently checked out</h3>
          <p className="text-sm mt-1">All borrowings have been returned.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{items.length} Active Borrowing{items.length !== 1 ? 's' : ''}</span>
            {items.filter(i => i.is_overdue).length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <FiAlertTriangle size={11} /> {items.filter(i => i.is_overdue).length} Overdue
              </span>
            )}
          </div>

          {items.map(row => (
            <div
              key={row.borrowing_id}
              className={`border rounded-xl bg-white hover:shadow-md transition-all ${row.is_overdue ? 'border-red-300 bg-red-50/30' : row.is_due_soon ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'}`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Booking code */}
                <span className="font-mono text-xs font-extrabold bg-[#A5192D] text-white px-2 py-1 rounded shrink-0">
                  {row.booking_code}
                </span>

                {/* Borrower + purpose */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{row.first_name} {row.last_name}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold uppercase">{row.profile_type}</span>
                    {(row.course || row.year_level) && (
                      <span className="text-xs text-slate-500">{row.course} {row.year_level}</span>
                    )}
                    {row.clinic_branch && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {row.clinic_branch}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500 truncate">{row.purpose}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">•</span>
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">{row.items.length} item{row.items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Due date */}
                <div className="text-right shrink-0 hidden sm:block">
                  {row.expected_return_date ? (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${row.is_overdue ? 'text-red-600' : row.is_due_soon ? 'text-amber-600' : 'text-slate-500'}`}>
                      {row.is_overdue ? <FiAlertTriangle size={12} /> : <FiClock size={12} />}
                      <span>{row.is_overdue ? 'Overdue · ' : row.is_due_soon ? 'Due Soon · ' : 'Due · '}{fmtDateShort(row.expected_return_date)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No due date</span>
                  )}
                  <div className="text-[10px] text-slate-400 mt-0.5">Since {fmtDateShort(row.created_at)}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => printBorrowingSlip(row, 'checkout')}
                    title="Print borrowing slip"
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <FiPrinter size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedBorrowingId(row.borrowing_id)}
                    className="flex items-center gap-1.5 bg-[#A5192D] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#8B1424] transition-colors shadow-sm"
                  >
                    View & Return <FiChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* Items preview (collapsed sub-row) */}
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {row.items.map(item => (
                  <span key={item.borrowed_item_id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {item.brand_name || item.generic_name} ×{item.quantity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reconciliation modal */}
      {selectedBorrowingId && (
        <ReconcileModal
          borrowingId={selectedBorrowingId}
          onClose={() => setSelectedBorrowingId(null)}
          onSuccess={fetchCheckedOut}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   New Booking Form
───────────────────────────────────────────────────────────────── */
const NewBookingForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { confirm } = useConfirm();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ item_id: number; quantity: number; type: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredProfiles, setFilteredProfiles] = useState<any[]>([]);
  const [printData, setPrintData] = useState<any | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<{ booking_code: string; borrowing_id: number } | null>(null);

  const handleSelectProfile = (profile: any) => {
    setSelectedProfile(profile.id);
    setSearchTerm(`${profile.first_name} ${profile.last_name}`);
    setShowDropdown(false);
  };

  useEffect(() => {
    apiFetch('/api/index.php?route=inventory&action=items')
      .then(res => { setInventory(res.items || []); setLoading(false); })
      .catch(() => { toast.error('Failed to load inventory'); setLoading(false); });
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 1 && !selectedProfile) {
        apiFetch(`/api/index.php?route=patients&action=list&search=${encodeURIComponent(searchTerm)}&per_page=20`)
          .then(res => setFilteredProfiles(res.profiles || []))
          .catch(console.error);
      } else if (searchTerm.length === 0) {
        setFilteredProfiles([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedProfile]);

  const handleAddItem = (item: any) => {
    if (selectedItems.some(i => i.item_id === item.id)) return;
    if (item.total_stock <= 0) {
      confirm({ title: 'Out of Stock', message: `${item.brand_name || item.generic_name} is currently out of stock.`, type: 'danger', confirmText: 'Okay', hideCancel: true });
      return;
    }
    setSelectedItems(prev => [...prev, { item_id: item.id, quantity: 1, type: item.category === 'equipment' ? 'equipment' : 'supply' }]);
  };

  const handleQuickAddMedicalKit = () => {
    const medKitKeywords = ['alcohol', 'betadine', 'cotton', 'bandage', 'thermometer', 'first aid', 'kit', 'gauze', 'scissors', 'gloves'];
    const itemsToAdd: any[] = [];
    inventory.forEach(item => {
      const name = (item.generic_name + ' ' + item.brand_name).toLowerCase();
      if (medKitKeywords.some(kw => name.includes(kw)) && item.total_stock > 0) {
        if (!selectedItems.some(i => i.item_id === item.id) && !itemsToAdd.some(i => i.item_id === item.id)) {
          itemsToAdd.push({ item_id: item.id, quantity: 1, type: item.category === 'equipment' ? 'equipment' : 'supply' });
        }
      }
    });
    if (itemsToAdd.length > 0) {
      setSelectedItems(prev => [...prev, ...itemsToAdd]);
      toast.success(`Added ${itemsToAdd.length} Medical Kit items!`);
      if (!purpose) setPurpose('Intramurals / Sports Event');
    } else {
      toast.error('No available Medical Kit items found in inventory.');
    }
  };

  const handleRemoveItem = (id: number) => setSelectedItems(selectedItems.filter(i => i.item_id !== id));

  const handleQuantityChange = (id: number, delta: number) => {
    const itemData = inventory.find(i => i.id === id);
    if (!itemData) return;
    setSelectedItems(selectedItems.map(i => {
      if (i.item_id === id) {
        let newQ = Math.max(1, i.quantity + delta);
        if (newQ > itemData.total_stock) {
          confirm({ title: 'Stock Limit', message: `Only ${itemData.total_stock} of ${itemData.brand_name || itemData.generic_name} available.`, type: 'warning', confirmText: 'Okay', hideCancel: true });
          newQ = itemData.total_stock;
        }
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return toast.error('Please select a borrower');
    if (!purpose.trim()) return toast.error('Please enter the purpose');
    if (selectedItems.length === 0) return toast.error('Please select at least one item');

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/index.php?route=borrowings&action=submit', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: selectedProfile,
          purpose,
          expected_return_date: expectedReturnDate || null,
          items: selectedItems.map(i => ({ inventory_item_id: i.item_id, quantity: i.quantity, item_type: i.type }))
        })
      });
      setBookingSuccess({ booking_code: res.booking_code, borrowing_id: res.borrowing_id });

      // Build print-ready data
      const profileParts = searchTerm.split(' ');
      const course = filteredProfiles.length > 0 ? filteredProfiles[0]?.course : '';
      const year = filteredProfiles.length > 0 ? filteredProfiles[0]?.year_level : '';
      setPrintData({
        booking_code: res.booking_code,
        borrowing_id: res.borrowing_id,
        created_at: new Date().toISOString(),
        expected_return_date: expectedReturnDate || null,
        is_overdue: false,
        first_name: profileParts[0] || '',
        last_name: profileParts.slice(1).join(' ') || '',
        course, year_level: year, profile_type: 'student', department: '',
        purpose,
        items: selectedItems.map(si => {
          const inv = inventory.find(i => i.id === si.item_id);
          return {
            borrowed_item_id: si.item_id,
            inventory_item_id: si.item_id,
            generic_name: inv?.generic_name || '',
            brand_name: inv?.brand_name || '',
            category: inv?.category || '',
            quantity: si.quantity,
            item_type: si.type,
            status: 'borrowed',
            stock_reserved: si.type === 'equipment',
            quantity_returned: null,
            quantity_consumed: null,
            item_returned_at: null
          };
        })
      });

      toast.success('Borrowing submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (bookingSuccess) {
    return (
      <div className="p-12 h-full flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <FiCheckCircle size={36} className="text-emerald-500" />
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-800">Booking Submitted!</h3>
          <p className="text-slate-500 mt-1">Equipment has been checked out successfully.</p>
          <div className="mt-4 font-mono text-2xl font-black tracking-widest text-[#A5192D] bg-red-50 border-2 border-[#A5192D] px-6 py-3 rounded-xl inline-block">
            {bookingSuccess.booking_code}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={() => printBorrowingSlip(printData, 'checkout')}
            className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-700 transition-colors shadow-sm"
          >
            <FiPrinter size={16} /> Print Borrowing Slip
          </button>
          <button
            onClick={() => onSuccess()}
            className="flex items-center gap-2 bg-[#A5192D] text-white px-5 py-2.5 rounded-lg font-bold hover:bg-[#8B1424] transition-colors shadow-sm"
          >
            View Checked Out <FiChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading form...</div>;

  return (
    <form onSubmit={handleSubmit} className="p-8 h-full overflow-y-auto bg-slate-50/30">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Section 1: Borrower Information */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">1. Borrower Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Search Profile (Student/Staff)</label>
              <input
                type="text"
                placeholder="Type a name to search..."
                className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setSelectedProfile(''); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && filteredProfiles.length > 0 && !selectedProfile && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredProfiles.map(p => (
                    <div key={p.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors" onClick={() => handleSelectProfile(p)}>
                      <div className="font-semibold text-slate-800">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="uppercase font-bold tracking-wider">{p.profile_type}</span>
                        {p.course && <span>• {p.course} {p.year_level}</span>}
                        {p.department && <span>• {p.department}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showDropdown && searchTerm.length > 0 && filteredProfiles.length === 0 && !selectedProfile && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-3 text-sm text-slate-500 text-center">
                  No profiles found matching "{searchTerm}"
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose of Borrowing</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text" placeholder="e.g. Intramurals, First Aid, Class Demo" required
                    className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors"
                    value={purpose} onChange={e => setPurpose(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['Intramurals', 'Field Trip', 'Class Activity', 'PE Class', 'Coastal Clean Up'].map(preset => (
                      <button key={preset} type="button" onClick={() => setPurpose(preset)}
                        className={`text-[10px] px-2 py-1 rounded-md border font-bold transition-colors ${purpose === preset ? 'bg-[#A5192D] text-white border-[#A5192D]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Expected Return Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors text-sm"
                  value={expectedReturnDate} onChange={e => setExpectedReturnDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Equipment Selection */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-2 gap-4">
            <h2 className="text-xl font-bold text-slate-800">2. Equipment & Supplies</h2>
            <button type="button" onClick={handleQuickAddMedicalKit}
              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
              <FiBriefcase className="w-4 h-4" /> + Quick Add Medical Kit
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Catalog */}
            <div className="lg:w-1/2 flex flex-col">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Available Catalog</h3>
              <div className="mb-3 relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search available items..."
                  className="w-full border border-slate-300 pl-9 p-2 rounded-md focus:outline-none focus:border-[#A5192D] transition-colors text-sm"
                  value={catalogSearchTerm} onChange={e => setCatalogSearchTerm(e.target.value)} />
              </div>
              <div className="border border-slate-200 rounded-md h-[300px] overflow-y-auto flex-1">
                {inventory.filter(item => {
                  if (!catalogSearchTerm) return true;
                  return `${item.generic_name} ${item.brand_name} ${item.category}`.toLowerCase().includes(catalogSearchTerm.toLowerCase());
                }).map(item => {
                  const isSelected = selectedItems.some(i => i.item_id === item.id);
                  const isOutOfStock = Number(item.total_stock) <= 0;
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${isOutOfStock ? 'opacity-60' : ''}`}>
                      <div>
                        <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {item.brand_name || item.generic_name}
                          <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{item.category}</span>
                        </p>
                        <div className="mt-1">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase">Out of Stock</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase">{Number(item.total_stock)} In Stock</span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleAddItem(item)} disabled={isSelected || isOutOfStock}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isSelected ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : isOutOfStock ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' : 'bg-[#A5192D] text-white hover:bg-[#8B1424] shadow-sm active:scale-95'}`}>
                        {isSelected ? 'Added' : isOutOfStock ? 'Empty' : 'Select'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected items */}
            <div className="lg:w-1/2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Selected Items</h3>
              {selectedItems.length === 0 ? (
                <div className="h-[300px] border-2 border-dashed border-slate-200 rounded-md flex items-center justify-center text-slate-400 flex-col gap-2">
                  <FiBox size={28} className="opacity-40" />
                  <span className="text-sm">Select items from the catalog</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map(sItem => {
                    const itemData = inventory.find(i => i.id === sItem.item_id);
                    return (
                      <div key={sItem.item_id} className="bg-slate-50 border border-slate-200 p-3 rounded-md flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{itemData?.brand_name || itemData?.generic_name}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400">{sItem.type === 'equipment' ? 'Equipment — To be returned' : 'Supply — Consumable'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white border border-slate-200 rounded-md">
                            <button type="button" onClick={() => handleQuantityChange(sItem.item_id, -1)} className="px-2 py-1 text-slate-500 hover:text-slate-800">-</button>
                            <span className="w-8 text-center font-bold text-sm">{sItem.quantity}</span>
                            <button type="button" onClick={() => handleQuantityChange(sItem.item_id, 1)} className="px-2 py-1 text-slate-500 hover:text-slate-800">+</button>
                          </div>
                          <button type="button" onClick={() => handleRemoveItem(sItem.item_id)} className="text-red-500 hover:text-red-700 font-bold text-sm">Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Agreement */}
        <section className="bg-slate-100 p-6 rounded-xl border border-slate-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" required className="mt-1 w-5 h-5 accent-[#A5192D]" />
            <span className="text-sm text-slate-700 leading-relaxed">
              <strong>I agree to the terms and conditions.</strong> The borrower is responsible for returning all equipment in the same condition as when borrowed. Equipment that is lost or damaged must be replaced or the cost reimbursed. Consumable supplies are permanently dispensed. Equipment stock is reserved from inventory upon checkout.
            </span>
          </label>
        </section>

        <div className="flex justify-end pt-4 pb-12">
          <button type="submit" disabled={submitting}
            className="bg-[#A5192D] text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-[#8B1424] transition-colors shadow-md disabled:opacity-70 flex items-center gap-2">
            {submitting ? 'Submitting...' : 'Submit Booking Request'}
          </button>
        </div>
      </div>
    </form>
  );
};

/* ─────────────────────────────────────────────────────────────────
   History Detail Modal
───────────────────────────────────────────────────────────────── */
interface HistoryDetailModalProps {
  record: any | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({ record, onClose, onRefresh }) => {
  const [currentRecord, setCurrentRecord] = useState<any>(record);
  const [resolvingItem, setResolvingItem] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<'replaced' | 'paid'>('replaced');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveAmount, setResolveAmount] = useState<number>(0);
  const [restockNow, setRestockNow] = useState(true);
  const [resolvingSubmitting, setResolvingSubmitting] = useState(false);

  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  if (!currentRecord) return null;

  const isReturned = currentRecord.borrowing_status === 'returned';

  const handleOpenResolve = (item: any) => {
    setResolvingItem(item);
    setResolveAction(item.settlement_action === 'to_pay' ? 'paid' : 'replaced');
    setResolveAmount(item.charge_amount || 0);
    setResolveNotes(item.settlement_notes || '');
    setRestockNow(true);
  };

  const handleConfirmResolve = async () => {
    if (!resolvingItem) return;
    setResolvingSubmitting(true);
    try {
      await apiFetch('/api/index.php?route=borrowings&action=update_settlement', {
        method: 'POST',
        body: JSON.stringify({
          borrowed_item_id: resolvingItem.borrowed_item_id,
          settlement_action: resolveAction,
          settlement_notes: resolveNotes,
          charge_amount: resolveAmount,
          restock_now: resolveAction === 'replaced' && restockNow
        })
      });

      toast.success(
        resolveAction === 'replaced' && restockNow
          ? 'Marked as replaced and 1 unit restocked into inventory!'
          : 'Settlement status updated successfully.'
      );

      // Update currentRecord in place
      setCurrentRecord((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i: any) =>
            i.borrowed_item_id === resolvingItem.borrowed_item_id
              ? {
                  ...i,
                  settlement_action: resolveAction,
                  settlement_notes: resolveNotes,
                  charge_amount: resolveAmount,
                  settled_at: new Date().toISOString()
                }
              : i
          )
        };
      });

      setResolvingItem(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settlement');
    } finally {
      setResolvingSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <FiBox className="text-[#A5192D]" size={18} />
              <h2 className="text-lg font-bold text-slate-800">Transaction Details</h2>
              <span className="font-mono text-xs font-extrabold bg-[#A5192D] text-white px-2 py-0.5 rounded">
                {currentRecord.booking_code}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${isReturned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isReturned ? 'Returned' : 'Active'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {currentRecord.first_name} {currentRecord.last_name} · {currentRecord.course || currentRecord.department} {currentRecord.year_level}
              {currentRecord.clinic_branch && <span className="ml-2 font-semibold text-slate-400">({currentRecord.clinic_branch})</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Borrower</span>
              <span className="font-bold text-slate-800 text-sm">{currentRecord.first_name} {currentRecord.last_name}</span>
              <span className="text-slate-500 block uppercase font-semibold text-[10px]">{currentRecord.profile_type}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Purpose</span>
              <span className="font-bold text-slate-800 text-sm">{currentRecord.purpose}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Date Borrowed</span>
              <span className="font-semibold text-slate-700">{fmtDate(currentRecord.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Expected Return Date</span>
              <span className="font-semibold text-slate-700">{fmtDate(currentRecord.expected_return_date)}</span>
            </div>
            {currentRecord.returned_at && (
              <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
                <span>Actual Date Returned: <strong className="text-emerald-700">{fmtDate(currentRecord.returned_at)}</strong></span>
                {currentRecord.returned_to_name && <span>Received by: <strong>{currentRecord.returned_to_name}</strong></span>}
              </div>
            )}
          </div>

          {/* Items breakdown */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Item Breakdown, Condition &amp; Settlement</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold">
                  <tr>
                    <th className="p-2.5 text-left">Item Name</th>
                    <th className="p-2.5 text-center">Type</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-center">Returned</th>
                    <th className="p-2.5 text-center">Condition</th>
                    <th className="p-2.5 text-center">Settlement Status</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentRecord.items.map((item: any, idx: number) => {
                    const isEquipment = item.item_type === 'equipment';
                    const cond = item.condition_status || 'good';
                    const settle = item.settlement_action || 'none';
                    const isUnsettled = isEquipment && (cond === 'damaged' || cond === 'lost') && (settle === 'to_replace' || settle === 'to_pay');

                    return (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isUnsettled ? 'bg-red-50/40' : ''}`}>
                        <td className="p-2.5 font-bold text-slate-800">
                          {item.brand_name ? `${item.brand_name}` : ''}{item.brand_name && item.generic_name ? ' — ' : ''}{item.generic_name}
                          {item.settlement_notes && (
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5 italic">Note: {item.settlement_notes}</p>
                          )}
                        </td>
                        <td className="p-2.5 text-center uppercase text-[10px] font-bold text-slate-500">
                          {item.item_type}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{item.quantity}</td>
                        <td className="p-2.5 text-center">
                          {item.quantity_returned !== null ? (
                            <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                              {item.quantity_returned}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isEquipment ? (
                            cond === 'good' ? (
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                Good
                              </span>
                            ) : cond === 'damaged' ? (
                              <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase flex items-center justify-center gap-1">
                                <FiAlertTriangle size={10} /> Damaged
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                Lost
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">Consumable</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isEquipment && (cond === 'damaged' || cond === 'lost') ? (
                            settle === 'to_replace' ? (
                              <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                To Replace (Ilisan)
                              </span>
                            ) : settle === 'to_pay' ? (
                              <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                To Pay (Bayaran) {item.charge_amount > 0 ? `₱${Number(item.charge_amount).toFixed(2)}` : ''}
                              </span>
                            ) : settle === 'replaced' ? (
                              <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                Replaced (Nailisan na)
                              </span>
                            ) : settle === 'paid' ? (
                              <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                Paid (Nabayran na) {item.charge_amount > 0 ? `₱${Number(item.charge_amount).toFixed(2)}` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[10px]">Cleared</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isUnsettled ? (
                            <button
                              onClick={() => handleOpenResolve(item)}
                              className="bg-[#A5192D] hover:bg-[#8B1424] text-white text-[10px] font-bold px-2.5 py-1 rounded transition-colors shadow-sm"
                            >
                              Resolve
                            </button>
                          ) : isEquipment && (settle === 'replaced' || settle === 'paid') ? (
                            <span className="text-emerald-600 font-bold text-[10px]">✓ Settled</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resolve Inline Settlement Modal */}
          {resolvingItem && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-red-900 text-sm flex items-center gap-1.5">
                  <FiCheckCircle className="text-red-700" size={16} />
                  Resolve Equipment Settlement: {resolvingItem.brand_name || resolvingItem.generic_name}
                </h4>
                <button onClick={() => setResolvingItem(null)} className="text-red-500 hover:text-red-700 text-xs font-bold">
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-red-900 uppercase mb-1">Resolution Status</label>
                  <select
                    value={resolveAction}
                    onChange={e => setResolveAction(e.target.value as any)}
                    className="w-full bg-white border border-red-300 rounded px-2.5 py-1.5 font-bold text-slate-800"
                  >
                    <option value="replaced">✅ Replaced (Nailisan na sa borrower)</option>
                    <option value="paid">💵 Paid / Reimbursed (Nabayran na sa borrower)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-red-900 uppercase mb-1">Amount / Cost (₱)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={resolveAmount || ''}
                    onChange={e => setResolveAmount(parseFloat(e.target.value))}
                    className="w-full bg-white border border-red-300 rounded px-2.5 py-1.5 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-red-900 uppercase mb-1">Resolution Notes / Receipt #</label>
                  <input
                    type="text"
                    placeholder="e.g. Received new replacement unit or Official Receipt #..."
                    value={resolveNotes}
                    onChange={e => setResolveNotes(e.target.value)}
                    className="w-full bg-white border border-red-300 rounded px-2.5 py-1.5 text-slate-800"
                  />
                </div>
              </div>

              {resolveAction === 'replaced' && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={restockNow}
                    onChange={e => setRestockNow(e.target.checked)}
                    className="accent-[#A5192D] rounded"
                  />
                  <span>Automatically add <strong>1 unit</strong> to clinic inventory batches as active stock.</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingItem(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resolvingSubmitting}
                  onClick={handleConfirmResolve}
                  className="bg-[#A5192D] hover:bg-[#8B1424] text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-60"
                >
                  {resolvingSubmitting ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-2xl">
          <button onClick={() => printBorrowingSlip(currentRecord, 'history')} className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-100 transition-colors">
            <FiPrinter size={15} /> Print Borrowing Slip
          </button>
          <button onClick={onClose} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Booking History List (compact)
───────────────────────────────────────────────────────────────── */
const BookingHistoryList: React.FC = () => {
  const { selectedBranch, isSuperAdmin } = useBranch();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    const branchParam = isSuperAdmin && selectedBranch && selectedBranch !== 'All Branches'
      ? `&branch=${encodeURIComponent(selectedBranch)}`
      : '';
    apiFetch(`/api/index.php?route=borrowings&action=recent_history${branchParam}`)
      .then(res => { setHistory(res.history || []); setLoading(false); })
      .catch(() => { toast.error('Failed to load history'); setLoading(false); });
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedBranch]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading history...</div>;

  return (
    <div className="p-5 h-full overflow-y-auto">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-20">
          <FiBox size={48} className="mb-4 opacity-40" />
          <h3 className="text-xl font-semibold text-slate-600">No booking history available</h3>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((record) => {
            const isReturned = record.borrowing_status === 'returned';
            const hasPendingSettlement = (record.items || []).some((item: any) =>
              item.item_type === 'equipment' &&
              (item.condition_status === 'damaged' || item.condition_status === 'lost') &&
              (item.settlement_action === 'to_replace' || item.settlement_action === 'to_pay')
            );

            return (
              <div key={record.id} className={`border rounded-xl bg-white hover:shadow-sm transition-all ${hasPendingSettlement ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-xs font-extrabold bg-[#8c1526] text-white px-2 py-1 rounded shrink-0">
                    {record.booking_code}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{record.first_name} {record.last_name}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold uppercase">{record.profile_type}</span>
                      {record.clinic_branch && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {record.clinic_branch}
                        </span>
                      )}
                      {isReturned
                        ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Returned</span>
                        : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Active</span>
                      }
                      {hasPendingSettlement && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-red-200">
                          <FiAlertTriangle size={11} /> Settlement Pending (Ilisan/Bayaran)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500">{record.purpose}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] font-bold text-slate-500">{record.items.length} item{record.items.length !== 1 ? 's' : ''}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] text-slate-400">{fmtDateShort(record.created_at)}</span>
                      {record.returned_at && (
                        <>
                          <span className="text-[10px] text-slate-300">→</span>
                          <span className="text-[10px] text-slate-400">Returned {fmtDateShort(record.returned_at)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      title="View transaction details"
                    >
                      <FiEye size={14} /> View Details
                    </button>
                    <button onClick={() => printBorrowingSlip(record, 'history')} title="Print borrowing slip"
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <FiPrinter size={16} />
                    </button>
                  </div>
                </div>

                {/* Items pills */}
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {record.items.map((item: any, i: number) => {
                    const isDamaged = item.item_type === 'equipment' && item.condition_status === 'damaged';
                    const isLost = item.item_type === 'equipment' && item.condition_status === 'lost';
                    const isUnsettled = isDamaged || isLost;

                    let pillClass = 'bg-emerald-50 text-emerald-700';
                    let label = `${item.generic_name} ×${item.quantity}`;

                    if (isUnsettled) {
                      pillClass = 'bg-red-50 text-red-700 border border-red-200 font-semibold';
                      const settleLabel = item.settlement_action === 'to_replace' ? 'To Replace' : item.settlement_action === 'to_pay' ? 'To Pay' : item.settlement_action;
                      label += ` (${isDamaged ? 'Damaged' : 'Lost'} · ${settleLabel})`;
                    } else if (item.status === 'dispensed') {
                      pillClass = 'bg-blue-50 text-blue-700';
                    } else if (item.status === 'borrowed') {
                      pillClass = 'bg-amber-50 text-amber-700';
                    } else if (item.quantity_returned !== null) {
                      label += ` (${item.quantity_returned} ret)`;
                    }

                    return (
                      <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pillClass}`}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History detail modal */}
      {selectedRecord && (
        <HistoryDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onRefresh={fetchHistory}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Main Borrowings Page
───────────────────────────────────────────────────────────────── */
const Borrowings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkedOut' | 'newBooking' | 'history'>('checkedOut');
  const [slipData, setSlipData] = useState<any>(null);
  const [slipMode, setSlipMode] = useState<'checkout' | 'history'>('checkout');
  const [slipPaperSize, setSlipPaperSize] = useState<'quarter_long' | 'half_long' | 'full_long'>('quarter_long');
  const [showSlipModal, setShowSlipModal] = useState(false);

  useEffect(() => {
    globalOpenBorrowingSlip = (b: any, mode: 'checkout' | 'history' = 'checkout') => {
      setSlipData(b);
      setSlipMode(mode);
      setShowSlipModal(true);
    };
    return () => {
      globalOpenBorrowingSlip = null;
    };
  }, []);

  return (
    <div className="px-5 py-5 w-full h-full flex flex-col">
      <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-end gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full w-full xl:w-auto">
          {(['checkedOut', 'newBooking', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-white text-[#A5192D] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {tab === 'checkedOut' ? 'Checked Out Equipment' : tab === 'newBooking' ? 'New Booking Form' : 'Booking History'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'checkedOut' && <CheckedOutList />}
        {activeTab === 'newBooking' && <NewBookingForm onSuccess={() => setActiveTab('checkedOut')} />}
        {activeTab === 'history' && <BookingHistoryList />}
      </div>

      {/* In-App Equipment Borrowing Slip Modal (1/4 Folio default) */}
      {showSlipModal && slipData && (
        <BorrowingSlipModal
          data={slipData}
          mode={slipMode}
          paperSize={slipPaperSize}
          onPaperSizeChange={setSlipPaperSize}
          onClose={() => setShowSlipModal(false)}
        />
      )}
    </div>
  );
};

export default Borrowings;
