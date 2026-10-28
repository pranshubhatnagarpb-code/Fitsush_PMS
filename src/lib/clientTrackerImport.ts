import * as XLSX from 'xlsx';
import type { TrackerColumnKey } from '@/hooks/useClientTracker';

// Excel View → "Import from Excel": reads the clinic's tracker workbook (one
// tab per month) into client_tracker rows. A port of
// _db/client-tracker-import-history.py, which did the one-time history import —
// same header matching, date parsing, total-row skipping and OTHER column,
// and the same row ids (uuid5 of "<tab>!<row>"), so re-importing a tab the
// history import already loaded doesn't duplicate it.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_COLS = ['entry_date', 'starting_date', 'ending_date'] as const;
const DATE_LABEL: Record<(typeof DATE_COLS)[number], string> = {
  entry_date: 'DATE', starting_date: 'STARTING DATE', ending_date: 'ENDING DATE',
};
const NAMESPACE = '6f1d2c1e-7a43-4c55-9b0e-1f2a3b4c5d6e';
const LABEL_ROW = /^(NAME\s*[l|]\s*(MONTH|DAY)|NAME\s*\|\s*DAY)$/i;

type Mapped = TrackerColumnKey | '__serial' | { unmapped: string };

export type TrackerImportRow = { id: string; month: string; created_at: string } & Partial<Record<TrackerColumnKey, string>>;

export interface ImportTab {
  name: string;
  month: string | null; // yyyy-mm-01 detected from the tab name; staff can change it
  skippedByDefault: boolean; // measurement tabs / no month in the name
}

export interface TabResult {
  rows: TrackerImportRow[];
  unmappedHeaders: string[]; // went into OTHER
  unparsedDates: number; // kept as text in OTHER
  totalsSkipped: number;
}

const norm = (h: unknown) => String(h ?? '').replace(/\s+/g, ' ').trim().toUpperCase().replace(/[:\-. ]+$/, '').trim();

function columnFor(h: unknown): Mapped | null {
  const n = norm(h);
  if (n === 'DATE' || n === 'DATE OF PAYMENT') return 'entry_date';
  if (n === 'NAME') return 'name';
  if (['PAYMENT', 'PAYMENTS', 'AMOUNT', 'AMT', 'PAY'].includes(n)) return 'payment';
  if (n === 'STARTING DATE') return 'starting_date';
  if (n === 'ENDING DATE') return 'ending_date';
  if (n.startsWith('NEXT SESSION')) return 'next_session';
  if (['PENDING PAYMENTS', 'PENDING PPAYMENTS', 'PAYMENTS LEFT'].includes(n)) return 'pending_payments';
  if (['PENDING APPOINTMENTS', 'PENDING APPT', 'PENDING APPTS', 'PENDING CLIENTS'].includes(n)) return 'pending_appointments';
  if (n === 'LEADS') return 'leads';
  if (n === 'REFERENCES') return 'reference';
  if (n === 'MISSED RECALLS') return 'missed_recalls';
  if (n === 'COLLAB' || n === 'INFLUENCERS COLLAB') return 'collab';
  if (n === 'DIET PLAN') return 'diet_plan';
  if (n === 'NON CONVERTED' || n === 'NON-CONVERTED') return 'non_converted';
  if (n.startsWith('FIXED APP')) return 'fixed_appointments';
  if (['DROP OUTS', 'DROP-OUTS', 'DROPOUTS', 'OCT DROPOUTS'].includes(n)) return 'drop_outs';
  if (n.startsWith('BEFORE')) return 'before_after';
  if (n === 'REVIEW') return 'review';
  if (n.startsWith('SR') || n.startsWith('SIR')) return '__serial';
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};

// "SEPTEMBER - 2026", "Jan 24", … → 2026-09-01
export function tabMonth(name: string): string | null {
  const low = name.toLowerCase();
  const m = MONTHS.findIndex((mm) => low.includes(mm));
  const y = /(20\d{2})|\b(\d{2})\b/.exec(low);
  if (m < 0 || !y) return null;
  const year = y[1] ? Number(y[1]) : 2000 + Number(y[2]);
  return `${year}-${pad(m + 1)}-01`;
}

type Cell = XLSX.CellObject | undefined;

const dateOfCell = (c: Cell): { y: number; m: number; d: number } | null => {
  if (!c || c.t !== 'n' || !c.z || !XLSX.SSF.is_date(c.z)) return null;
  const p = XLSX.SSF.parse_date_code(c.v as number);
  return p ? { y: p.y, m: p.m, d: p.d } : null;
};

function text(c: Cell): string | null {
  if (!c || c.v === null || c.v === undefined) return null;
  const date = dateOfCell(c);
  if (date) return `${pad(date.d)} ${MONTHS[date.m - 1][0].toUpperCase()}${MONTHS[date.m - 1].slice(1)} ${date.y}`;
  const v = typeof c.v === 'number' && Number.isInteger(c.v) ? String(c.v) : String(c.v);
  const s = v.replace(/[ \t]+/g, ' ').trim();
  return s && s !== '-' ? s : null;
}

