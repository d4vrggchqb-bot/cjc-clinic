import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiCheckCircle, FiPackage, FiUser, FiBox, FiBriefcase, FiSearch,
  FiPrinter, FiClock, FiAlertTriangle, FiChevronRight, FiX, FiRotateCcw,
  FiCalendar, FiInfo, FiEye
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
   Print Slip — window.open approach (reliable, mode-aware)
───────────────────────────────────────────────────────────────── */
function printBorrowingSlip(b: any, mode: 'checkout' | 'history' = 'checkout') {
  if (!b) return;

  const logoSrc = `${window.location.origin}/med_cert_header.png`;
  const isHistory = mode === 'history' || b.borrowing_status === 'returned' || Boolean(b.returned_at);

  let tableHeaderHtml = '';
  let itemRowsHtml = '';

  const hasUnsettled = (b.items || []).some((item: any) =>
    item.item_type === 'equipment' &&
    (item.condition_status === 'damaged' || item.condition_status === 'lost') &&
    (item.settlement_action === 'to_replace' || item.settlement_action === 'to_pay')
  );

  if (isHistory) {
    tableHeaderHtml = `
      <tr>
        <th style="padding:6px 8px;text-align:left">#</th>
        <th style="padding:6px 8px;text-align:left">Item / Apparatus</th>
        <th style="padding:6px 8px;text-align:center">Category</th>
        <th style="padding:6px 8px;text-align:center">Borrowed</th>
        <th style="padding:6px 8px;text-align:center">Returned</th>
        <th style="padding:6px 8px;text-align:center">Condition</th>
        <th style="padding:6px 8px;text-align:center">Settlement Status</th>
      </tr>
    `;

    itemRowsHtml = (b.items || []).map((item: any, idx: number) => {
      const isSupply = item.item_type === 'supply';
      const cond = item.condition_status || 'good';
      const settle = item.settlement_action || 'none';
      const ret = item.quantity_returned !== null ? item.quantity_returned : (item.status === 'returned' ? item.quantity : 0);

      let condBadge = `<span style="background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">GOOD / FUNCTIONAL</span>`;
      if (!isSupply) {
        if (cond === 'damaged') {
          condBadge = `<span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">DAMAGED (GUBA)</span>`;
        } else if (cond === 'lost') {
          condBadge = `<span style="background:#ffedd5;color:#c2410c;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">LOST (NAWALA)</span>`;
        }
      } else {
        condBadge = `<span style="color:#64748b;font-size:10px">Consumable</span>`;
      }

      let settleText = `<span style="color:#15803d;font-weight:600">Cleared</span>`;
      if (!isSupply && (cond === 'damaged' || cond === 'lost')) {
        if (settle === 'to_replace') {
          settleText = `<strong style="color:#dc2626">To Replace (Ilisan)</strong>`;
        } else if (settle === 'to_pay') {
          settleText = `<strong style="color:#dc2626">To Pay (Bayaran)${item.charge_amount > 0 ? ' &#8212; &#8369;' + Number(item.charge_amount).toFixed(2) : ''}</strong>`;
        } else if (settle === 'replaced') {
          settleText = `<strong style="color:#16a34a">Replaced (Nailisan na)</strong>`;
        } else if (settle === 'paid') {
          settleText = `<strong style="color:#16a34a">Paid (Nabayran na)${item.charge_amount > 0 ? ' &#8212; &#8369;' + Number(item.charge_amount).toFixed(2) : ''}</strong>`;
        }
        if (item.settlement_notes) {
          settleText += `<br><span style="font-size:9px;color:#555">Note: ${item.settlement_notes}</span>`;
        }
      }

      return `
        <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f9'};border-bottom:1px solid #eee">
          <td style="padding:6px 8px">${idx + 1}</td>
          <td style="padding:6px 8px;font-weight:600">${item.brand_name ? item.brand_name + (item.generic_name ? ' &#8212; ' + item.generic_name : '') : item.generic_name}</td>
          <td style="padding:6px 8px;text-align:center;text-transform:capitalize">${item.category || item.item_type}</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700">${item.quantity}</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700;color:#15803d">${ret}</td>
          <td style="padding:6px 8px;text-align:center">${condBadge}</td>
          <td style="padding:6px 8px;text-align:center;font-size:11px">${settleText}</td>
        </tr>
      `;
    }).join('');

  } else {
    // Checkout mode
    tableHeaderHtml = `
      <tr>
        <th style="padding:6px 10px;text-align:left">#</th>
        <th style="padding:6px 10px;text-align:left">Item Name</th>
        <th style="padding:6px 10px;text-align:center">Category</th>
        <th style="padding:6px 10px;text-align:center">Type</th>
        <th style="padding:6px 10px;text-align:center">Qty Borrowed</th>
      </tr>
    `;

    itemRowsHtml = (b.items || []).map((item: any, idx: number) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f9'};border-bottom:1px solid #eee">
        <td style="padding:6px 10px">${idx + 1}</td>
        <td style="padding:6px 10px;font-weight:600">${item.brand_name ? item.brand_name + (item.generic_name ? ' &#8212; ' + item.generic_name : '') : item.generic_name}</td>
        <td style="padding:6px 10px;text-align:center;text-transform:capitalize">${item.category || item.item_type}</td>
        <td style="padding:6px 10px;text-align:center">
          <span style="background:${item.item_type === 'equipment' ? '#dbeafe' : '#dcfce7'};color:${item.item_type === 'equipment' ? '#1d4ed8' : '#15803d'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">
            ${item.item_type === 'equipment' ? 'To Return' : 'Consumable'}
          </span>
        </td>
        <td style="padding:6px 10px;text-align:center;font-weight:700">${item.quantity}</td>
      </tr>
    `).join('');
  }

  const docTitle = isHistory ? 'EQUIPMENT BORROWING & RETURN RECEIPT' : 'EQUIPMENT BORROWING SLIP';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${docTitle} &#8212; ${b.booking_code}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:0;color:#000;font-size:12px}
    *{box-sizing:border-box}
    @page{margin:10mm 12mm}
    @media print{body{padding:0}}
    .wrap{max-width:700px;margin:0 auto;padding:0}
    .cjc-banner{width:100%;max-width:700px;height:auto;display:block;margin:0 auto 10px}
    .doc-title{text-align:center;font-size:14px;font-weight:900;color:#A5192D;letter-spacing:1.5px;text-transform:uppercase;margin:6px 0;padding:4px 0;border-bottom:2px solid #A5192D}
    .meta-row{display:flex;justify-content:space-between;gap:12px;margin:10px 0;font-size:12px}
    .meta-block{flex:1}
    .label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
    .section{border:1px solid #ddd;border-radius:5px;padding:10px;margin-bottom:10px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
    table{width:100%;border-collapse:collapse}
    th{background:#A5192D;color:#fff;padding:6px 8px;font-weight:700;font-size:11px}
    td{padding:6px 8px;font-size:12px}
    .sigline{border-bottom:1.5px solid #333;min-height:22px;margin-bottom:3px}
    .siglabel{font-size:10px;color:#555}
    .footer{text-align:center;font-size:9px;color:#aaa;margin-top:10px;border-top:1px solid #eee;padding-top:6px}
  </style>
  </head><body>
  <div class="wrap">
    <!-- OFFICIAL MED CERT BANNER HEADER -->
    <img class="cjc-banner" src="${logoSrc}" alt="Cor Jesu College Clinic Header" />
    
    <!-- DOCUMENT TITLE -->
    <div class="doc-title">${docTitle}</div>
    
    <!-- META -->
    <div class="meta-row">
      <div class="meta-block">
        <div class="label">Booking Reference</div>
        <div style="font-size:18px;font-weight:900;letter-spacing:2px;color:#A5192D;font-family:monospace">${b.booking_code}</div>
        ${b.clinic_branch ? `<div style="font-size:11px;color:#666;font-weight:600;margin-top:2px">${b.clinic_branch}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div class="label">Date Borrowed</div>
        <div style="font-weight:600">${fmtDate(b.created_at)}</div>
        ${b.expected_return_date ? `<div class="label" style="margin-top:4px">Expected Return</div><div style="font-weight:600;color:${b.is_overdue ? '#c00' : '#000'}">${fmtDate(b.expected_return_date)}</div>` : ''}
        ${b.returned_at ? `<div class="label" style="margin-top:4px">Actual Date Returned</div><div style="font-weight:700;color:#15803d">${fmtDate(b.returned_at)}</div>` : ''}
      </div>
    </div>
    
    <!-- BORROWER INFORMATION -->
    <div class="section">
      <div class="label">Borrower Information</div>
      <div class="grid2" style="margin-top:6px">
        <div><strong>Name:</strong> ${b.first_name} ${b.last_name}</div>
        <div><strong>Type:</strong> ${b.profile_type ? b.profile_type.charAt(0).toUpperCase() + b.profile_type.slice(1) : ''}</div>
        ${b.course ? `<div><strong>Course:</strong> ${b.course} ${b.year_level || ''}</div>` : ''}
        ${b.department ? `<div><strong>Department:</strong> ${b.department}</div>` : ''}
        <div style="grid-column:1/-1"><strong>Purpose:</strong> ${b.purpose}</div>
      </div>
    </div>
    
    <!-- ITEMS TABLE -->
    <div style="margin-bottom:10px">
      <div class="label">${isHistory ? 'Items, Condition & Reconciliation Status' : 'Items Borrowed'}</div>
      <table style="margin-top:4px">
        <thead>${tableHeaderHtml}</thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>
    </div>

    ${hasUnsettled ? `
    <!-- UNSETTLED EQUIPMENT ALERT -->
    <div style="margin:10px 0;padding:10px 14px;border:1.5px solid #dc2626;background:#fef2f2;border-radius:6px;font-size:11px;color:#991b1b">
      <strong style="font-size:12px;display:block;margin-bottom:4px">&#9888; NOTICE OF PENDING EQUIPMENT SETTLEMENT (ILISAN / BAYARAN):</strong>
      The borrower returned equipment that is damaged or lost. Per CJC Clinic policy, the borrower is accountable to either replace (ilisan) or reimburse (bayaran) the item(s) listed below:
      <ul style="margin:6px 0 0 16px;padding:0">
        ${(b.items || []).filter((i: any) => i.item_type === 'equipment' && (i.condition_status === 'damaged' || i.condition_status === 'lost')).map((i: any) => `
          <li style="margin-bottom:3px">
            <strong>${i.brand_name ? i.brand_name + ' &#8212; ' : ''}${i.generic_name}</strong>: 
            Condition: <span style="font-weight:bold;text-transform:uppercase">${i.condition_status}</span> &bull; 
            Action: <strong>${i.settlement_action === 'to_replace' ? 'To Replace (Ilisan)' : i.settlement_action === 'to_pay' ? 'To Pay / Reimburse (Bayaran)' : i.settlement_action}</strong>
            ${i.charge_amount > 0 ? ` &bull; Amount: &#8369;${Number(i.charge_amount).toFixed(2)}` : ''}
            ${i.settlement_notes ? ` &bull; <em>"${i.settlement_notes}"</em>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    
    <!-- ACKNOWLEDGMENT & AUTO-FILLED SIGNATURES -->
    <div class="section">
      <div class="label" style="margin-bottom:8px">Acknowledgment &amp; Signatures</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;margin-top:4px">
        <div>
          <div style="font-weight:700;font-size:12px;color:#000;border-bottom:1.5px solid #333;padding-bottom:2px;min-height:18px">
            ${b.released_by_name || 'Clinic Staff'} &bull; <span style="font-weight:normal;font-size:11px;color:#444">${fmtDate(b.created_at)}</span>
          </div>
          <div class="siglabel" style="margin-top:3px">Released by / Date</div>
        </div>
        <div>
          <div style="font-weight:700;font-size:12px;color:#000;border-bottom:1.5px solid #333;padding-bottom:2px;min-height:18px">
            ${b.first_name} ${b.last_name} &bull; <span style="font-weight:normal;font-size:11px;color:#444">${fmtDate(b.created_at)}</span>
          </div>
          <div class="siglabel" style="margin-top:3px">Received by / Date</div>
        </div>
        <div>
          <div style="font-weight:700;font-size:12px;color:#000;border-bottom:1.5px solid #333;padding-bottom:2px;min-height:18px">
            ${b.returned_to_name ? `${b.returned_to_name} &bull; <span style="font-weight:normal;font-size:11px;color:#444">${fmtDate(b.returned_at)}</span>` : (b.returned_at ? `Clinic Staff &bull; <span style="font-weight:normal;font-size:11px;color:#444">${fmtDate(b.returned_at)}</span>` : '&nbsp;')}
          </div>
          <div class="siglabel" style="margin-top:3px">Returned to / Date</div>
        </div>
        <div>
          <div style="font-weight:700;font-size:12px;color:#000;border-bottom:1.5px solid #333;padding-bottom:2px;min-height:18px">
            ${b.first_name} ${b.last_name} &bull; <span style="font-weight:normal;font-size:11px;color:#444">${b.returned_at ? fmtDate(b.returned_at) : fmtDate(b.created_at)}</span>
          </div>
          <div class="siglabel" style="margin-top:3px">Borrower's Signature / Date</div>
        </div>
      </div>
    </div>
    
    <!-- TERMS -->
    <div style="font-size:9.5px;color:#888;line-height:1.5;border-top:1px solid #eee;padding-top:8px">
      <strong>Terms &amp; Conditions:</strong> The borrower is responsible for returning all equipment in the same condition as when borrowed. Equipment that is lost or damaged must be replaced or the cost reimbursed to the clinic. Consumable supplies are permanently dispensed upon use. Unused returned items are restocked to clinic inventory.
    </div>
    <div class="footer">CJC Clinic Patient Records System &bull; Printed: ${new Date().toLocaleString()}</div>
  </div>
  <script>
    window.onload = function() {
      var img = document.querySelector('.cjc-banner');
      if (img && (!img.complete || img.naturalWidth === 0)) {
        img.onload = function() { window.print(); };
        img.onerror = function() { window.print(); };
      } else {
        window.print();
      }
    };
  <\/script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=860,height=780');
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
        toast.success('Return processed and inventory synchronized successfully!');
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
                <div>
                  <p className="font-bold text-emerald-900">Equipment Inspection &amp; Auto-Restock Verification</p>
                  <p className="mt-0.5 text-emerald-800 leading-relaxed">
                    Check the physical condition of returned equipment or apparatus. Functional equipment returned in good condition will be automatically restocked into active inventory. Any <strong>damaged</strong> or <strong>lost</strong> item will be held out of active inventory and flagged for borrower replacement (ilisan) or payment (bayaran).
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
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isSupply ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isSupply ? 'Consumable Supply' : 'Equipment / Apparatus'}
                          </span>
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
                          <div className="text-center text-xs text-slate-400 italic">
                            Consumable Supply
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
