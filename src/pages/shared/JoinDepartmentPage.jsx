// JoinDepartmentPage — teachers/students/CRs join a department
// html5-qrcode is loaded lazily (dynamic import) to prevent Vite production
// build crash caused by html5-qrcode accessing document/navigator at module init time
//
// HIERARCHY ADDITION: After finding a department, students and CRs are asked
// to select their Academic Level → Year Class → Semester before submitting.
// Teachers skip this step. All existing join/submit logic is unchanged.

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDepartmentByCode, getDepartmentByQR, submitJoinRequest,
  getAcademicLevels, getYearClasses,
} from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { QrCode, Hash, Loader2, CheckCircle, Building2, ArrowRight, ChevronRight } from 'lucide-react';

export default function JoinDepartmentPage() {
  const { profile, deptId } = useAuth();
  const navigate             = useNavigate();
  const [searchParams]       = useSearchParams();

  const [mode,    setMode]    = useState('code');
  const [code,    setCode]    = useState('');
  const [dept,    setDept]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [joined,  setJoined]  = useState(false);
  const scannerRef = useRef(null);
  const divRef     = useRef(null);

  // ── Hierarchy selection state (students + CRs only) ───────────────────────
  const needsHierarchy = profile?.role === 'student' || profile?.role === 'cr';
  const [levels,     setLevels]     = useState([]);
  const [yearClasses,setYearClasses]= useState([]);
  const [selLevel,   setSelLevel]   = useState(null); // { id, name }
  const [selClass,   setSelClass]   = useState(null); // { id, name, semesters }
  const [loadingLvl, setLoadingLvl] = useState(false);
  const [loadingCls, setLoadingCls] = useState(false);

  // If QR param in URL, auto-lookup
  useEffect(() => {
    const qr = searchParams.get('qr');
    if (qr) lookupByQR(qr);
  }, []);

  // Lazily load html5-qrcode only when user switches to QR mode
  useEffect(() => {
    if (mode !== 'qr') {
      try { scannerRef.current?.clear?.(); } catch {}
      return;
    }
    let scanner = null;
    const timer = setTimeout(() => {
      if (!divRef.current) return;
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        if (!divRef.current) return;
        scanner = new Html5QrcodeScanner('dept-qr-reader', { fps: 8, qrbox: 200 }, false);
        scanner.render(
          (text) => {
            try { scanner.clear(); } catch {}
            const match = text.match(/[?&]qr=([^&]+)/);
            const qrVal = match ? match[1] : text;
            lookupByQR(qrVal);
            setMode('code');
          },
          () => {}
        );
        scannerRef.current = scanner;
      }).catch(() => { toast.error('QR scanner failed to load'); setMode('code'); });
    }, 100);
    return () => { clearTimeout(timer); try { scannerRef.current?.clear?.(); } catch {} };
  }, [mode]);

  // When a department is found and user needs hierarchy, load academic levels
  useEffect(() => {
    if (!dept || !needsHierarchy) return;
    setLoadingLvl(true);
    getAcademicLevels(dept.id)
      .then(setLevels)
      .catch(() => setLevels([]))
      .finally(() => setLoadingLvl(false));
  }, [dept, needsHierarchy]);

  // When a level is selected, load its year classes
  async function handleSelectLevel(level) {
    setSelLevel(level);
    setSelClass(null);
    setYearClasses([]);
    setLoadingCls(true);
    try {
      const cls = await getYearClasses(dept.id, level.id);
      setYearClasses(cls);
    } catch { setYearClasses([]); }
    finally { setLoadingCls(false); }
  }

  async function lookupByQR(qrVal) {
    setLoading(true);
    try {
      const d = await getDepartmentByQR(qrVal);
      setDept(d);
      toast.success(`Found: ${d.name}`);
    } catch (e) {
      toast.error('Invalid QR code');
    } finally { setLoading(false); }
  }

  async function lookupByCode(e) {
    e.preventDefault();
    if (code.length < 4) return;
    setLoading(true);
    try {
      const d = await getDepartmentByCode(code);
      setDept(d);
      // Reset hierarchy selections when new dept found
      setSelLevel(null); setSelClass(null);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!dept || !profile) return;

    // Validate hierarchy selection for students/CRs
    if (needsHierarchy && levels.length > 0) {
      if (!selLevel) { toast.error('Please select your Academic Level'); return; }
      if (!selClass) { toast.error('Please select your Year Class'); return; }
    }

    setLoading(true);
    try {
      await submitJoinRequest(dept.id, {
        userId:        profile.uid,
        displayName:   profile.displayName,
        email:         profile.email,
        role:          profile.role,
        rollNumber:    profile.rollNumber    || '',
        employeeId:    profile.employeeId    || '',
        qualification: profile.qualification || '',
        phone:         profile.phone         || '',
        studentClass:  profile.studentClass  || '',
        // Existing fields — unchanged
        program:       selLevel?.name || profile.program  || '',
        semester:      profile.semester || '',
        // New hierarchy fields — added alongside existing ones
        ...(needsHierarchy && selLevel ? {
          levelId:        selLevel.id,
          levelName:      selLevel.name,
          classId:        selClass?.id        || '',
          className:      selClass?.name      || '',
        } : {}),
      });
      setJoined(true);
      toast.success('Join request submitted! Awaiting chairman approval.');
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  // Already in a department
  if (deptId) {
    return (
      <Layout>
        <div className="page-in max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Already in a Department</h2>
          <p className="text-white/40 text-sm mb-6">You are already a member of a department.</p>
          <button className="btn-primary" onClick={() => navigate(`/${profile?.role}`)}>
            Go to Dashboard <ArrowRight size={15} />
          </button>
        </div>
      </Layout>
    );
  }

  if (joined) {
    return (
      <Layout>
        <div className="page-in max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Request Submitted!</h2>
          <p className="text-white/40 text-sm mb-2">Your request for <span className="text-white">{dept?.name}</span> has been sent.</p>
          {selClass && (
            <p className="text-white/30 text-xs mb-2">
              {selLevel?.name} → {selClass?.name}
            </p>
          )}
          <p className="text-white/30 text-xs mb-6">The chairman will review and approve your request.</p>
          <button className="btn-ghost btn-sm" onClick={() => navigate(`/${profile?.role}`)}>Back to Dashboard</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-in max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="page-title">Join a Department</h1>
          <p className="page-sub">Scan the QR code or enter the invite code</p>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit mx-auto"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['code', 'Enter Code'], ['qr', 'Scan QR']].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'}`}
              style={{ fontFamily: 'Syne,sans-serif' }}>
              {l}
            </button>
          ))}
        </div>

        {mode === 'code' ? (
          <form onSubmit={lookupByCode} className="card p-6 space-y-4">
            <div>
              <label className="label">Department Invite Code</label>
              <input
                className="input font-mono text-xl tracking-[0.4em] text-center uppercase"
                placeholder="XXXXXX" value={code} maxLength={8}
                onChange={e => setCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-white/30 mt-1.5 text-center">Ask your Chairman or CR for the 6-character code</p>
            </div>
            <button type="submit" disabled={loading || code.length < 4} className="btn-primary w-full">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />}
              {loading ? 'Looking up…' : 'Find Department'}
            </button>
          </form>
        ) : (
          <div className="card p-6">
            <p className="text-sm text-white/40 text-center mb-4">Scan the QR code posted in your department</p>
            <div id="dept-qr-reader" ref={divRef} className="rounded-xl overflow-hidden" />
          </div>
        )}

        {/* Found department */}
        {dept && (
          <div className="mt-5 space-y-4">
            {/* Dept info */}
            <div className="card border-blue-500/25 p-5" style={{ background: 'rgba(59,130,246,0.06)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>{dept.name}</div>
                  <div className="text-sm text-white/40">{dept.institution}</div>
                  <div className="text-xs text-white/30">Chairman: {dept.chairmanName}</div>
                </div>
              </div>
            </div>

            {/* ── Hierarchy selection for students/CRs ───────────────────── */}
            {needsHierarchy && (
              <div className="card p-5 space-y-4">
                <h3 className="text-sm font-bold text-white/80" style={{ fontFamily: 'Syne,sans-serif' }}>
                  Select Your Class
                </h3>

                {loadingLvl ? (
                  <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-9 shimmer rounded-lg"/>)}</div>
                ) : levels.length === 0 ? (
                  <p className="text-xs text-white/35 italic">
                    No academic levels set up yet. You can still join — the chairman will assign your class.
                  </p>
                ) : (
                  <>
                    {/* Step 1 — Academic Level */}
                    <div>
                      <label className="label">Academic Level *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {levels.map(lvl => (
                          <button key={lvl.id} type="button"
                            onClick={() => handleSelectLevel(lvl)}
                            className={`p-2.5 rounded-xl border text-left text-sm font-semibold transition-all ${
                              selLevel?.id === lvl.id
                                ? 'border-blue-500/50 bg-blue-500/12 text-blue-300'
                                : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white'
                            }`}
                            style={{ fontFamily: 'Syne,sans-serif' }}>
                            {lvl.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 2 — Year Class */}
                    {selLevel && (
                      <div>
                        <label className="label">Year Class *</label>
                        {loadingCls ? (
                          <div className="space-y-1.5">{[1,2].map(i=><div key={i} className="h-9 shimmer rounded-lg"/>)}</div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {yearClasses.map(cls => (
                              <button key={cls.id} type="button"
                                onClick={() => { setSelClass(cls); }}
                                className={`p-2.5 rounded-xl border text-left text-sm font-semibold transition-all ${
                                  selClass?.id === cls.id
                                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                                    : 'border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white'
                                }`}
                                style={{ fontFamily: 'Syne,sans-serif' }}>
                                {cls.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selection summary */}
                    {selLevel && selClass && (
                      <div className="p-2.5 rounded-xl text-xs text-emerald-300/80 flex items-center gap-1.5"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                        {selLevel.name} → {selClass.name}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Approval notice */}
            <div className="p-3 rounded-xl text-xs text-amber-300/70"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              Your request will be reviewed by the Chairman before you gain access.
            </div>

            <button onClick={handleJoin} disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {loading ? 'Submitting…' : `Request to Join as ${profile?.role}`}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