// Returns [iso date, leftover text]: text dates ("1ST JULY", "4th") are read using the tab's month/year.
function parseDate(c: Cell, month: string): [string | null, string | null] {
  if (!c || c.v === null || c.v === undefined) return [null, null];
  const date = dateOfCell(c);
  if (date) return [iso(date.y, date.m, date.d), null];
  const s = text(c);
  if (!s) return [null, null];
  const low = s.toLowerCase();
  const [my, mm] = month.split('-').map(Number);
  const onlyDay = /^(\d{1,2})\s*(st|nd|rd|th|ht)?$/.exec(low);
  if (onlyDay) {
    const d = iso(my, mm, Number(onlyDay[1]));
    if (d) return [d, null];
  }
  if (low === '0') return [null, null];
  const dm = /^(\d{1,2})\s*(st|nd|rd|th|ht)?\s*[- ]?\s*([a-z]+)\.?\s*(\d{2,4})?$/.exec(low);
  if (dm) {
    const mi = MONTHS.findIndex((m) => dm[3].startsWith(m));
    if (mi >= 0) {
      let year = my;
      if (dm[4]) { year = Number(dm[4]); if (year < 100) year += 2000; }
      else if (mi + 1 - mm > 6) year -= 1; // "28th dec" on a JAN tab
      else if (mm - (mi + 1) > 6) year += 1; // "3rd jan" on a DEC tab
      const d = iso(year, mi + 1, Number(dm[1]));
      if (d) return [d, null];
    }
  }
  return [null, s];
}

// Monthly totals: SUM(...) / =+K52-style formulas (formulas copying text from another cell are kept).
const isTotalFormula = (c: Cell) => !!c?.f && (c.f.toUpperCase().includes('SUM') || c.f.startsWith('+'));

async function uuid5(name: string): Promise<string> {
  const ns = NAMESPACE.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16));
  const bytes = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function readWorkbook(data: ArrayBuffer): { workbook: XLSX.WorkBook; tabs: ImportTab[] } {
  const workbook = XLSX.read(data, { type: 'array', cellFormula: true, cellNF: true });
  const tabs = workbook.SheetNames.map((name) => {
    const month = tabMonth(name);
    return { name, month, skippedByDefault: !month || name.toUpperCase().includes('MEASURE') };
  });
  return { workbook, tabs };
}

export async function parseTab(workbook: XLSX.WorkBook, tab: string, month: string): Promise<TabResult> {
  const ws = workbook.Sheets[tab];
  const result: TabResult = { rows: [], unmappedHeaders: [], unparsedDates: 0, totalsSkipped: 0 };
  if (!ws?.['!ref']) return result;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cell = (r: number, c: number): Cell => ws[XLSX.utils.encode_cell({ r, c })];

  // Header row (row 1). A second NAME / DATE after NAME starts the tab's measurements block — stop there.
  const colmap = new Map<number, Mapped>();
  let seenName = false;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = cell(range.s.r, c)?.v;
    if (h === undefined || h === null || norm(h) === '') continue;
    const col = columnFor(h);
    if (col === 'name') { if (seenName) break; seenName = true; }
    if (col === 'entry_date' && [...colmap.values()].includes('entry_date') && seenName) break;
    colmap.set(c, col ?? { unmapped: norm(h) });
  }
  const unmapped = new Set<string>();
  const monthStart = new Date(`${month}T00:00:00+05:30`).getTime();

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rec: Partial<Record<TrackerColumnKey, string>> = {};
    const other: string[] = [];
    const dateNotes: string[] = [];
    for (const [c, col] of colmap) {
      const v = cell(r, c);
      if (col === '__serial' || !v || v.v === null || v.v === undefined) continue;
      if (isTotalFormula(v)) { result.totalsSkipped++; continue; }
      if (typeof col === 'object') {
        const t = text(v);
        if (t && !LABEL_ROW.test(t)) { unmapped.add(col.unmapped); other.push(`${col.unmapped}: ${t}`); }
        continue;
      }
      if ((DATE_COLS as readonly string[]).includes(col)) {
        const [d, left] = parseDate(v, month);
        if (d) rec[col] = d;
        if (left) { result.unparsedDates++; dateNotes.unshift(`${DATE_LABEL[col as (typeof DATE_COLS)[number]]}: ${left}`); } // unshift: same order as the history import
        continue;
      }
      const t = text(v);
      if (!t || LABEL_ROW.test(t)) continue;
      rec[col] = rec[col] ? `${rec[col]} / ${t}` : t; // some tabs have two REVIEW columns
    }
    // Text in a date column that isn't a real date is kept in OTHER rather than lost.
    const otherAll = [...dateNotes, ...other];
    if (otherAll.length) rec.other = otherAll.join(' · ');
    const keys = Object.keys(rec);
    if (!keys.length) continue;
    // Monthly total row: only a big number in PAYMENT.
    if (keys.length === 1 && rec.payment && /^\d+$/.test(rec.payment) && Number(rec.payment) >= 50000) {
      result.totalsSkipped++;
      continue;
    }
    const sheetRow = r + 1;
    result.rows.push({
      ...rec,
      id: await uuid5(`${tab}!${sheetRow}`),
      month,
      // Month start + sheet row number in seconds, so the page lists rows in sheet order.
      created_at: new Date(monthStart + sheetRow * 1000).toISOString(),
    });
  }
  result.unmappedHeaders = [...unmapped];
  return result;
}
