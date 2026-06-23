// ─── Shared Helper Utilities ──────────────────────────────────────────────────

export function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generate4Digit() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  return `${formatDate(ts)} · ${formatTime(ts)}`;
}

export function pctColor(p) {
  if (p >= 75) return 'text-emerald-400';
  if (p >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export function pctBadge(p) {
  if (p >= 75) return 'badge-green';
  if (p >= 60) return 'badge-amber';
  return 'badge-red';
}

export function calcPct(present, total) {
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

export function initials(name = '') {
  return (name || '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

export function avatarBg(str = '') {
  const palette = ['#0e7dff','#a855f7','#10d97e','#f59e0b','#ef4444','#06b6d4','#ec4899','#8b5cf6'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

export function truncate(s, n = 28) {
  return s?.length > n ? s.slice(0, n) + '…' : s || '';
}

// GPS distance (Haversine) in metres
export function gpsDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseExcelRows(rows) {
  return rows
    .filter(r => r[0] || r[1])
    .map((r, i) => ({
      rollNumber: String(r[0] || `S${String(i + 1).padStart(3, '0')}`).trim(),
      name:       String(r[1] || 'Unknown').trim(),
      email:      String(r[2] || '').trim(),
      phone:      String(r[3] || '').trim(),
    }));
}

export function roleLabel(role) {
  const map = {
    owner:    'Platform Owner',
    chairman: 'Chairman',
    teacher:  'Teacher',
    cr:       'Class Representative',
    student:  'Student',
  };
  return map[role] || role;
}

export function roleBadge(role) {
  const map = {
    owner:    'badge-purple',
    chairman: 'badge-cyan',
    teacher:  'badge-blue',
    cr:       'badge-amber',
    student:  'badge-green',
  };
  return map[role] || 'badge-blue';
}

// ─── V1.9 Helpers ──────────────────────────────────────────────────────────

/** Returns attendance status: 'good' | 'warning' | 'danger' based on % */
export function attendanceStatus(pct) {
  if (pct < 60) return 'danger';
  if (pct < 75) return 'warning';
  return 'good';
}

/** Badge class for attendance status */
export function attendanceBadge(pct) {
  if (pct < 60) return 'badge-red';
  if (pct < 75) return 'badge-amber';
  return 'badge-green';
}

/** Human label for attendance status */
export function attendanceLabel(pct) {
  if (pct < 60) return 'Critical';
  if (pct < 75) return 'Warning';
  return 'Good';
}

export const CLASS_OPTIONS = ['BS1', 'BS2', 'BS3', 'BS4'];

export function classLabel(c) {
  const map = { BS1: 'BS-I (1st Year)', BS2: 'BS-II (2nd Year)', BS3: 'BS-III (3rd Year)', BS4: 'BS-IV (4th Year)', Graduated: 'Graduated' };
  return map[c] || c;
}

// Semester → Class mapping (2 semesters per class)
// BS1: 1,2 | BS2: 3,4 | BS3: 5,6 | BS4: 7,8
export function semesterToClass(semester) {
  const s = Number(semester);
  if (s <= 2) return 'BS1';
  if (s <= 4) return 'BS2';
  if (s <= 6) return 'BS3';
  return 'BS4';
}

// Returns the two semesters that belong to a class
export function classToSemesters(cls) {
  const map = { BS1: ['1','2'], BS2: ['3','4'], BS3: ['5','6'], BS4: ['7','8'] };
  return map[cls] || [];
}
