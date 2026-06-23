import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherAssignments, getSessions, getSessionRecords, getDeptStudents } from '../../firebase/firestore';
import { exportToPDF, exportToExcel } from '../../utils/export';
import { formatDate, formatTime, calcPct } from '../../utils/helpers';
import { BookOpen, Download, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';

export function TeacherClassesPage() {
  const { profile, deptId } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deptId || !profile) { setLoading(false); return; }
    getTeacherAssignments(deptId, profile.uid).then(setAssignments).finally(() => setLoading(false));
  }, [deptId, profile]);

  return (
    <Layout>
      <div className="page-in space-y-6">
        <h1 className="page-title">My Classes</h1>
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">{[1,2,3].map(i=><div key={i} className="h-28 shimmer rounded-2xl"/>)}</div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No classes assigned yet. Ask the Chairman.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {assignments.map(a => (
              <div key={a.id} className="card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                    <BookOpen size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>{a.subjectName}</div>
                    <div className="text-xs text-white/40">{a.program} · Semester {a.semester}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="badge badge-blue text-[10px]">{a.program}</span>
                  <span className="badge badge-gray text-[10px]">Sem {a.semester}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export function TeacherReportsPage() {
  const { profile, deptId } = useAuth();
  const [sessions,  setSessions]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!deptId || !profile) { setLoading(false); return; }
    // CLASS ISOLATION FIX: load only this teacher's sessions. Students are loaded
    // per-session (class-scoped) in the effect below — no unfiltered dept-wide load.
    getSessions(deptId, { teacherId: profile.uid })
      .then((s) => { setSessions(s); if (s.length) setSelected(s[0]); })
      .finally(() => setLoading(false));
  }, [deptId, profile]);

  // Load records + class-scoped students when session changes
  useEffect(() => {
    if (!selected || !deptId) return;
    getSessionRecords(deptId, selected.id).then(setRecords);
    // Always load students scoped to the session's class for accurate stats
    const classFilter = selected.studentClass ? { studentClass: selected.studentClass } : {};
    getDeptStudents(deptId, classFilter).then(setStudents);
  }, [selected, deptId]);

  const present = records.filter(r => r.status === 'present').length;
  const pct = calcPct(present, students.length);

  async function handlePDF() {
    setExporting(true);
    try { exportToPDF(selected, records, students, profile?.departmentName || ''); }
    finally { setExporting(false); }
  }
  async function handleExcel() {
    setExporting(true);
    try { exportToExcel(selected, records, students, profile?.departmentName || ''); }
    finally { setExporting(false); }
  }

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="page-title">My Reports</h1>
          {selected && (
            <div className="flex gap-2">
              <button onClick={handlePDF} disabled={exporting} className="btn-secondary btn-sm flex items-center gap-1.5">
                {exporting?<Loader2 size={12} className="animate-spin"/>:<FileText size={12}/>} PDF
              </button>
              <button onClick={handleExcel} disabled={exporting} className="btn-primary btn-sm flex items-center gap-1.5">
                {exporting?<Loader2 size={12} className="animate-spin"/>:<Download size={12}/>} Excel
              </button>
            </div>
          )}
        </div>

        {sessions.length > 0 && (
          <div className="card p-4">
            <label className="label">Select Session</label>
            <select className="input text-sm" value={selected?.id||''} onChange={e=>setSelected(sessions.find(s=>s.id===e.target.value))}>
              {sessions.map(s=><option key={s.id} value={s.id}>{s.subjectName} — {formatDate(s.createdAt)} {formatTime(s.createdAt)}</option>)}
            </select>
          </div>
        )}

        {selected && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'Present', value:present, color:'text-emerald-400', icon:CheckCircle },
                { label:'Absent',  value:students.length-present, color:'text-red-400', icon:XCircle },
                { label:'Attendance', value:`${pct}%`, color:pct>=75?'text-emerald-400':'text-red-400', icon:null },
              ].map(({ label, value, color }) => (
                <div key={label} className="stat-card border border-white/[0.06] text-center items-center">
                  <div className={`text-2xl font-bold num ${color}`} style={{fontFamily:'Syne,sans-serif'}}>{value}</div>
                  <div className="text-xs text-white/35">{label}</div>
                </div>
              ))}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <h3 className="section-title">{selected.subjectName} · {formatDate(selected.createdAt)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Roll No</th><th>Student</th><th>Status</th><th>Time</th></tr></thead>
                  <tbody>
                    {students.map(s => {
                      const rec = records.find(r => r.studentId === s.id || r.rollNumber === s.rollNumber);
                      return (
                        <tr key={s.id}>
                          <td><span className="font-mono text-xs text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">{s.rollNumber}</span></td>
                          <td className="font-medium text-white">{s.displayName || s.name}</td>
                          <td><span className={`badge text-[10px] ${rec?'badge-green':'badge-red'}`}>{rec?'PRESENT':'ABSENT'}</span></td>
                          <td className="text-white/35 text-xs">{rec?formatTime(rec.markedAt):'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {sessions.length === 0 && !loading && (
          <div className="text-center py-16 text-white/30 text-sm">No sessions recorded yet.</div>
        )}
      </div>
    </Layout>
  );
}
