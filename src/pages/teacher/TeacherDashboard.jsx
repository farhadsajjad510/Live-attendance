import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherAssignments, getSessions, getAnnouncements, subscribeAnnouncements, getTeacherDepartments,
  getDeptCRs, getDelegationsByTeacher, createDelegation, revokeDelegation,
} from '../../firebase/firestore';
import { formatDate, formatDateTime, classLabel } from '../../utils/helpers';
import { BookOpen, QrCode, BarChart3, Building2, ChevronRight, UserCog, Plus, Loader2, X, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {
  const { profile, deptId, activeDeptId, setActiveDept } = useAuth();
  const [assignments,   setAssignments]   = useState([]);
  const [sessions,      setSessions]      = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [deptCount,     setDeptCount]     = useState(1); // how many depts teacher belongs to

  useEffect(() => {
    if (!deptId || !profile) { setLoading(false); return; }
    Promise.all([
      getTeacherAssignments(deptId, profile.uid),
      getSessions(deptId, { teacherId: profile.uid }),
      getAnnouncements(deptId),
    ]).then(([a,s,an]) => {
      setAssignments(a); setSessions(s); setAnnouncements(an);
    }).finally(() => setLoading(false));

    // Multi-dept count — non-blocking
    getTeacherDepartments(profile.uid)
      .then(depts => {
        const secondary = depts.filter(d => d.deptId !== profile.departmentId);
        setDeptCount(1 + secondary.length);
      })
      .catch(() => setDeptCount(1));
  }, [deptId, profile]);

  // Announcement subscription — TOP-LEVEL useEffect (was incorrectly nested inside above)
  useEffect(() => {
    if (!deptId) return;
    const unsub = subscribeAnnouncements(deptId, setAnnouncements);
    return () => unsub();
  }, [deptId]);

  // ── V2.0 — Manage Delegates (Teacher → CR Attendance Delegation) ──────────
  const [crs, setCrs] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [delegLoading, setDelegLoading] = useState(true);
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [delegForm, setDelegForm] = useState({ crId: '', subjectId: '', duration: 'today', customDate: '' });
  const [delegSaving, setDelegSaving] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  async function loadDelegates() {
    if (!deptId || !profile) return;
    setDelegLoading(true);
    try {
      const [crList, delList] = await Promise.all([
        getDeptCRs(deptId),
        getDelegationsByTeacher(deptId, profile.uid),
      ]);
      setCrs(crList.filter(c => c.status === 'approved'));
      setDelegations(delList);
    } catch (e) { /* silent */ }
    finally { setDelegLoading(false); }
  }

  useEffect(() => { loadDelegates(); }, [deptId, profile]);

  function computeExpiry(duration, customDate) {
    const now = new Date();
    if (duration === 'today') { const d = new Date(now); d.setHours(23,59,59,999); return d; }
    if (duration === 'week')  { const d = new Date(now); d.setDate(d.getDate()+7); return d; }
    if (duration === 'month') { const d = new Date(now); d.setMonth(d.getMonth()+1); return d; }
    if (duration === 'custom' && customDate) return new Date(customDate + 'T23:59:59');
    return null;
  }

  async function handleCreateDelegation(e) {
    e.preventDefault();
    const cr = crs.find(c => c.id === delegForm.crId);
    const subj = assignments.find(a => a.subjectId === delegForm.subjectId || a.id === delegForm.subjectId);
    if (!cr || !subj) { toast.error('Select a CR and a subject'); return; }
    const expiresAt = computeExpiry(delegForm.duration, delegForm.customDate);
    if (delegForm.duration === 'custom' && !expiresAt) { toast.error('Pick a custom expiry date'); return; }

    setDelegSaving(true);
    try {
      await createDelegation(deptId, {
        crId: cr.id, crName: cr.displayName,
        teacherId: profile.uid, teacherName: profile.displayName,
        subjectId: subj.subjectId || subj.id, subjectName: subj.subjectName,
        program: subj.program, semester: subj.semester,
        expiresAt,
      });
      toast.success(`${cr.displayName} authorized for ${subj.subjectName}`);
      setShowDelegateForm(false);
      setDelegForm({ crId: '', subjectId: '', duration: 'today', customDate: '' });
      loadDelegates();
    } catch (e) { toast.error(e.message); }
    finally { setDelegSaving(false); }
  }

  async function handleRevoke(d) {
    setRevokingId(d.id);
    try {
      await revokeDelegation(deptId, d.id, d.crId, profile.uid);
      toast.success('Authorization revoked');
      loadDelegates();
    } catch (e) { toast.error(e.message); }
    finally { setRevokingId(null); }
  }

  const todaySessions = sessions.filter(s => {
    const d = s.createdAt?.toDate?.();
    return d && d.toDateString() === new Date().toDateString();
  });
  const activeSessions = sessions.filter(s => s.status === 'active');
  const firstName = profile?.displayName?.split(' ')[0] || 'Teacher';

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Welcome, {firstName}</h1>
            <p className="page-sub">Teacher · {assignments.length} assigned class{assignments.length !== 1 ? 'es' : ''}</p>
          </div>
          <Link to="/teacher/attendance" className="btn-primary btn-sm flex items-center gap-2">
            <QrCode size={14} /> Start Attendance
          </Link>
        </div>

        {activeSessions.length > 0 && (
          <div className="p-4 rounded-2xl border border-emerald-500/25 flex items-center gap-3" style={{background:'rgba(16,185,129,0.07)'}}>
            <div className="relative"><div className="w-3 h-3 rounded-full bg-emerald-400" /><div className="absolute inset-0 rounded-full bg-emerald-400 ring-pulse" /></div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Session Active: {activeSessions[0].subjectName}</div>
              <div className="text-xs text-white/40">{activeSessions[0].presentCount || 0} students present</div>
            </div>
            <Link to="/teacher/attendance" className="btn-success btn-sm">Manage →</Link>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label:'My Classes',     value:assignments.length,   color:'text-blue-400'   },
            { label:'Sessions Today', value:todaySessions.length, color:'text-purple-400' },
            { label:'Total Sessions', value:sessions.length,      color:'text-cyan-400'   },
            { label:'This Month',     value:sessions.filter(s=>{const d=s.createdAt?.toDate?.();return d&&d.getMonth()===new Date().getMonth()}).length, color:'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card border border-white/[0.06]">
              <div className={`text-2xl font-bold num ${color}`} style={{fontFamily:'Syne,sans-serif'}}>{value}</div>
              <div className="text-xs text-white/35">{label}</div>
            </div>
          ))}
        </div>

        {/* ── V2.0 — Manage Delegates (Teacher → CR Attendance Delegation) ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2 flex-wrap">
            <UserCog size={15} className="text-purple-400" />
            <h3 className="section-title">Manage Delegates</h3>
            <span className="text-xs text-white/30">{delegations.filter(d=>d.active).length} active</span>
            <button onClick={()=>setShowDelegateForm(s=>!s)} className="btn-primary btn-xs flex items-center gap-1 ml-auto">
              {showDelegateForm ? <X size={12}/> : <Plus size={12}/>} {showDelegateForm ? 'Cancel' : 'Authorize CR'}
            </button>
          </div>

          {showDelegateForm && (
            <form onSubmit={handleCreateDelegation} className="p-4 border-b border-white/[0.05] space-y-3" style={{background:'rgba(168,85,247,0.04)'}}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Class Representative</label>
                  <select className="input" value={delegForm.crId} onChange={e=>setDelegForm(f=>({...f,crId:e.target.value}))} required>
                    <option value="">Select CR…</option>
                    {crs.map(cr => <option key={cr.id} value={cr.id}>{cr.displayName}{cr.studentClass ? ` — ${classLabel(cr.studentClass)}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Subject</label>
                  <select className="input" value={delegForm.subjectId} onChange={e=>setDelegForm(f=>({...f,subjectId:e.target.value}))} required>
                    <option value="">Select subject…</option>
                    {assignments.map(a => <option key={a.id} value={a.subjectId || a.id}>{a.subjectName} — {a.program} Sem {a.semester}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Duration</label>
                  <select className="input" value={delegForm.duration} onChange={e=>setDelegForm(f=>({...f,duration:e.target.value}))}>
                    <option value="today">Today</option>
                    <option value="week">1 Week</option>
                    <option value="month">1 Month</option>
                    <option value="custom">Custom Date</option>
                  </select>
                </div>
                {delegForm.duration === 'custom' && (
                  <div>
                    <label className="label">Expires On</label>
                    <input type="date" className="input" value={delegForm.customDate} onChange={e=>setDelegForm(f=>({...f,customDate:e.target.value}))} required />
                  </div>
                )}
              </div>
              <button type="submit" disabled={delegSaving || crs.length===0} className="btn-primary btn-sm flex items-center gap-2">
                {delegSaving ? <Loader2 size={13} className="animate-spin"/> : <ShieldCheck size={13}/>} Authorize
              </button>
              {crs.length === 0 && <p className="text-xs text-amber-400/70">No approved CRs in your department yet.</p>}
            </form>
          )}

          {delegLoading ? (
            <div className="p-5 space-y-2">{[1,2].map(i => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
          ) : delegations.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No CRs authorized yet.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {delegations.map(d => {
                const exp = d.expiresAt?.toDate?.();
                const expired = exp && exp.getTime() < Date.now();
                const status = !d.active ? 'Revoked' : expired ? 'Expired' : 'Active';
                return (
                  <div key={d.id} className="flex items-center gap-3 p-4">
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/15 flex-shrink-0">
                      <UserCog size={14} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{d.crName} <span className="text-white/35 font-normal">→ {d.subjectName}</span></div>
                      <div className="text-xs text-white/35">{exp ? `Expires ${formatDate(exp)}` : 'No expiry'}</div>
                    </div>
                    <span className={`badge text-[10px] ${status==='Active'?'badge-green':status==='Expired'?'badge-gray':'badge-red'}`}>{status}</span>
                    {status === 'Active' && (
                      <button onClick={()=>handleRevoke(d)} disabled={revokingId===d.id} className="btn-danger btn-xs flex items-center gap-1">
                        {revokingId===d.id ? <Loader2 size={11} className="animate-spin"/> : <X size={11}/>} Revoke
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex justify-between items-center">
            <h3 className="section-title">Assigned Classes</h3>
            <Link to="/teacher/classes" className="text-xs text-blue-400">View all</Link>
          </div>
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No classes assigned yet. Contact your Chairman.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {assignments.slice(0,5).map(a => (
                <div key={a.id} className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={14} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{a.subjectName}</div>
                    <div className="text-xs text-white/35">{a.program} · Semester {a.semester}</div>
                  </div>
                  <Link to="/teacher/attendance" className="btn-primary btn-xs">Attend</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex justify-between">
              <h3 className="section-title">Recent Sessions</h3>
              <Link to="/teacher/reports" className="text-xs text-blue-400">Reports</Link>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No sessions yet</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {sessions.slice(0,5).map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status==='active'?'bg-emerald-400 animate-pulse':'bg-white/20'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{s.subjectName}</div>
                      <div className="text-xs text-white/35">{formatDate(s.createdAt)}</div>
                    </div>
                    <div className="text-sm font-bold text-emerald-400 num">{s.presentCount||0}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05]"><h3 className="section-title">Announcements</h3></div>
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No announcements</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {announcements.slice(0,4).map(a => (
                  <div key={a.id} className="p-4">
                    <div className="font-semibold text-white text-sm">{a.title}</div>
                    <div className="text-xs text-white/45 mt-0.5 line-clamp-2">{a.message}</div>
                    <div className="text-[10px] text-white/25 mt-1">{formatDateTime(a.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
