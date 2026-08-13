import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiCheckCircle, FiPackage, FiUser, FiBox, FiBriefcase, FiSearch,
  FiPrinter, FiClock, FiAlertTriangle, FiChevronRight, FiX, FiRotateCcw,
  FiCalendar, FiInfo
} from 'react-icons/fi';
import { useConfirm } from '../context/ConfirmContext';

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
}

interface BorrowingDetail {
  borrowing_id: number;
  booking_code: string;
  purpose: string;
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
   Print Slip — window.open approach (reliable, no ref timing issues)
───────────────────────────────────────────────────────────────── */
function printBorrowingSlip(b: any) {
  if (!b) return;
  const itemRows = (b.items || []).map((item: any, idx: number) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};border-bottom:1px solid #eee">
      <td style="padding:6px 10px">${idx + 1}</td>
      <td style="padding:6px 10px;font-weight:600">${item.brand_name ? item.brand_name + (item.generic_name ? ' — ' + item.generic_name : '') : item.generic_name}</td>
      <td style="padding:6px 10px;text-align:center;text-transform:capitalize">${item.category || item.item_type}</td>
      <td style="padding:6px 10px;text-align:center">
        <span style="background:${item.item_type === 'equipment' ? '#dbeafe' : '#dcfce7'};color:${item.item_type === 'equipment' ? '#1d4ed8' : '#15803d'};padding:1px 8px;border-radius:4px;font-size:11px;font-weight:700">
          ${item.item_type === 'equipment' ? 'To Return' : 'Consumable'}
        </span>
      </td>
      <td style="padding:6px 10px;text-align:center;font-weight:700">${item.quantity}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Borrowing Slip — ${b.booking_code}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#000}
    *{box-sizing:border-box}
    @page{margin:12mm}
    @media print{body{padding:0}}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#A5192D;color:#fff;padding:6px 10px;text-align:left;font-weight:700}
    .label{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .section{border:1px solid #ddd;border-radius:6px;padding:12px;margin-bottom:14px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px}
    .sigline{border-bottom:1.5px solid #333;min-height:28px;margin-bottom:4px}
    .siglabel{font-size:11px;color:#555}
  </style>
  </head><body>
  <div style="max-width:680px;margin:0 auto;border:2px solid #333;border-radius:8px;padding:24px">
    <div style="text-align:center;border-bottom:2px solid #A5192D;padding-bottom:12px;margin-bottom:16px">
      <div style="font-size:11px;color:#A5192D;font-weight:700;letter-spacing:2px;text-transform:uppercase">CJC Clinic Management System</div>
      <div style="font-size:22px;font-weight:900;color:#A5192D;margin-top:2px">EQUIPMENT BORROWING SLIP</div>
      <div style="font-size:12px;color:#555;margin-top:2px">College Clinic</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px;gap:12px">
      <div>
        <div class="label">Booking Reference</div>
        <div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#A5192D;font-family:monospace">${b.booking_code}</div>
      </div>
      <div style="text-align:right">
        <div class="label">Date Borrowed</div>
        <div style="font-size:13px;font-weight:600">${fmtDate(b.created_at)}</div>
        ${b.expected_return_date ? `<div class="label" style="margin-top:8px">Expected Return</div><div style="font-size:13px;font-weight:600;color:${b.is_overdue ? '#c00' : '#000'}">${fmtDate(b.expected_return_date)}</div>` : ''}
      </div>
    </div>
    <div class="section">
      <div class="label">Borrower Information</div>
      <div class="grid2">
        <div><strong>Name:</strong> ${b.first_name} ${b.last_name}</div>
        <div><strong>Type:</strong> ${b.profile_type ? b.profile_type.charAt(0).toUpperCase() + b.profile_type.slice(1) : ''}</div>
        ${b.course ? `<div><strong>Course:</strong> ${b.course} ${b.year_level || ''}</div>` : ''}
        ${b.department ? `<div><strong>Department:</strong> ${b.department}</div>` : ''}
        <div style="grid-column:1/-1"><strong>Purpose:</strong> ${b.purpose}</div>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div class="label">Items Borrowed</div>
      <table><thead><tr><th>#</th><th>Item Name</th><th style="text-align:center">Category</th><th style="text-align:center">Type</th><th style="text-align:center">Qty</th></tr></thead>
      <tbody>${itemRows}</tbody></table>
    </div>
    <div class="section">
      <div class="label">Acknowledgment &amp; Signatures</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:13px">
        <div><div class="sigline"></div><div class="siglabel">Released by (Staff) + Date</div></div>
        <div><div class="sigline"></div><div class="siglabel">Received by (Borrower) + Date</div></div>
        <div><div class="sigline"></div><div class="siglabel">Returned to (Staff) + Date</div></div>
        <div><div class="sigline"></div><div class="siglabel">Borrower's Signature + Date</div></div>
      </div>
    </div>
    <div style="font-size:10px;color:#888;line-height:1.5;border-top:1px solid #eee;padding-top:10px">
      <strong>Terms &amp; Conditions:</strong> The borrower is responsible for returning all equipment in the same condition as when borrowed. Any equipment that is lost or damaged must be replaced or the cost of repair/replacement reimbursed to the clinic. Consumable supplies are permanently dispensed and non-returnable. This slip must be presented upon return.
    </div>
    <div style="text-align:center;font-size:10px;color:#aaa;margin-top:10px">CJC Clinic Patient Records System • ${new Date().toLocaleString()}</div>
  </div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=860,height=720');
  if (!win) { toast.error('Please allow popups to enable printing.'); return; }
  win.document.write(html);
  win.document.close();
}






/* ─────────────────────────────────────────────────────────────────
   Return Reconciliation Modal
───────────────────────────────────────────────────────────────── */
interface ReconcileModalProps {
  borrowingId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ReconcileModal: React.FC<ReconcileModalProps> = ({ borrowingId, onClose, onSuccess }) => {
  const [detail, setDetail] = useState<BorrowingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [reconcile, setReconcile] = useState<Record<number, { returned: number; consumed: number }>>({});

  useEffect(() => {
    if (!borrowingId) return;
    setLoading(true);
    apiFetch(`/api/index.php?route=borrowings&action=detail&borrowing_id=${borrowingId}`)
      .then(res => {
        setDetail(res.borrowing);
        // Default: equipment items → all returned, supplies → all consumed
        const init: Record<number, { returned: number; consumed: number }> = {};
        (res.borrowing?.items || []).forEach((item: BorrowedItemDetail) => {
          if (item.status === 'borrowed') {
            init[item.borrowed_item_id] = {
              returned: item.item_type === 'equipment' ? item.quantity : 0,
              consumed: item.item_type === 'supply' ? item.quantity : 0
            };
          }
        });
        setReconcile(init);
      })
      .catch(() => toast.error('Failed to load borrowing details'))
      .finally(() => setLoading(false));
  }, [borrowingId]);

  const handleSubmit = async () => {
    if (!detail) return;
    const items = detail.items
      .filter(i => i.status === 'borrowed')
      .map(i => ({
        borrowed_item_id: i.borrowed_item_id,
        quantity_returned: reconcile[i.borrowed_item_id]?.returned ?? 0,
        quantity_consumed: reconcile[i.borrowed_item_id]?.consumed ?? 0,
      }));

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/index.php?route=borrowings&action=return_borrowing', {
        method: 'POST',
        body: JSON.stringify({ borrowing_id: detail.borrowing_id, notes, items })
      });
      if (res.fully_returned) {
        toast.success('All items returned — borrowing closed!');
      } else {
        toast.success('Partial return processed successfully.');
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <FiRotateCcw className="text-[#A5192D]" size={18} />
              <h2 className="text-lg font-bold text-slate-800">Process Return</h2>
              {detail && (
                <span className="font-mono text-xs font-extrabold bg-[#A5192D] text-white px-2 py-0.5 rounded">
                  {detail.booking_code}
                </span>
              )}
            </div>
            {detail && (
              <p className="text-sm text-slate-500 mt-0.5">
                {detail.first_name} {detail.last_name} · {detail.course || detail.department} {detail.year_level}
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
              <span>Due: <strong>{fmtDate(detail.expected_return_date)}</strong></span>
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
              {/* Legend */}
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <FiInfo size={13} className="text-blue-500 shrink-0" />
                <span>Enter how many of each item were <strong>returned</strong> (goes back to inventory) and how many were <strong>consumed/lost</strong>.</span>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-center">Borrowed</div>
                <div className="col-span-2 text-center">Returned</div>
                <div className="col-span-2 text-center">Consumed</div>
                <div className="col-span-1"></div>
              </div>

              {detail.items.map(item => {
                const isSettled = item.status !== 'borrowed';
                const r = reconcile[item.borrowed_item_id] ?? { returned: 0, consumed: 0 };
                const isSupply = item.item_type === 'supply';
                const total = r.returned + r.consumed;
                const overAllocated = total > item.quantity;

                return (
                  <div key={item.borrowed_item_id} className={`grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg border transition-colors ${isSettled ? 'bg-slate-50 border-slate-100 opacity-60' : overAllocated ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                    {/* Item name */}
                    <div className="col-span-5">
                      <p className="font-semibold text-slate-800 text-sm leading-tight">
                        {item.brand_name || item.generic_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isSupply ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isSupply ? 'Supply' : 'Equipment'}
                        </span>
                        {isSettled && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Settled</span>}
                      </div>
                    </div>

                    {/* Qty borrowed */}
                    <div className="col-span-2 text-center">
                      <span className="text-sm font-bold text-slate-700">{item.quantity}</span>
                    </div>

                    {/* Qty returned (equipment only) */}
                    <div className="col-span-2 text-center">
                      {isSupply ? (
                        <span className="text-xs text-slate-400 italic">N/A</span>
                      ) : isSettled ? (
                        <span className="text-sm font-bold text-emerald-600">{item.quantity_returned ?? '—'}</span>
                      ) : (
                        <input
                          type="number" min={0} max={item.quantity}
                          value={r.returned}
                          onChange={e => setReconcile(prev => ({ ...prev, [item.borrowed_item_id]: { ...r, returned: Math.max(0, Math.min(item.quantity, +e.target.value)) } }))}
                          className="w-16 mx-auto block text-center border border-slate-200 rounded-md p-1 text-sm font-bold focus:outline-none focus:border-emerald-500"
                        />
                      )}
                    </div>

                    {/* Qty consumed/lost */}
                    <div className="col-span-2 text-center">
                      {isSupply ? (
                        isSettled ? (
                          <span className="text-sm font-bold text-amber-600">{item.quantity}</span>
                        ) : (
                          <span className="text-sm font-bold text-amber-600">{item.quantity}</span>
                        )
                      ) : isSettled ? (
                        <span className="text-sm font-bold text-amber-600">{item.quantity_consumed ?? '—'}</span>
                      ) : (
                        <input
                          type="number" min={0} max={item.quantity}
                          value={r.consumed}
                          onChange={e => setReconcile(prev => ({ ...prev, [item.borrowed_item_id]: { ...r, consumed: Math.max(0, Math.min(item.quantity, +e.target.value)) } }))}
                          className="w-16 mx-auto block text-center border border-slate-200 rounded-md p-1 text-sm font-bold focus:outline-none focus:border-amber-500"
                        />
                      )}
                    </div>

                    {/* Over-allocated warning */}
                    <div className="col-span-1 flex justify-center">
                      {overAllocated && (
                        <FiAlertTriangle className="text-red-500" size={16} title={`Total (${total}) exceeds borrowed qty (${item.quantity})`} />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 mt-2">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Wheel chair returned with minor scratch..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#A5192D] resize-none transition-colors"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={() => detail && printBorrowingSlip(detail)}
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
              {submitting ? 'Processing...' : 'Process Return'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden print slip */}
      {detail && <PrintSlip borrowing={detail} printRef={printRef} />}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Checked Out List (compact, grouped by borrowing)
───────────────────────────────────────────────────────────────── */
const CheckedOutList: React.FC = () => {
  const [items, setItems] = useState<CheckedOutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<number | null>(null);

  const fetchCheckedOut = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/index.php?route=borrowings&action=checked_out');
      setItems(res.checked_out || []);
    } catch (e) {
      toast.error('Failed to load checked out equipment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCheckedOut(); }, []);

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
                    onClick={() => printBorrowingSlip(row)}
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
  const printRef = useRef<HTMLDivElement>(null);
  const triggerPrint = usePrint(printRef);

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
            onClick={() => printBorrowingSlip(printData)}
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
   Booking History List (compact)
───────────────────────────────────────────────────────────────── */
const BookingHistoryList: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const triggerPrint = usePrint(printRef);

  useEffect(() => {
    apiFetch('/api/index.php?route=borrowings&action=recent_history')
      .then(res => { setHistory(res.history || []); setLoading(false); })
      .catch(() => { toast.error('Failed to load history'); setLoading(false); });
  }, []);

  const handlePrint = (record: any) => {
    setPrintBorrowing(record);
    setTimeout(() => triggerPrint(), 100);
  };

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
            return (
              <div key={record.id} className="border border-slate-200 rounded-xl bg-white hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-xs font-extrabold bg-[#8c1526] text-white px-2 py-1 rounded shrink-0">
                    {record.booking_code}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{record.first_name} {record.last_name}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold uppercase">{record.profile_type}</span>
                      {isReturned
                        ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Returned</span>
                        : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Active</span>
                      }
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

                  <button onClick={() => printBorrowingSlip(record)} title="Print borrowing slip"
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                    <FiPrinter size={16} />
                  </button>
                </div>

                {/* Items pills */}
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {record.items.map((item: any, i: number) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.status === 'returned' ? 'bg-emerald-50 text-emerald-700' : item.status === 'dispensed' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.generic_name} ×{item.quantity}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Main Borrowings Page
───────────────────────────────────────────────────────────────── */
const Borrowings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkedOut' | 'newBooking' | 'history'>('checkedOut');

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
    </div>
  );
};

export default Borrowings;
