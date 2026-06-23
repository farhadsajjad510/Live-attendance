import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { StatsCard, Modal, ConfirmDialog, EmptyState, Avatar } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDepartment, getJoinRequests, approveJoinRequest, rejectJoinRequest,
  approveSecondaryTeacherRequest, getDepartmentAnalytics, getDeptDefaulters, logActivity,
  getDeptStudents, getDeptTeachers, getSessions, subscribeJoinRequests,
  getAnnouncements, postAnnouncement, deleteAnnouncement,
  getDeptCRs, removeCR, getClassesWithoutCR,
} from '../../firebase/firestore';
import { formatDate, formatDateTime, calcPct, pctBadge, roleLabel } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  GraduationCap, UserCheck, QrCode, BarChart3, Users, BookOpen,
  Bell, CheckCircle, XCircle, Clock, Loader2, Plus, Trash2,
  Building2, Copy, ArrowRight, Megaphone,
  AlertTriangle, TrendingUp, Archive, UserX, UserMinus, ShieldAlert, UserCog, Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function ChairmanDashboard() {
  const { profile, deptId } = useAuth();
  const [dept,     setDept]    = useState(null);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [qrOpen,   setQrOpen]  = useState(false);
  const [annOpen,  setAnnOpen] = useState(false);
  const [annText,  setAnnText] = useState('');
  const [annTitle, setAnnTitle]= useState('');
  const [saving,   setSaving]  = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [defaulterCount, setDefaulterCount] = useState(0);
  const [crs, setCrs] = useState([]); // V2.0 — department CRs
  const [noCrClasses, setNoCrClasses] = useState([]); // V2.0 — classes lacking an active CR
  const [removeCrTarget, setRemoveCrTarget] = useState(null); // V2.0 — CR pending removal confirm

  useEffect(() => {
    if (!deptId) { setLoading(false); return; }
    async function load() {
      // Phase 1: fast reads (dept + teachers + announcements)
      const [d, te, an] = await Promise.all([
        getDepartment(deptId),
        getDeptTeachers(deptId, 50),      // cap teachers at 50 for dashboard
        getAnnouncements(deptId),
      ]);
      setDept(d); setTeachers(te); setAnnouncements(an);
      setLoading(false);  // ← show dashboard immediately with phase 1 data

      // Phase 2: heavier reads (students + sessions) — non-blocking
      Promise.all([
        getDeptStudents(deptId, {}, 200),  // cap students at 200 for dashboard
        getSessions(deptId, {}, 20),        // only last 20 sessions for dashboard
      ]).then(([st, se]) => {
        setStudents(st); setSessions(se);
        // V1.9 analytics (non-blocking, runs after main data)
        getDepartmentAnalytics(deptId).then(setAnalytics).catch(()=>{});
        getDeptDefaulters(deptId, 75).then(d => setDefaulterCount(d.length)).catch(()=>{});
        // V2.0 CR management data
        getDeptCRs(deptId).then(setCrs).catch(()=>{});
        getClassesWithoutCR(deptId).then(setNoCrClasses).catch(()=>{});
      }).catch(() => {});

    }
    load();
    // Live subscribe to join requests
    const unsub = subscribeJoinRequests(deptId, setRequests);
    return unsub;
  }, [deptId]);

  async function handleApprove(req) {
    try {
      if (req.isSecondaryDept && req.role === 'teacher') {
        // Secondary dept teacher: use dedicated function that writes to
        // users/{uid}/teacherDepts subcollection WITHOUT overwriting primary dept
        await approveSecondaryTeacherRequest(deptId, req.id, req.userId);
      } else {
        // Normal first-time join (student, CR, or primary teacher)
        await approveJoinRequest(deptId, req.id, req.userId, req.role);
      }
      toast.success(`${req.displayName} approved!`);
      logActivity(deptId, 'approval', `Approved ${req.role} ${req.displayName}`, profile?.displayName).catch(()=>{});
    } catch (e) { toast.error(e.message); }
  }

  async function handleReject(req) {
    try {
      await rejectJoinRequest(deptId, req.id);
      toast.success('Request rejected');
      logActivity(deptId, 'rejection', `Rejected ${req.role} ${req.displayName}`, profile?.displayName).catch(()=>{});
    } catch (e) { toast.error(e.message); }
  }

  async function handlePostAnn(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await postAnnouncement(deptId, {
        title: annTitle, message: annText,
        postedBy: profile.displayName, role: 'chairman',
      });
      toast.success('Announcement posted!');
      setAnnOpen(false); setAnnTitle(''); setAnnText('');
      const an = await getAnnouncements(deptId);
      setAnnouncements(an);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteAnn(id) {
    await deleteAnnouncement(deptId, id);
    setAnnouncements(a => a.filter(x => x.id !== id));
    toast.success('Deleted');
  }

  function copyCode() {
    navigator.clipboard.writeText(dept?.inviteCode || '');
    toast.success('Invite code copied!');
  }

  // V2.0 — Chairman no longer approves students; CR student approval handles that.
  const nonStudentRequests = requests.filter(r => r.role !== 'student');

  async function handleRemoveCR() {
    if (!removeCrTarget) return;
    try {
      await removeCR(deptId, removeCrTarget.id, profile?.displayName);
      toast.success(`${removeCrTarget.displayName} is no longer a CR`);
      setCrs(cs => cs.filter(c => c.id !== removeCrTarget.id));
      setNoCrClasses(getClassesWithoutCRLocal());
      setRemoveCrTarget(null);
    } catch (e) { toast.error(e.message); }
  }

  // Recompute locally after a removal so the banner updates instantly
  function getClassesWithoutCRLocal() {
    const remaining = crs.filter(c => c.id !== removeCrTarget?.id);
    const covered = new Set(remaining.filter(c => c.status === 'approved' && c.studentClass).map(c => c.studentClass));
    return ['BS1','BS2','BS3','BS4'].filter(c => !covered.has(c));
  }

  const todaySessions = sessions.filter(s => {
    const d = s.createdAt?.toDate?.();
    return d && d.toDateString() === new Date().toDateString();
  });

  if (!deptId && !loading) {
    return (
      <Layout>
        <div className="page-in">
          <EmptyState
            icon={Building2}
            title="No Department Yet"
            desc="Create your department to get started. You'll get a unique QR code and invite code."
            action={<Link to="/chairman/create-dept" className="btn-primary">Create Department</Link>}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">{dept?.name || 'Dashboard'}</h1>
            <p className="page-sub">{dept?.institution} · Chairman: {profile?.displayName}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setQrOpen(true)} className="btn-secondary btn-sm flex items-center gap-2">
              <QrCode size={14}/> Dept QR
            </button>
            <button onClick={()=>setAnnOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
              <Megaphone size={14}/> Announce
            </button>
          </div>
        </div>

        {/* Pending requests banner — V2.0: students are approved by CRs, not Chairman */}
        {nonStudentRequests.length > 0 && (
          <div className="p-4 rounded-2xl border border-amber-500/25 flex items-center gap-3"
            style={{background:'rgba(245,158,11,0.07)'}}>
            <div className="p-2 rounded-xl bg-amber-500/15"><Bell size={16} className="text-amber-400"/></div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{nonStudentRequests.length} Pending Join Request{nonStudentRequests.length>1?'s':''}</div>
              <div className="text-xs text-white/45">Review and approve teachers and CRs below. Student approvals are handled by CRs.</div>
            </div>
          </div>
        )}

        {/* V2.0 — No Active CR Assigned warnings */}
        {noCrClasses.length > 0 && (
          <div className="p-3 rounded-xl text-sm text-amber-300/80 flex items-center gap-2 flex-wrap"
            style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)'}}>
            <ShieldAlert size={15} className="text-amber-400 flex-shrink-0"/>
            <span>No Active CR Assigned For: {noCrClasses.join(', ')}</span>
            <Link to="/chairman/students" className="ml-auto text-xs text-amber-300 hover:text-amber-200 underline">Approve a CR →</Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon={GraduationCap} label="Students"       value={students.length}       color="green"  />
          <StatsCard icon={UserCheck}     label="Teachers"       value={teachers.length}       color="blue"   />
          <StatsCard icon={QrCode}        label="Sessions Today" value={todaySessions.length}  color="purple" />
          <StatsCard icon={BarChart3}     label="Total Sessions" value={sessions.length}       color="cyan"   />
        </div>

        {/* V1.9 Department Analytics */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={TrendingUp}    label="Present Today"   value={analytics.presentToday}        color="green" />
            <StatsCard icon={BarChart3}     label="Attendance %"    value={`${analytics.attendancePct}%`} color={analytics.attendancePct < 60 ? 'red' : analytics.attendancePct < 75 ? 'amber' : 'green'} />
            <StatsCard icon={Archive}       label="Graduated"       value={analytics.graduatedStudents}   color="amber" />
            <Link to="/chairman/promotions"><StatsCard icon={AlertTriangle} label="Defaulters" value={defaulterCount} color={defaulterCount > 0 ? 'red' : 'green'} /></Link>
          </div>
        )}
        {defaulterCount > 0 && (
          <div className="p-3 rounded-xl text-sm text-red-300/80 flex items-center gap-2" style={{background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.2)'}}>
            <AlertTriangle size={15} className="text-red-400 flex-shrink-0"/>
            <span>{defaulterCount} student{defaulterCount!==1?'s':''} below 75% attendance.</span>
            <Link to="/chairman/promotions" className="ml-auto text-xs text-red-300 hover:text-red-200 underline">View Defaulters →</Link>
          </div>
        )}

        {/* Pending join requests — Teachers & CRs only (V2.0) */}
        {nonStudentRequests.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <Clock size={15} className="text-amber-400"/>
              <h3 className="section-title">Pending Requests — Teachers &amp; CRs</h3>
              <span className="badge badge-amber ml-auto">{nonStudentRequests.length}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {nonStudentRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-4">
                  <Avatar name={req.displayName} size={9}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{req.displayName}</div>
                    <div className="text-xs text-white/40">{req.email} · <span className="capitalize">{roleLabel(req.role)}</span></div>
                    {req.rollNumber && <div className="text-xs text-white/30 font-mono">Roll: {req.rollNumber}</div>}
                    {req.qualification && <div className="text-xs text-white/30">{req.qualification}</div>}
                    {req.isSecondaryDept && (
                      <div className="text-[10px] text-amber-400/80 mt-0.5 px-1.5 py-0.5 rounded w-fit"
                        style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)'}}>
                        ↗ Visiting from: {req.primaryDeptName || 'another department'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>handleReject(req)} className="btn-danger btn-xs flex items-center gap-1">
                      <XCircle size={12}/> Reject
                    </button>
                    <button onClick={()=>handleApprove(req)} className="btn-success btn-xs flex items-center gap-1">
                      <CheckCircle size={12}/> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to:'/chairman/teachers',   icon:UserCheck,     label:'Manage Teachers',  color:'text-blue-400',    bg:'bg-blue-500/10'   },
            { to:'/chairman/students',   icon:GraduationCap, label:'Manage Students',  color:'text-emerald-400', bg:'bg-emerald-500/10'},
            { to:'/chairman/academic',   icon:Layers,        label:'Academic Structure',color:'text-purple-400', bg:'bg-purple-500/10' },
            { to:'/chairman/attendance', icon:QrCode,        label:'Live Attendance',  color:'text-cyan-400',    bg:'bg-cyan-500/10'   },
          ].map(({ to, icon: Icon, label, color, bg }) => (
            <Link key={to} to={to}
              className="card p-4 flex items-center gap-3 hover:border-white/15 transition-all group"
              // Android Chrome GPU-compositing fix (same technique already used in
              // Modal/Layout header/SettingsPage/AttendancePage): without its own
              // isolated layer, this card can share a render tile with content
              // scrolling past it, producing corrupted/blank-looking cards on some
              // Android GPU/driver combos. Visual-only change, no logic touched.
              style={{ isolation: 'isolate', transform: 'translateZ(0)', willChange: 'transform' }}>
              <div className={`p-2.5 rounded-xl ${bg}`}><Icon size={16} className={color}/></div>
              <span className="text-sm font-medium text-white/70 group-hover:text-white flex-1">{label}</span>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50"/>
            </Link>
          ))}
        </div>

        {/* V2.0 — CR Management */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <UserCog size={15} className="text-cyan-400"/>
            <h3 className="section-title">CR Management</h3>
            <span className="text-xs text-white/30 ml-auto">{crs.length} Class Representative{crs.length!==1?'s':''}</span>
          </div>
          {crs.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">
              No CRs yet. Approve a CR from a pending student request — promote them via the Students page.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {crs.map(cr => (
                <div key={cr.id} className="flex items-center gap-3 p-4">
                  <Avatar name={cr.displayName} size={9}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{cr.displayName}</div>
                    <div className="text-xs text-white/40">{cr.email}</div>
                  </div>
                  {cr.studentClass && <span className="badge badge-blue text-[10px]">{cr.studentClass}</span>}
                  <span className={`badge text-[10px] ${cr.status==='approved' ? 'badge-green' : 'badge-amber'}`}>
                    {cr.status === 'approved' ? 'Active' : cr.status}
                  </span>
                  <button onClick={()=>setRemoveCrTarget(cr)} className="btn-danger btn-xs flex items-center gap-1">
                    <UserMinus size={12}/> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sessions + announcements */}
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex justify-between">
              <h3 className="section-title">Recent Sessions</h3>
              <Link to="/chairman/reports" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No sessions yet</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {sessions.slice(0,5).map(s=>(
                  <div key={s.id} className="flex items-center gap-3 p-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status==='active'?'bg-emerald-400 animate-pulse':'bg-white/20'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{s.subjectName||'Session'}</div>
                      <div className="text-xs text-white/35">{s.teacherName} · {formatDate(s.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400 num">{s.presentCount||0}</div>
                      <div className="text-[10px] text-white/30">present</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex justify-between items-center">
              <h3 className="section-title">Announcements</h3>
              <button onClick={()=>setAnnOpen(true)} className="btn-ghost btn-xs flex items-center gap-1">
                <Plus size={12}/> New
              </button>
            </div>
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No announcements yet</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {announcements.slice(0,5).map(a=>(
                  <div key={a.id} className="p-4 flex gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{a.title}</div>
                      <div className="text-xs text-white/45 mt-0.5 line-clamp-2">{a.message}</div>
                      <div className="text-[10px] text-white/25 mt-1">{formatDateTime(a.createdAt)}</div>
                    </div>
                    <button onClick={()=>handleDeleteAnn(a.id)} className="btn-icon p-1.5 self-start">
                      <Trash2 size={12} className="text-red-400/60"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dept QR Modal */}
        <Modal open={qrOpen} onClose={()=>setQrOpen(false)} title="Department QR Code" size="sm">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-white/50 text-center">
              Print this QR code and post it on your notice board. Teachers and students scan it to join.
            </p>
            <div className="p-5 bg-white rounded-2xl">
              <QRCodeSVG
                value={`${window.location.origin}/join?qr=${dept?.qrCode || dept?.id}`}
                size={200} level="H"
              />
            </div>
            <div className="w-full p-3 rounded-xl text-center font-mono text-sm text-blue-300"
              style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)'}}>
              {dept?.inviteCode}
            </div>
            <div className="flex gap-3 w-full">
              <button className="btn-secondary flex-1 btn-sm" onClick={copyCode}>
                <Copy size={13}/> Copy Code
              </button>
              <button className="btn-primary flex-1 btn-sm" onClick={()=>window.print()}>
                Print QR
              </button>
            </div>
          </div>
        </Modal>

        {/* Announcement Modal */}
        <Modal open={annOpen} onClose={()=>setAnnOpen(false)} title="Post Announcement" size="md">
          <form onSubmit={handlePostAnn} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input className="input" placeholder="Announcement title" value={annTitle} onChange={e=>setAnnTitle(e.target.value)} required/>
            </div>
            <div>
              <label className="label">Message *</label>
              <textarea className="input resize-none" rows={4} placeholder="Write your announcement..." value={annText} onChange={e=>setAnnText(e.target.value)} required/>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={()=>setAnnOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm">
                {saving&&<Loader2 size={13} className="animate-spin"/>}
                Post
              </button>
            </div>
          </form>
        </Modal>

        {/* V2.0 — Remove CR confirmation */}
        <ConfirmDialog
          open={!!removeCrTarget}
          onClose={()=>setRemoveCrTarget(null)}
          onConfirm={handleRemoveCR}
          title="Remove CR Privileges?"
          message={`${removeCrTarget?.displayName} will be demoted to a regular student and lose all CR permissions (student approvals, authorized attendance sessions). Their class will show "No Active CR Assigned" until a replacement is approved.`}
          danger
        />
      </div>
    </Layout>
  );
}
