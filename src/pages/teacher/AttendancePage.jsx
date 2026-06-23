import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherAssignments, getDeptStudents, createSession, closeSession,
  markAttendance, subscribeRecords, getSession, getStudentByRoll,
  getDelegationsForCR,
} from '../../firebase/firestore';
import { formatTime, gpsDistance } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, XCircle, Loader2, StopCircle, Play, Scan, ShieldCheck, UserCheck, X, GraduationCap } from 'lucide-react';

const GPS_RADIUS = 15;
const SESSION_DURATION = 30 * 60;

// ISSUE 2 FIX — class options for teacher selection
const CLASS_OPTIONS = ['BS1', 'BS2', 'BS3', 'BS4'];
const CLASS_LABELS  = { BS1: 'BS-I', BS2: 'BS-II', BS3: 'BS-III', BS4: 'BS-IV' };

export default function TeacherAttendancePage() {
  const { profile, deptId } = useAuth();
  const location = useLocation();
  const [assignments, setAssignments] = useState([]);
  const [students,    setStudents]    = useState([]);
  const [session,     setSession]     = useState(null);
  const [records,     setRecords]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [starting,    setStarting]    = useState(false);
  const [mode,        setMode]        = useState('1');
  const [selAssign,   setSelAssign]   = useState(null);
  // ISSUE 2 FIX — teacher must select a class before starting
  const [selClass,    setSelClass]    = useState('');
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [scanInput,   setScanInput]   = useState('');
  const [gpsOk,       setGpsOk]       = useState(false);
  const [gpsCoords,   setGpsCoords]   = useState(null);
  const [crSelfMode,  setCrSelfMode]  = useState(false);
  const [crSelfStatus, setCrSelfStatus] = useState('idle');
  const [crSelfMsg,   setCrSelfMsg]   = useState('');
  const timerRef = useRef(null);
  const scanRef  = useRef(null);

  const isCR = profile?.role === 'cr';

  // Initial load
  useEffect(() => {
    if (!deptId || !profile) return;

    if (isCR) {
      // ISSUE 3 FIX — CR students filtered to their own class only
      Promise.all([
        getDelegationsForCR(deptId, profile.uid),
        getDeptStudents(deptId, { studentClass: profile.studentClass }),
      ]).then(([delegations, s]) => {
        const opts = delegations.map(d => ({
          id: d.id, subjectId: d.subjectId, subjectName: d.subjectName,
          program: d.program, semester: d.semester,
          teacherId: d.teacherId, teacherName: d.teacherName,
          delegationId: d.id, expiresAt: d.expiresAt,
        }));
        setAssignments(opts); setStudents(s);
        if (location.state?.delegation) {
          const dgt = location.state.delegation;
          setSelAssign(opts.find(o => o.id === dgt.id) || opts[0] || null);
        } else if (opts.length > 0) setSelAssign(opts[0]);
        setLoading(false);
      });
    } else {
      // ISSUE 2 FIX — load assignments only; students loaded after class is selected
      getTeacherAssignments(deptId, profile.uid).then((a) => {
        setAssignments(a);
        if (location.state?.assignment) setSelAssign(location.state.assignment);
        else if (a.length > 0) setSelAssign(a[0]);
        setLoading(false);
      });
    }

    navigator.geolocation?.getCurrentPosition(
      p => { setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsOk(true); },
      () => setGpsOk(false)
    );
  }, [deptId, profile]);

  // ISSUE 1 & 2 FIX — when teacher picks a class, load only that class's students
  useEffect(() => {
    if (isCR || !deptId || !selClass) return;
    getDeptStudents(deptId, { studentClass: selClass })
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [selClass, deptId, isCR]);

  // Subscribe to live records
  useEffect(() => {
    if (!session) return;
    const unsub = subscribeRecords(deptId, session.id, setRecords);
    return unsub;
  }, [session]);

  // Countdown timer
  useEffect(() => {
    if (!session || session.status !== 'active') return;
    timerRef.current = setInterval(() => {
      const exp = session.expiresAt?.toDate?.() || new Date(Date.now() + SESSION_DURATION * 1000);
      const diff = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) { handleCloseSession(); }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [session]);

  async function handleStartSession() {
    if (!selAssign) { toast.error('Select a subject first'); return; }
    if (!isCR && !selClass) { toast.error('Select a class (BS-I / BS-II / BS-III / BS-IV) first'); return; }

    if (isCR) {
      const exp = selAssign.expiresAt?.toDate?.();
      if (exp && exp.getTime() < Date.now()) {
        toast.error('This authorization has expired. Ask the teacher to re-authorize.');
        return;
      }
    }

    setStarting(true);
    try {
      const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);
      // ISSUE 1 FIX — store studentClass in session for class isolation
      const targetClass = isCR ? (profile.studentClass || '') : selClass;
      const sessionData = {
        teacherId:   isCR ? selAssign.teacherId   : profile.uid,
        teacherName: isCR ? selAssign.teacherName : profile.displayName,
        createdByRole: isCR ? 'cr' : 'teacher',
        createdByName: profile.displayName,
        ...(isCR ? { delegationId: selAssign.delegationId, authorizedBy: selAssign.teacherName } : {}),
        subjectId:   selAssign.subjectId,
        subjectName: selAssign.subjectName,
        program:     selAssign.program,
        semester:    selAssign.semester,
        // ISSUE 1 FIX — class tag on session enables class-isolated record filtering
        studentClass: targetClass,
        mode,
        totalStudents: students.length,
        expiresAt,
        lat: gpsCoords?.lat || null,
        lng: gpsCoords?.lng || null,
      };
      const ref = await createSession(deptId, sessionData);
      const s = await getSession(deptId, ref.id);
      setSession(s);
      setTimeLeft(SESSION_DURATION);
      toast.success('Attendance session started!');
    } catch (e) { toast.error(e.message); }
    finally { setStarting(false); }
  }

  async function handleCloseSession() {
    if (!session) return;
    clearInterval(timerRef.current);
    await closeSession(deptId, session.id);
    toast.success(`Session closed. ${records.length} students marked.`);
    setSession(null); setRecords([]);
  }

  // Mode 2: teacher/CR scans student QR
  async function handleScanStudent(e) {
    e.preventDefault();
    if (!scanInput.trim() || !session) return;
    try {
      let parsed;
      try { parsed = JSON.parse(scanInput); } catch { parsed = { roll: scanInput }; }
      const studentId = parsed.uid;
      const rollNumber = parsed.roll || scanInput;

      const student = studentId
        ? students.find(s => s.id === studentId)
        : await getStudentByRoll(deptId, rollNumber);
      if (!student) throw new Error('Student not found in this class');

      // ISSUE 1 FIX — block cross-class scanning
      const sessionClass = session.studentClass;
      if (sessionClass && student.studentClass && student.studentClass !== sessionClass) {
        throw new Error(`Student belongs to ${CLASS_LABELS[student.studentClass] || student.studentClass}, not this session's class`);
      }

      if (gpsCoords && session.lat) {
        const dist = gpsDistance(gpsCoords.lat, gpsCoords.lng, session.lat, session.lng);
        if (dist > GPS_RADIUS) throw new Error(`Student too far (${Math.round(dist)}m). Must be within ${GPS_RADIUS}m.`);
      }

      await markAttendance(deptId, session.id, {
        studentId: student.id, studentName: student.displayName, rollNumber: student.rollNumber,
        status: 'present', markedBy: profile.uid, markedByName: profile.displayName, method: 'scan',
      });
      setScanInput('');
      toast.success(`✅ ${student.displayName} marked present`);
      scanRef.current?.focus();
    } catch (e) { toast.error(e.message); setScanInput(''); }
  }

  async function handleCRMarkSelf() {
    if (!session || !profile) return;
    setCrSelfStatus('verifying');
    try {
      if (gpsCoords && session.lat && session.lng) {
        const dist = gpsDistance(gpsCoords.lat, gpsCoords.lng, session.lat, session.lng);
        if (dist > GPS_RADIUS) {
          setCrSelfStatus('error');
          setCrSelfMsg(`Too far from classroom (${Math.round(dist)}m away). Must be within ${GPS_RADIUS}m.`);
          return;
        }
      }
      await markAttendance(deptId, session.id, {
        studentId:   profile.uid,
        studentName: profile.displayName,
        rollNumber:  profile.rollNumber || '',
        status:      'present',
        markedBy:    profile.uid,
        markedByName: profile.displayName,
        method:      'self',
      });
      setCrSelfStatus('success');
      setCrSelfMsg(`Your attendance has been marked for ${selAssign?.subjectName}`);
      toast.success('Your attendance marked! ✅');
    } catch (e) {
      setCrSelfStatus('error');
      setCrSelfMsg(e.message || 'Failed to mark attendance');
    }
  }

  function closeCRSelfMode() {
    setCrSelfMode(false); setCrSelfStatus('idle'); setCrSelfMsg('');
  }

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const qrValue = session ? JSON.stringify({
    deptId, sessionId: session.id, subjectId: selAssign?.subjectId,
    exp: session.expiresAt?.toDate?.()?.toISOString(), qrGeneratedAt: Date.now(),
  }) : '';
  const activeClassLabel = session?.studentClass ? (CLASS_LABELS[session.studentClass] || session.studentClass) : '';

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div>
          <h1 className="page-title">Take Attendance</h1>
          <p className="page-sub">{isCR ? 'Start an authorized session on behalf of a teacher' : 'Start a live session for your class'}</p>
        </div>

        {!session ? (
          <div className="max-w-lg space-y-5">
            <div className="card p-5 space-y-4">

              {/* Subject selector */}
              <div>
                <label className="label">{isCR ? 'Authorized Subject *' : 'Select Subject *'}</label>
                <select className="input" value={selAssign?.id||''} onChange={e => setSelAssign(assignments.find(a=>a.id===e.target.value))}>
                  <option value="">{isCR ? 'Choose authorized subject…' : 'Choose subject…'}</option>
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.subjectName} — {a.program} Sem {a.semester}{isCR ? ` (by ${a.teacherName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* ISSUE 2 FIX — class selector for teacher only */}
              {!isCR && (
                <div>
                  <label className="label">Select Class *</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {CLASS_OPTIONS.map(cls => (
                      <button key={cls} type="button" onClick={() => setSelClass(cls)}
                        className={`py-2.5 rounded-xl border text-center transition-all ${selClass === cls
                          ? 'border-blue-500/60 bg-blue-500/15 text-blue-300 font-bold'
                          : 'border-white/10 hover:border-white/25 text-white/60'}`}>
                        <div className="text-sm font-bold" style={{fontFamily:'Syne,sans-serif'}}>{CLASS_LABELS[cls]}</div>
                      </button>
                    ))}
                  </div>
                  {selClass && (
                    <p className="text-xs text-white/35 mt-1.5">
                      {students.length} student{students.length !== 1 ? 's' : ''} in {CLASS_LABELS[selClass]}
                    </p>
                  )}
                </div>
              )}

              {isCR && selAssign && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs text-emerald-300/80"
                  style={{background:'rgba(16,185,129,0.07)',border:'1px solid rgba(16,185,129,0.18)'}}>
                  <ShieldCheck size={13} className="text-emerald-400 flex-shrink-0"/>
                  Authorized by {selAssign.teacherName}
                  {selAssign.expiresAt?.toDate && ` · until ${selAssign.expiresAt.toDate().toLocaleDateString()}`}
                </div>
              )}

              {/* ISSUE 3 FIX — CR class restriction notice */}
              {isCR && profile?.studentClass && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs text-blue-300/80"
                  style={{background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.18)'}}>
                  <GraduationCap size={13} className="text-blue-400 flex-shrink-0"/>
                  Restricted to your class: {CLASS_LABELS[profile.studentClass] || profile.studentClass}
                </div>
              )}

              {/* Mode selector */}
              <div>
                <label className="label">Attendance Mode</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    { id:'1', title:'Mode 1', desc:'Students scan Teacher QR', icon:'📱' },
                    { id:'2', title:'Mode 2', desc:'Teacher scans Student QR', icon:'🔍' },
                  ].map(m => (
                    <button key={m.id} type="button" onClick={() => setMode(m.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${mode===m.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:border-white/20'}`}>
                      <div className="text-lg mb-1">{m.icon}</div>
                      <div className="text-sm font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>{m.title}</div>
                      <div className="text-xs text-white/40">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-white/40">
                <div className={`w-2 h-2 rounded-full ${gpsOk ? 'bg-emerald-400' : 'bg-amber-400'}`}/>
                {gpsOk ? `GPS active — Location verified (${GPS_RADIUS}m radius)` : 'GPS unavailable — location check disabled'}
              </div>

              <button onClick={handleStartSession}
                disabled={starting || !selAssign || (!isCR && !selClass) || assignments.length===0}
                className="btn-primary w-full flex items-center gap-2">
                {starting ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>}
                {starting ? 'Starting…' : 'Start Attendance Session'}
              </button>
            </div>

            {assignments.length === 0 && !loading && (
              <div className="p-4 rounded-xl text-sm text-amber-400/80" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)'}}>
                {isCR
                  ? 'No teacher has authorized you for attendance yet. Ask a teacher to add you under "Manage Delegates".'
                  : 'No subjects assigned yet. Ask the Chairman to assign subjects to you.'}
              </div>
            )}
          </div>
        ) : (
          /* ── Active session ── */
          <div className="space-y-5">
            <div className="card card-active p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="dot-live"/>
                    <span className="text-sm font-bold text-emerald-400" style={{fontFamily:'Syne,sans-serif'}}>LIVE</span>
                    {/* ISSUE 1 FIX — show which class this session is for */}
                    {activeClassLabel && (
                      <span className="badge badge-blue text-[10px]">{activeClassLabel}</span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>{selAssign?.subjectName}</h2>
                  <p className="text-white/45 text-sm">{selAssign?.program} · Semester {selAssign?.semester}</p>
                  {isCR && (
                    <span className="badge badge-cyan text-[10px] mt-1 inline-flex items-center gap-1">
                      <ShieldCheck size={10}/> Run by {profile?.displayName} (CR) · Authorized by {selAssign?.teacherName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400 num" style={{fontFamily:'Syne,sans-serif'}}>{records.length}</div>
                    <div className="text-[10px] text-white/35">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white/40 num" style={{fontFamily:'Syne,sans-serif'}}>{students.length}</div>
                    <div className="text-[10px] text-white/35">Total</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold num font-mono ${timeLeft < 120 ? 'text-red-400' : 'text-white'}`}>{fmt(timeLeft)}</div>
                    <div className="text-[10px] text-white/35">Remaining</div>
                  </div>
                  <button onClick={handleCloseSession} className="btn-danger flex items-center gap-2">
                    <StopCircle size={15}/> Close
                  </button>
                  {isCR && (
                    <button onClick={() => { setCrSelfMode(true); setCrSelfStatus('idle'); setCrSelfMsg(''); }}
                      className="btn-primary flex items-center gap-2">
                      <UserCheck size={15}/> Mark My Attendance
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              {mode === '1' ? (
                <div className="card p-5 flex flex-col items-center gap-4">
                  <h3 className="section-title">Students Scan This QR</h3>
                  <div className="relative">
                    <div className="p-4 bg-white rounded-2xl shadow-xl">
                      <QRCodeSVG value={qrValue} size={200} level="H"/>
                    </div>
                    <div className="absolute top-4 left-4 right-4 h-0.5 scan-line"/>
                  </div>
                  {session?.sessionCode && (
                    <div className="w-full rounded-2xl border border-blue-500/25 p-4 text-center"
                      style={{ background: 'rgba(59,130,246,0.07)' }}>
                      <p className="text-xs text-white/45 mb-2 uppercase tracking-widest font-semibold">Session Code</p>
                      <p className="text-4xl font-bold tracking-[0.25em] text-blue-300 font-mono" style={{ fontFamily: 'monospace' }}>
                        {session.sessionCode}
                      </p>
                      <p className="text-xs text-white/30 mt-2">Students can enter this code instead of scanning QR</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xs text-white/40">QR refreshes every 30 minutes</p>
                    <p className="text-xs text-white/25 mt-0.5">GPS radius: {GPS_RADIUS}m</p>
                  </div>
                </div>
              ) : (
                <div className="card p-5 space-y-4">
                  <h3 className="section-title">Scan Student QR Code</h3>
                  <p className="text-sm text-white/45">Point your QR scanner at the student's personal QR code, or type their roll number.</p>
                  <form onSubmit={handleScanStudent} className="space-y-3">
                    <input ref={scanRef} className="input font-mono text-lg text-center tracking-widest"
                      placeholder="Scan or type roll number…"
                      value={scanInput} onChange={e=>setScanInput(e.target.value)}
                      autoFocus/>
                    <button type="submit" className="btn-success w-full flex items-center gap-2">
                      <Scan size={15}/> Mark Present
                    </button>
                  </form>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400"/>
                  <span className="section-title">Marked Present ({records.length})</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
                  {records.length === 0 ? (
                    <div className="p-8 text-center text-white/30 text-sm">
                      {mode==='1' ? 'Waiting for students to scan QR…' : 'Scan student QR codes to mark attendance…'}
                    </div>
                  ) : (
                    records.map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <CheckCircle size={13} className="text-emerald-400 flex-shrink-0"/>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-white">{r.studentName}</span>
                          <span className="ml-2 font-mono text-xs text-white/35">{r.rollNumber}</span>
                        </div>
                        <span className="text-xs text-white/30">{formatTime(r.markedAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* CR self-attendance overlay */}
            {isCR && crSelfMode && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', isolation: 'isolate', transform: 'translateZ(0)', willChange: 'transform' }}>
                <div className="card w-full max-w-sm p-6 space-y-5 relative"
                  style={{ border: '1px solid rgba(59,130,246,0.3)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck size={18} className="text-blue-400"/>
                      <h3 className="font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>Mark My Attendance</h3>
                    </div>
                    <button onClick={closeCRSelfMode}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                      <X size={15}/>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs text-emerald-300/80"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"/>
                    Session is still live · QR active · {fmt(timeLeft)} remaining
                  </div>
                  <div className="text-sm text-white/60">
                    Marking attendance for <span className="text-white font-semibold">{selAssign?.subjectName}</span>
                  </div>
                  {crSelfStatus === 'idle' && (
                    <button onClick={handleCRMarkSelf} className="btn-primary w-full flex items-center justify-center gap-2">
                      <UserCheck size={15}/> Confirm — Mark Me Present
                    </button>
                  )}
                  {crSelfStatus === 'verifying' && (
                    <div className="flex items-center justify-center gap-2 py-3 text-white/50 text-sm">
                      <Loader2 size={18} className="animate-spin text-blue-400"/> Marking attendance…
                    </div>
                  )}
                  {crSelfStatus === 'success' && (
                    <div className="space-y-3">
                      <div className="flex flex-col items-center gap-2 py-3">
                        <CheckCircle size={36} className="text-emerald-400"/>
                        <p className="font-bold text-white text-center">Attendance Marked!</p>
                        <p className="text-white/50 text-sm text-center">{crSelfMsg}</p>
                      </div>
                      <button onClick={closeCRSelfMode} className="btn-success w-full flex items-center justify-center gap-2">Back to Session</button>
                    </div>
                  )}
                  {crSelfStatus === 'error' && (
                    <div className="space-y-3">
                      <div className="flex flex-col items-center gap-2 py-2">
                        <XCircle size={32} className="text-red-400"/>
                        <p className="font-bold text-white">Failed</p>
                        <p className="text-white/50 text-sm text-center">{crSelfMsg}</p>
                      </div>
                      <button onClick={() => setCrSelfStatus('idle')} className="btn-primary w-full flex items-center justify-center gap-2">Try Again</button>
                      <button onClick={closeCRSelfMode} className="btn-ghost btn-sm w-full">Back to Session</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
