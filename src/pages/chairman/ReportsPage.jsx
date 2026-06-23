import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getSessions, getSessionRecords, getDeptStudents, getSubjects } from '../../firebase/firestore';
import { formatDate, formatTime, calcPct, pctBadge } from '../../utils/helpers';
import { exportToPDF, exportToExcel } from '../../utils/export';
import toast from 'react-hot-toast';
import { BarChart3, Download, FileText, CheckCircle, XCircle, Clock, Loader2, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ChairmanReportsPage() {
  const { deptId } = useAuth();
  const [sessions,  setSessions]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [recLoading,setRecLoading]= useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterClass,   setFilterClass]   = useState(''); // ISSUE 1 FIX
  const CLASS_LABELS = { BS1:'BS-I', BS2:'BS-II', BS3:'BS-III', BS4:'BS-IV' };

  useEffect(() => {
    if (!deptId) return;
    // ISSUE 1 FIX — filter sessions & students by class to prevent cross-class data mixing
    const sessionFilter = filterClass ? { studentClass: filterClass } : {};
    const studentFilter = filterClass ? { studentClass: filterClass } : {};
    setLoading(true);
    Promise.all([
      getSessions(deptId, sessionFilter, 100),
      getDeptStudents(deptId, studentFilter, 200),
    ]).then(([s, st]) => {
      setSessions(s); setStudents(st);
      if (s.length > 0) setSelected(s[0]);
      else setSelected(null);
    }).catch(e => toast.error('Failed to load reports'))
    .finally(() => setLoading(false));
  }, [deptId, filterClass]);

  useEffect(() => {
    if (!selected) return;
    setRecLoading(true);
    // ISSUE 1 FIX — reload students scoped to the selected session's class
    const classFilter = selected.studentClass ? { studentClass: selected.studentClass } : {};
    Promise.all([
      getSessionRecords(deptId, selected.id),
      getDeptStudents(deptId, classFilter, 200),
    ]).then(([r, st]) => { setRecords(r); setStudents(st); setRecLoading(false); });
  }, [selected]);

  const present = records.filter(r => r.status === 'present').length;
  const late    = records.filter(r => r.status === 'late').length;
  const absent  = students.length - present - late;
  const pct     = calcPct(present + late, students.length);

  const teachers = [...new Set(sessions.map(s => s.teacherName).filter(Boolean))];
  const filtered = sessions.filter(s => !filterTeacher || s.teacherName === filterTeacher);

  const chartData = filtered.slice(0,10).reverse().map(s => ({
    name: formatDate(s.createdAt).split(',')[0],
    Present: s.presentCount || 0,
    Absent: Math.max(0, (students.length || 0) - (s.presentCount || 0)),
  }));

  async function handlePDF() {
    if (!selected) return;
    setExporting(true);
    try { exportToPDF(selected, records, students, 'Department'); toast.success('PDF exported!'); }
    catch(e) { toast.error(e.message); }
    finally { setExporting(false); }
  }

  async function handleExcel() {
    if (!selected) return;
    setExporting(true);
    try { exportToExcel(selected, records, students, 'Department'); toast.success('Excel exported!'); }
    catch(e) { toast.error(e.message); }
    finally { setExporting(false); }
  }

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h1 className="page-title">Reports & Analytics</h1><p className="page-sub">{sessions.length} sessions · {students.length} students</p></div>
          <div className="flex gap-2">
            <button onClick={handlePDF} disabled={exporting||!selected} className="btn-secondary btn-sm flex items-center gap-1.5">
              {exporting ? <Loader2 size={13} className="animate-spin"/> : <FileText size={13}/>} PDF
            </button>
            <button onClick={handleExcel} disabled={exporting||!selected} className="btn-primary btn-sm flex items-center gap-1.5">
              {exporting ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>} Excel
            </button>
          </div>
        </div>

        {/* Session selector */}
        {sessions.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {/* ISSUE 1 FIX — class filter to isolate records */}
            <select className="input text-sm w-36" value={filterClass} onChange={e=>{ setFilterClass(e.target.value); setFilterTeacher(''); }}>
              <option value="">All Classes</option>
              {['BS1','BS2','BS3','BS4'].map(c=><option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
            </select>
            <select className="input text-sm flex-1 min-w-[200px]" value={selected?.id||''} onChange={e=>setSelected(sessions.find(s=>s.id===e.target.value))}>
              {sessions.map(s=><option key={s.id} value={s.id}>{s.subjectName||'Session'} — {s.teacherName} · {formatDate(s.createdAt)}</option>)}
            </select>
            <select className="input text-sm w-40" value={filterTeacher} onChange={e=>setFilterTeacher(e.target.value)}>
              <option value="">All Teachers</option>
              {teachers.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {/* Session stats */}
        {selected && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {label:'Present', value:present, color:'text-emerald-400', bg:'bg-emerald-500/10', border:'border-emerald-500/20'},
              {label:'Late',    value:late,    color:'text-amber-400',   bg:'bg-amber-500/10',   border:'border-amber-500/20'},
              {label:'Absent',  value:Math.max(0,absent), color:'text-red-400', bg:'bg-red-500/10', border:'border-red-500/20'},
            ].map(({label,value,color,bg,border}) => (
              <div key={label} className={`card p-4 border ${border}`}>
                <div className={`text-2xl font-bold num ${color}`} style={{fontFamily:'Syne,sans-serif'}}>{value}</div>
                <div className="text-xs text-white/40">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {chartData.length > 1 && (
          <div className="card p-5">
            <h3 className="section-title mb-4">Attendance Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.15)" tick={{fill:'rgba(255,255,255,0.4)',fontSize:10}}/>
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}}/>
                <Tooltip contentStyle={{background:'#070d1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:12}}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Present" fill="#10b981" radius={[4,4,0,0]}/>
                <Bar dataKey="Absent"  fill="#ef4444" radius={[4,4,0,0]} opacity={0.7}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Records table */}
        {selected && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <h3 className="section-title">{selected.subjectName||'Session'} — {formatDate(selected.createdAt)}</h3>
              <div className="flex items-center gap-3">
                {selected.status==='active' && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><div className="dot-live"/>Live</span>}
                <span className="text-xs text-white/35">{records.length} marked / {students.length} total</span>
              </div>
            </div>
            {recLoading ? (
              <div className="p-5 space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 shimmer rounded-lg"/>)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Student</th><th>Roll No</th><th>Program</th><th>Status</th><th>Time</th></tr></thead>
                  <tbody>
                    {students.map(s => {
                      const rec = records.find(r => r.studentId === s.id || r.rollNumber === s.rollNumber);
                      return (
                        <tr key={s.id}>
                          <td className="font-medium text-white">{s.displayName}</td>
                          <td><span className="font-mono text-xs text-blue-300 px-2 py-0.5 rounded-md" style={{background:'rgba(59,130,246,0.1)'}}>{s.rollNumber||'—'}</span></td>
                          <td className="text-white/45 text-xs">{s.program} Sem {s.semester}</td>
                          <td>
                            <span className={`badge text-[10px] ${rec?(rec.status==='present'?'badge-green':rec.status==='late'?'badge-amber':'badge-red'):'badge-red'}`}>
                              {rec?rec.status.toUpperCase():'ABSENT'}
                            </span>
                          </td>
                          <td className="text-white/35 text-xs">{rec?formatTime(rec.markedAt):'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {sessions.length === 0 && !loading && (
          <div className="card p-10 text-center text-white/30">No attendance sessions yet.</div>
        )}
      </div>
    </Layout>
  );
}
