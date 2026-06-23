import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getSessions, getSessionRecords, getDeptStudents, subscribeRecords, closeSession } from '../../firebase/firestore';
import { formatDate, formatTime } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { QrCode, Activity, Users, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { Modal } from '../../components/ui/index.jsx';

export default function AttendanceMonitorPage() {
  const { deptId } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [live, setLive] = useState(null);
  const [liveRecords, setLiveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  // ISSUE 1 FIX — class filter for chairman monitor view
  const [filterClass, setFilterClass] = useState('');
  const CLASS_LABELS = { BS1:'BS-I', BS2:'BS-II', BS3:'BS-III', BS4:'BS-IV' };

  const [sessionPage, setSessionPage] = useState(1);
  const SESSION_PAGE = 20;

  useEffect(() => {
    if (!deptId) return;
    // ISSUE 1 FIX — filter sessions by class when selected
    const sessionFilter = filterClass ? { studentClass: filterClass } : {};
    const studentFilter = filterClass ? { studentClass: filterClass } : {};
    Promise.all([
      getSessions(deptId, sessionFilter, SESSION_PAGE),
      getDeptStudents(deptId, studentFilter, 200),
    ]).then(([s, st]) => {
      setSessions(s); setStudents(st);
      const active = s.find(x => x.status === 'active');
      if (active) setLive(active);
      setLoading(false);
    }).catch(e => { toast.error('Failed to load sessions'); setLoading(false); });
  }, [deptId, filterClass]);

  useEffect(() => {
    if (!live) return;
    const unsub = subscribeRecords(deptId, live.id, setLiveRecords);
    return unsub;
  }, [live]);

  async function handleClose(sessionId) {
    await closeSession(deptId, sessionId);
    toast.success('Session closed');
    setSessions(s => s.map(x => x.id===sessionId ? {...x, status:'closed'} : x));
    if (live?.id === sessionId) setLive(null);
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const pastSessions   = sessions.filter(s => s.status !== 'active');

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h1 className="page-title">Attendance Monitor</h1><p className="page-sub">Live overview of all sessions</p></div>
          {/* ISSUE 1 FIX — class filter for isolated view */}
          <select className="input text-sm w-36" value={filterClass} onChange={e=>setFilterClass(e.target.value)}>
            <option value="">All Classes</option>
            {['BS1','BS2','BS3','BS4'].map(c=><option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
          </select>
        </div>

        {/* Live session monitor */}
        {activeSessions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="dot-live"/>
              <span className="text-sm font-bold text-emerald-400" style={{fontFamily:'Syne,sans-serif'}}>LIVE SESSIONS ({activeSessions.length})</span>
            </div>
            {activeSessions.map(s => (
              <div key={s.id} className="card card-active p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="font-bold text-white text-lg" style={{fontFamily:'Syne,sans-serif'}}>{s.subjectName}</div>
                    <div className="text-sm text-white/45 mt-0.5">{s.teacherName} · {s.program} Sem {s.semester} · {formatTime(s.createdAt)}</div>
                    {s.createdByRole === 'cr' && (
                      <span className="badge badge-cyan text-[10px] mt-1 inline-block">Started by CR: {s.createdByName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400 num" style={{fontFamily:'Syne,sans-serif'}}>{s.presentCount||0}</div>
                      <div className="text-[10px] text-white/35">Present</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white/40 num" style={{fontFamily:'Syne,sans-serif'}}>{students.length}</div>
                      <div className="text-[10px] text-white/35">Total</div>
                    </div>
                    <button onClick={() => { setLive(s); }} className="btn-secondary btn-sm flex items-center gap-1.5">
                      <Eye size={13}/> Watch
                    </button>
                    <button onClick={() => handleClose(s.id)} className="btn-danger btn-sm">Close</button>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{width:`${students.length ? ((s.presentCount||0)/students.length)*100 : 0}%`}}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past sessions */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h3 className="section-title">Session History</h3>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 shimmer rounded-lg"/>)}</div>
          ) : pastSessions.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No completed sessions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Subject</th><th>Teacher</th><th>Program</th><th>Date</th><th>Created By</th><th>Present</th><th>Status</th></tr></thead>
                <tbody>
                  {pastSessions.map(s => (
                    <tr key={s.id}>
                      <td className="font-medium text-white">{s.subjectName||'Session'}</td>
                      <td className="text-white/55">{s.teacherName}</td>
                      <td className="text-white/45 text-xs">{s.program} Sem {s.semester}</td>
                      <td className="text-white/35 text-xs">{formatDate(s.createdAt)} {formatTime(s.createdAt)}</td>
                      <td>
                        {s.createdByRole === 'cr'
                          ? <span className="badge badge-cyan text-[10px]">CR: {s.createdByName}</span>
                          : <span className="badge badge-gray text-[10px]">Teacher</span>}
                      </td>
                      <td><span className="badge badge-green text-[10px]">{s.presentCount||0} / {students.length}</span></td>
                      <td><span className="badge badge-gray text-[10px]">Closed</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Live watch modal */}
      <Modal open={!!live} onClose={() => setLive(null)} title={`Live: ${live?.subjectName}`} size="lg">
        {live && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-xl" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
              <div className="dot-live"/>
              <span className="text-sm text-emerald-400 font-medium">{liveRecords.length} students marked so far</span>
              <span className="text-xs text-white/35 ml-auto">{live.mode==='1'?'Students scan QR':'Teacher scans students'}</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {liveRecords.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">Waiting for students…</div>
              ) : (
                liveRecords.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{background:'rgba(255,255,255,0.03)'}}>
                    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0"/>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-white">{r.studentName}</span>
                      <span className="ml-2 font-mono text-xs text-white/35">{r.rollNumber}</span>
                    </div>
                    <span className="text-xs text-white/30">{formatTime(r.markedAt)}</span>
                    <span className={`badge text-[10px] ${r.status==='present'?'badge-green':'badge-amber'}`}>{r.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
