// ScanPage — student/CR marks attendance via:
//   Option A: Scan QR (back camera preferred, front camera fallback)
//   Option B: Enter Session Code (6-char alphanumeric)
// html5-qrcode is loaded lazily (dynamic import) to prevent Vite production
// build crash caused by html5-qrcode accessing document/navigator at module init time

import { useState, useRef, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getSession, getSessionByCode, markAttendance } from '../../firebase/firestore';
import { gpsDistance, semesterToClass } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { QrCode, CheckCircle, AlertTriangle, Loader2, MapPin, KeyRound } from 'lucide-react';

const GPS_THRESHOLD = 15; // V1.9: 15 metres

export default function ScanPage() {
  const { profile, deptId } = useAuth();
  const [status,     setStatus]     = useState('idle');   // idle | scanning | entering-code | verifying | success | error
  const [message,    setMessage]    = useState('');
  const [gpsOk,      setGpsOk]      = useState(false);
  const [coords,     setCoords]     = useState(null);
  const [codeInput,  setCodeInput]  = useState('');
  const scannerRef = useRef(null);
  const divRef     = useRef(null);
  const codeRef    = useRef(null);

  // Get GPS on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsOk(true); },
      () => setGpsOk(false)
    );
  }, []);

  // Focus code input when entering-code mode
  useEffect(() => {
    if (status === 'entering-code') {
      setTimeout(() => codeRef.current?.focus(), 100);
    }
  }, [status]);

  // Lazily load and start html5-qrcode only when user clicks Scan
  // FEATURE 1 FIX: facingMode 'environment' = back camera; falls back to 'user' (front) automatically
  useEffect(() => {
    if (status !== 'scanning') return;

    let scanner = null;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!divRef.current) return;

      scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      // Try back camera first; if it fails, fallback to front camera
      const startScanner = (facingMode) => {
        scanner.start(
          { facingMode },
          { fps: 10, qrbox: 220 },
          async (text) => {
            try { await scanner.stop(); } catch {}
            setStatus('idle');
            await handleQRScan(text);
          },
          () => {} // ignore per-frame errors
        ).catch(() => {
          if (facingMode === 'environment') {
            // Back camera failed — try front camera
            startScanner('user');
          } else {
            setStatus('idle');
            toast.error('Camera could not be started');
          }
        });
      };

      startScanner('environment');
    }).catch(() => {
      setStatus('idle');
      toast.error('QR scanner failed to load');
    });

    return () => {
      try { scannerRef.current?.stop?.().catch(() => {}); } catch {}
    };
  }, [status]);

  // ── Shared attendance logic (used by both QR and code paths) ──────────────
  async function handleAttendanceSession(session, sessionDeptId, sessionId) {
    // CLASS ISOLATION FIX: block student from marking attendance in another class's session.
    // Resolve student's class from profile.studentClass OR from semester mapping.
    if (session.studentClass) {
      const studentClass = profile?.studentClass || (profile?.semester ? semesterToClass(profile.semester) : null);
      if (studentClass && studentClass !== session.studentClass) {
        setStatus('error');
        setMessage('This session is not for your class. Ask your own teacher to start a session.');
        return;
      }
    }

    // GPS check
    if (session.lat && session.lng && coords) {
      const dist = gpsDistance(coords.lat, coords.lng, session.lat, session.lng);
      if (dist > GPS_THRESHOLD) {
        setStatus('error');
        setMessage(`Too far from classroom (${Math.round(dist)}m away)`);
        return;
      }
    }

    await markAttendance(sessionDeptId, sessionId, {
      studentId:   profile.uid,
      studentName: profile.displayName,
      rollNumber:  profile.rollNumber || '',
      status:      'present',
    });

    setStatus('success');
    setMessage(`Attendance marked for ${session.subjectName}`);
    toast.success('Attendance marked! ✅');
  }

  // ── Option A: QR scan handler ─────────────────────────────────────────────
  async function handleQRScan(text) {
    setStatus('verifying');
    try {
      const data = JSON.parse(text);
      const { deptId: sessionDeptId, sessionId, qrGeneratedAt } = data;
      if (!sessionDeptId || !sessionId) { setStatus('error'); setMessage('Invalid QR code'); return; }

      // V1.9: reject QR codes older than 5 minutes
      if (qrGeneratedAt && (Date.now() - qrGeneratedAt) > 5 * 60 * 1000) {
        setStatus('error'); setMessage('QR code expired. Ask your teacher to refresh.'); return;
      }

      const session = await getSession(sessionDeptId, sessionId);
      if (!session || session.status !== 'active') {
        setStatus('error'); setMessage('Session is not active or has expired'); return;
      }

      await handleAttendanceSession(session, sessionDeptId, sessionId);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Failed to mark attendance');
    }
  }

  // ── Option B: Session code handler ───────────────────────────────────────
  async function handleCodeSubmit(e) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code || code.length < 4) { toast.error('Enter a valid session code'); return; }
    setStatus('verifying');
    try {
      const session = await getSessionByCode(deptId, code);
      if (!session) {
        setStatus('error');
        setMessage('Invalid or expired session code. Ask your teacher for the current code.');
        return;
      }
      await handleAttendanceSession(session, deptId, session.id);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Failed to mark attendance');
    }
  }

  function resetToIdle() {
    try { scannerRef.current?.stop?.().catch(() => {}); } catch {}
    setStatus('idle');
    setCodeInput('');
    setMessage('');
  }

  return (
    <Layout>
      <div className="page-in max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="page-title">Mark Attendance</h1>
          <p className="page-sub">Scan the QR code or enter the session code</p>
        </div>

        {/* GPS status */}
        <div className={`flex items-center gap-3 p-3 rounded-xl text-sm ${gpsOk ? 'text-emerald-400' : 'text-amber-400'}`}
          style={{ background: gpsOk ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${gpsOk ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
          <MapPin size={15} />
          {gpsOk ? 'Location verified' : 'Enable location for attendance verification'}
        </div>

        {/* ── IDLE: two method options ── */}
        {status === 'idle' && (
          <div className="card p-5 space-y-4">
            <p className="text-sm text-white/50 text-center">Choose how to mark your attendance</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Option A */}
              <button
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-blue-500/25 hover:border-blue-500/50 transition-all"
                style={{ background: 'rgba(59,130,246,0.07)' }}
                onClick={() => setStatus('scanning')}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                  <QrCode size={22} className="text-blue-400" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>Scan QR</div>
                  <div className="text-xs text-white/35 mt-0.5">Use camera</div>
                </div>
              </button>

              {/* Option B */}
              <button
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-emerald-500/25 hover:border-emerald-500/50 transition-all"
                style={{ background: 'rgba(16,185,129,0.07)' }}
                onClick={() => setStatus('entering-code')}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <KeyRound size={22} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>Enter Code</div>
                  <div className="text-xs text-white/35 mt-0.5">Type session code</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING: camera view ── */}
        {status === 'scanning' && (
          <div className="card p-5 space-y-3">
            <p className="text-xs text-white/40 text-center">Back camera will open automatically</p>
            <div id="qr-reader" ref={divRef} className="rounded-xl overflow-hidden" />
            <button className="btn-secondary btn-sm w-full" onClick={resetToIdle}>Cancel</button>
          </div>
        )}

        {/* ── ENTERING CODE ── */}
        {status === 'entering-code' && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-emerald-400" />
              <h3 className="section-title">Enter Session Code</h3>
            </div>
            <p className="text-sm text-white/45">Ask your teacher for the 6-character session code displayed on their screen.</p>
            <form onSubmit={handleCodeSubmit} className="space-y-3">
              <input
                ref={codeRef}
                className="input font-mono text-2xl text-center tracking-[0.4em] uppercase"
                placeholder="A7K92X"
                maxLength={6}
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={codeInput.length < 4}
                className="btn-success w-full flex items-center justify-center gap-2"
              >
                <CheckCircle size={15} /> Mark Attendance
              </button>
            </form>
            <button className="btn-secondary btn-sm w-full" onClick={resetToIdle}>Back</button>
          </div>
        )}

        {/* ── VERIFYING ── */}
        {status === 'verifying' && (
          <div className="card p-8 text-center space-y-3">
            <Loader2 size={32} className="text-blue-400 animate-spin mx-auto" />
            <p className="text-white/50 text-sm">Verifying attendance…</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === 'success' && (
          <div className="card p-8 text-center space-y-3">
            <CheckCircle size={40} className="text-emerald-400 mx-auto" />
            <p className="font-bold text-white">Attendance Marked!</p>
            <p className="text-white/50 text-sm">{message}</p>
            <button className="btn-secondary btn-sm mt-2" onClick={resetToIdle}>Done</button>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="card p-8 text-center space-y-3">
            <AlertTriangle size={36} className="text-red-400 mx-auto" />
            <p className="font-bold text-white">Failed</p>
            <p className="text-white/50 text-sm">{message}</p>
            <button className="btn-primary btn-sm mt-2" onClick={resetToIdle}>Try Again</button>
          </div>
        )}
      </div>
    </Layout>
  );
}
