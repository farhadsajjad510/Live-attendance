import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { ConfirmDialog, Avatar } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAnnouncements, subscribeAnnouncements, getSessions,
  getPendingStudentsForClass, getApprovedStudentsForClass,
  approveJoinRequest, rejectJoinRequest, getDelegationsForCR, logActivity,
} from '../../firebase/firestore';
import { formatDate, formatDateTime, classLabel } from '../../utils/helpers';
import { QrCode, Megaphone, Clock, CheckCircle, ArrowRight, Users, UserCheck, UserX, BookOpen, Loader2, Play, Square, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function CRDashboard() {
  const { profile, deptId } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // V2.0 — Student Management (CR-scoped to their own class)
  const [studentTab, setStudentTab] = useState('pending'); // 'pending' | 'approved'
  const [pendingStudents, setPendingStudents] = useState([]);
  const [approvedStudents, setApprovedStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [actingId, setActingId] = useState(null); // request id being approved/rejected
  const [rejectTarget, setRejectTarget] = useState(null);

  // V2.0 — Authorized Subjects (teacher → CR delegations)
  const [delegations, setDelegations] = useState([]);
  const [delegationsLoading, setDelegationsLoading] = useState(true);

  useEffect(() => {
    if (!deptId) { setLoading(false); return; }
    // ISSUE 3 FIX — CR sessions filtered to their own class only (no cross-class session leakage)
    const sessionFilter = profile?.studentClass ? { studentClass: profile.studentClass } : {};
    Promise.all([getAnnouncements(deptId), getSessions(deptId, sessionFilter)])
      .then(([a, s]) => { setAnnouncements(a); setSessions(s); })
      .finally(() => setLoading(false));
  }, [deptId, profile?.studentClass]);

  // Announcement subscription — TOP-LEVEL useEffect (was incorrectly nested inside above)
  useEffect(() => {
    if (!deptId) return;
    const unsub = subscribeAnnouncements(deptId, setAnnouncements);
    return () => unsub();
  }, [deptId]);

  // V2.0 — Load students for the CR's own class
  async function loadStudents() {
    if (!deptId || !profile?.studentClass) { setStudentsLoading(false); return; }
    setStudentsLoading(true);
    try {
      const [pending, approved] = await Promise.all([
        getPendingStudentsForClass(deptId, profile.studentClass),
        getApprovedStudentsForClass(deptId, profile.studentClass),
      ]);
      setPendingStudents(pending);
      setApprovedStudents(approved);
    } catch (e) { /* silent — CR may not have a class set yet */ }
    finally { setStudentsLoading(false); }
  }

  useEffect(() => { loadStudents(); }, [deptId, profile?.studentClass]);

  // V2.0 — Load authorized subjects (delegations) for this CR
  useEffect(() => {
    if (!deptId || !profile?.uid) { setDelegationsLoading(false); return; }
    getDelegationsForCR(deptId, profile.uid)
      .then(setDelegations)
      .catch(() => setDelegations([]))
      .finally(() => setDelegationsLoading(false));
  }, [deptId, profile?.uid]);

  // V2.0 — Approve a pending student (CR can only approve students in their own class)
  async function handleApproveStudent(req) {
    setActingId(req.id);
    try {
      await approveJoinRequest(deptId, req.id, req.userId, 'student');
      toast.success(`${req.displayName} approved!`);
      logActivity(deptId, 'approval', `CR approved student ${req.displayName} (${profile.studentClass})`, profile?.displayName).catch(()=>{});
      loadStudents();
    } catch (e) { toast.error(e.message); }
    finally { setActingId(null); }
  }

  async function handleRejectStudent() {
    if (!rejectTarget) return;
    setActingId(rejectTarget.id);
    try {
      await rejectJoinRequest(deptId, rejectTarget.id);
      toast.success('Request rejected');
      logActivity(deptId, 'rejection', `CR rejected student ${rejectTarget.displayName} (${profile.studentClass})`, profile?.displayName).catch(()=>{});
      setRejectTarget(null);
      loadStudents();
    } catch (e) { toast.error(e.message); }
    finally { setActingId(null); }
  }

  // V2.0 — Start/End session for an authorized subject
  function handleDelegationSession(delegation) {
    navigate('/cr/attendance', { state: { delegation } });
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const firstName = profile?.displayName?.split(' ')[0] || 'CR';

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">Welcome, {firstName} 👋</h1>
          <p className="page-sub">Class Representative · {profile?.program} Sem {profile?.semester}</p>
        </div>

        {/* ── V2.0 — Authorized Subjects (Teacher → CR Delegations) ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-400" />
            <h3 className="section-title">Authorized Subjects</h3>
            <span className="text-xs text-white/30 ml-auto">{delegations.length} active</span>
          </div>
          {delegationsLoading ? (
            <div className="p-5 space-y-2">{[1,2].map(i => <div key={i} className="h-14 shimmer rounded-lg" />)}</div>
          ) : delegations.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">
              No teacher has authorized you to take attendance yet.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {delegations.map(d => {
                const exp = d.expiresAt?.toDate?.();
                const liveSession = sessions.find(s => s.status === 'active' && s.subjectId === d.subjectId && s.delegationId === d.id);
                return (
                  <div key={d.id} className="flex items-center gap-3 p-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex-shrink-0">
                      <BookOpen size={14} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{d.subjectName}</div>
                      <div className="text-xs text-white/35">
                        Authorized by {d.teacherName}
                        {exp && ` · Expires ${formatDate(exp)}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelegationSession(d)}
                      className={`btn-sm flex items-center gap-1.5 ${liveSession ? 'btn-danger' : 'btn-success'}`}
                    >
                      {liveSession ? <><Square size={12}/> End Session</> : <><Play size={12}/> Start Session</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── V2.0 — Student Management (CR's own class only) ── */}
        {profile?.studentClass && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2 flex-wrap">
              <Users size={15} className="text-blue-400" />
              <h3 className="section-title">Student Management</h3>
              <span className="badge badge-blue text-[10px]">{classLabel(profile.studentClass)}</span>
              <div className="flex gap-1 p-1 rounded-xl ml-auto" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}>
                {[['pending','Pending'],['approved','Approved']].map(([k,l]) => (
                  <button key={k} onClick={()=>setStudentTab(k)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${studentTab===k ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'}`}
                    style={{fontFamily:'Syne,sans-serif'}}>
                    {l} {k==='pending' ? `(${pendingStudents.length})` : `(${approvedStudents.length})`}
                  </button>
                ))}
              </div>
            </div>

            {studentsLoading ? (
              <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
            ) : studentTab === 'pending' ? (
              pendingStudents.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">No pending students in {classLabel(profile.studentClass)}</div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {pendingStudents.map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-4">
                      <Avatar name={req.displayName} size={9}/>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm">{req.displayName}</div>
                        <div className="text-xs text-white/40">{req.email}</div>
                        {req.rollNumber && <div className="text-xs text-white/30 font-mono">Roll: {req.rollNumber}</div>}
                      </div>
                      <button onClick={()=>setRejectTarget(req)} disabled={actingId===req.id}
                        className="btn-danger btn-xs flex items-center gap-1">
                        <UserX size={12}/> Reject
                      </button>
                      <button onClick={()=>handleApproveStudent(req)} disabled={actingId===req.id}
                        className="btn-success btn-xs flex items-center gap-1">
                        {actingId===req.id ? <Loader2 size={12} className="animate-spin"/> : <UserCheck size={12}/>} Approve
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              approvedStudents.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">No approved students in {classLabel(profile.studentClass)}</div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {approvedStudents.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-4">
                      <Avatar name={s.displayName} size={9}/>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm">{s.displayName}</div>
                        <div className="text-xs text-white/40">{s.email}</div>
                      </div>
                      {s.rollNumber && <span className="font-mono text-xs text-blue-300 px-2 py-0.5 rounded-md" style={{background:'rgba(59,130,246,0.1)'}}>{s.rollNumber}</span>}
                      <span className="badge badge-green text-[10px]">Approved</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Active sessions alert */}
        {activeSessions.length > 0 && (
          <div className="p-4 rounded-2xl border border-emerald-500/25 flex items-center gap-3"
            style={{background:'rgba(16,185,129,0.07)'}}>
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 rounded-full bg-emerald-400 ring-pulse" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">
                {activeSessions.length} Active Session{activeSessions.length > 1 ? 's' : ''}
              </div>
              <div className="text-xs text-white/40">Attendance is in progress</div>
            </div>
            <Link to="/cr/attendance" className="btn-success btn-sm flex items-center gap-1">
              <QrCode size={13} /> Scan
            </Link>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/cr/attendance" className="card p-5 flex flex-col gap-3 hover:border-blue-500/25 group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
              <QrCode size={18} className="text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-white text-sm" style={{fontFamily:'Syne,sans-serif'}}>Scan Attendance</div>
              <div className="text-xs text-white/35 mt-0.5">Scan student QR codes</div>
            </div>
          </Link>
          <Link to="/cr/announcements" className="card p-5 flex flex-col gap-3 hover:border-amber-500/25 group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
              <Megaphone size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-white text-sm" style={{fontFamily:'Syne,sans-serif'}}>Announcements</div>
              <div className="text-xs text-white/35 mt-0.5">View latest notices</div>
            </div>
          </Link>
        </div>

        {/* Recent sessions */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h3 className="section-title">Recent Sessions</h3>
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No sessions yet</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {sessions.slice(0, 6).map(s => (
                <div key={s.id} className="flex items-center gap-3 p-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{s.subjectName || 'Session'}</div>
                    <div className="text-xs text-white/35">{s.teacherName} · {formatDate(s.createdAt)}</div>
                  </div>
                  <span className={`badge text-[10px] ${s.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                    {s.status === 'active' ? 'Live' : 'Ended'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h3 className="section-title">Announcements</h3>
          </div>
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No announcements</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {announcements.slice(0, 4).map(a => (
                <div key={a.id} className="p-4">
                  <div className="font-semibold text-white text-sm">{a.title}</div>
                  <div className="text-xs text-white/45 mt-1 line-clamp-2">{a.message}</div>
                  <div className="text-[10px] text-white/25 mt-1.5">{formatDateTime(a.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <ConfirmDialog
          open={!!rejectTarget}
          onClose={()=>setRejectTarget(null)}
          onConfirm={handleRejectStudent}
          title="Reject Student Request?"
          message={`${rejectTarget?.displayName}'s join request will be rejected. They can resubmit a new request later.`}
          danger
        />
      </div>
    </Layout>
  );
}
