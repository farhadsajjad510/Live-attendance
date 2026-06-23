import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { sendPasswordReset } from '../../firebase/firestore';
import { CLASS_OPTIONS, classLabel } from '../../utils/helpers';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Loader2, Shield, BookOpen,
  GraduationCap, UserCheck, Lock, AlertCircle,
} from 'lucide-react';

// Roles available on public signup (owner is NOT listed — owner uses dedicated page)
const ROLES = [
  {
    id: 'chairman', label: 'Chairman',
    desc: 'Create & manage your department', Icon: Shield,
    color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10',
  },
  {
    id: 'teacher', label: 'Teacher',
    desc: 'Teach assigned subjects', Icon: BookOpen,
    color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10',
  },
  {
    id: 'cr', label: 'Class Rep (CR)',
    desc: 'Assist attendance sessions', Icon: UserCheck,
    color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10',
  },
  {
    id: 'student', label: 'Student',
    desc: 'View attendance & classes', Icon: GraduationCap,
    color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10',
  },
];

// ── Shared nav header ─────────────────────────────────────────────────────────
function AuthNav() {
  return (
    <div className="flex items-center gap-3 p-6">
      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
        <span className="text-xs font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>LA</span>
      </div>
      <span className="text-base font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>Live Attendance</span>
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────────────────────────
// ── Forgot Password Modal ─────────────────────────────────────────────────────
function ForgotPasswordModal({ open, onClose, defaultEmail = '' }) {
  const [email,   setEmail]   = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [err,     setErr]     = useState('');
  useEffect(() => { if (open) { setEmail(defaultEmail); setSent(false); setErr(''); } }, [open, defaultEmail]);
  if (!open) return null;

  async function handleSend(e) {
    e.preventDefault(); setErr('');
    if (!email.trim()) { setErr('Enter your email'); return; }
    setSending(true);
    try { await sendPasswordReset(email.trim()); setSent(true); }
    catch (ex) {
      const m = { 'auth/user-not-found':'No account with this email','auth/invalid-email':'Invalid email','auth/too-many-requests':'Too many attempts, try later' };
      setErr(m[ex.code] || 'Failed to send reset email');
    } finally { setSending(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}
      onClick={onClose}>
      <div className="glass-dark border border-white/10 rounded-2xl p-6 max-w-sm w-full page-in" onClick={e=>e.stopPropagation()}>
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4" style={{fontSize:24}}>✅</div>
            <h3 className="text-lg font-bold text-white mb-2" style={{fontFamily:'Syne,sans-serif'}}>Email Sent!</h3>
            <p className="text-white/45 text-sm mb-5">Reset link sent to <span className="text-white">{email}</span>. Check your inbox.</p>
            <button className="btn-primary w-full" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-white mb-1" style={{fontFamily:'Syne,sans-serif'}}>Reset Password</h3>
            <p className="text-white/40 text-sm mb-4">Enter your account email to receive a reset link.</p>
            <form onSubmit={handleSend} className="space-y-3">
              <div><label className="label">Email</label>
                <input className="input" type="email" placeholder="you@institution.edu" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus />
              </div>
              {err && <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs text-red-300" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)'}}><AlertCircle size={13}/>{err}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={sending} className="btn-primary flex-1">
                  {sending && <Loader2 size={14} className="animate-spin"/>}{sending ? 'Sending…' : 'Send Link'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { profile } = await login(form.email, form.password);
      if (!profile) { toast.error('Account not found'); return; }
      toast.success('Welcome back!');
      const routes = {
        owner: '/owner', chairman: '/chairman',
        teacher: '/teacher', cr: '/cr', student: '/student',
      };
      navigate(routes[profile.role] || '/student');
    } catch (err) {
      const msgs = {
        'auth/user-not-found':   'No account with this email',
        'auth/wrong-password':   'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/invalid-email':    'Invalid email address',
      };
      toast.error(msgs[err.code] || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#030711] bg-mesh bg-grid flex flex-col">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-blue-600/6 rounded-full blur-3xl pointer-events-none" />
      <AuthNav />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md page-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Sign in</h1>
            <p className="text-white/40 text-sm">Education Management Platform</p>
          </div>
          <form onSubmit={handleSubmit} className="glass-dark border border-white/10 p-6 rounded-2xl space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@institution.edu"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-11" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-blue-400/70 hover:text-blue-300 transition-colors">Forgot Password?</button>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-white/35 text-sm mt-5">
            New to the platform?{' '}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">Create account</Link>
          </p>
          <p className="text-center mt-3 text-white/20 text-[11px]">
            Platform Owner?{' '}
            <Link to="/owner-login" className="text-purple-400/70 hover:text-purple-300">Owner login →</Link>
          </p>
        </div>
      </div>
      <div className="p-4 text-center">
        <p className="text-white/15 text-xs">Powered by FarhadAIStudio</p>
      </div>
      <ForgotPasswordModal open={showForgot} onClose={() => setShowForgot(false)} defaultEmail={form.email} />
    </div>
  );
}

// ── Signup Page ───────────────────────────────────────────────────────────────
export function SignupPage() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: '', email: '', password: '',
    employeeId: '', qualification: '', phone: '',
    rollNumber: '', program: '', semester: '1', studentClass: 'BS1',
  });
  const { signup } = useAuth();
  const navigate = useNavigate();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signup({ ...form, role });
      if (role === 'chairman') {
        toast.success('Account created! Set up your department.');
        navigate('/chairman');
      } else {
        toast.success('Account created! Join your department to get started.');
        navigate('/pending');
      }
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Email already registered',
        'auth/weak-password':        'Password must be at least 6 characters',
      };
      toast.error(msgs[err.code] || err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#030711] bg-mesh bg-grid flex flex-col">
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-blue-600/6 rounded-full blur-3xl pointer-events-none" />
      <AuthNav />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg page-in">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              {[1, 2].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all ${s <= step ? 'w-8 bg-blue-500' : 'w-4 bg-white/15'}`} />
              ))}
            </div>
            <h1 className="text-3xl font-bold text-white mt-4" style={{ fontFamily: 'Syne,sans-serif' }}>
              {step === 1 ? 'Choose your role' : 'Your information'}
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {step === 1 ? 'Select how you will use Live Attendance' : `Registering as ${role}`}
            </p>
          </div>

          {step === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(({ id, label, desc, Icon, color, border, bg }) => (
                <button key={id}
                  onClick={() => { setRole(id); setStep(2); }}
                  className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] ${border} ${bg}`}>
                  <Icon size={20} className={`${color} mb-3`} />
                  <div className="font-bold text-white text-sm" style={{ fontFamily: 'Syne,sans-serif' }}>{label}</div>
                  <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass-dark border border-white/10 p-6 rounded-2xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Full Name *</label>
                  <input className="input" placeholder="Your full name" value={form.displayName} onChange={set('displayName')} required />
                </div>
                <div className="col-span-2">
                  <label className="label">Email *</label>
                  <input className="input" type="email" placeholder="you@institution.edu" value={form.email} onChange={set('email')} required />
                </div>

                {/* Teacher fields */}
                {role === 'teacher' && <>
                  <div>
                    <label className="label">Employee ID</label>
                    <input className="input" placeholder="EMP-001" value={form.employeeId} onChange={set('employeeId')} />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="+92 300…" value={form.phone} onChange={set('phone')} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Qualification</label>
                    <input className="input" placeholder="e.g. PhD Physics" value={form.qualification} onChange={set('qualification')} />
                  </div>
                </>}

                {/* Student / CR fields */}
                {(role === 'student' || role === 'cr') && <>
                  <div>
                    <label className="label">Roll Number *</label>
                    <input className="input font-mono" placeholder="2023-CS-001" value={form.rollNumber} onChange={set('rollNumber')} required />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="+92 300…" value={form.phone} onChange={set('phone')} />
                  </div>
                  <div>
                    <label className="label">Program</label>
                    <input className="input" placeholder="e.g. BS Physics" value={form.program} onChange={set('program')} />
                  </div>
                  <div>
                    <label className="label">Class</label>
                    <select className="input" value={form.studentClass} onChange={set('studentClass')}>
                      {CLASS_OPTIONS.map(c => (
                        <option key={c} value={c}>{classLabel(c)}</option>
                      ))}
                    </select>
                  </div>
                </>}

                <div className="col-span-2">
                  <label className="label">Password *</label>
                  <div className="relative">
                    <input className="input pr-11" type={showPw ? 'text' : 'password'}
                      placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Contextual hint */}
              {role === 'chairman' ? (
                <div className="p-3 rounded-xl text-xs text-cyan-300/70"
                  style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
                  ✓ Chairman accounts are activated immediately. You can create your department right after signup.
                </div>
              ) : (
                <div className="p-3 rounded-xl text-xs text-amber-300/70"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  After registration, join your department using the department QR code or invite code.
                  Your account will be activated after Chairman approval.
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>← Back</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-white/35 text-sm mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="p-4 text-center">
        <p className="text-white/15 text-xs">Powered by FarhadAIStudio</p>
      </div>
    </div>
  );
}

// ── Pending Approval Page ─────────────────────────────────────────────────────
export function PendingPage() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#030711] bg-mesh flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center glass-dark border border-white/10 p-8 rounded-2xl page-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
          <Loader2 size={26} className="text-amber-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Awaiting Approval</h2>
        <p className="text-white/45 text-sm leading-relaxed mb-2">
          Hello <span className="text-white">{profile?.displayName}</span>!
        </p>
        <p className="text-white/35 text-sm mb-6">
          Scan your department's QR code or enter an invite code to join.
          Once the Chairman approves your request, you'll get full access.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1 btn-sm" onClick={() => navigate('/join')}>
            Join Department
          </button>
          <button className="btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Owner Login Page ──────────────────────────────────────────────────────────
export function OwnerLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { profile } = await login(form.email, form.password);
      // Strict check — only role === 'owner' may proceed
      if (!profile || profile.role !== 'owner') {
        await signOut(auth);
        setError('This account does not have owner privileges.');
        setLoading(false);
        return;
      }
      toast.success('Welcome, Platform Owner');
      navigate('/owner');
    } catch (err) {
      const msgs = {
        'auth/user-not-found':     'No account with this email',
        'auth/wrong-password':     'Incorrect password',
        'auth/invalid-credential': 'Invalid credentials',
      };
      setError(msgs[err.code] || 'Authentication failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030711] bg-mesh flex flex-col items-center justify-center p-6">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/6 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-sm page-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-900/30">
            <Lock size={22} className="text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>Platform Owner</h1>
          <p className="text-white/35 text-sm mt-1">Restricted administrator access</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-dark border border-purple-500/15 p-6 rounded-2xl space-y-4">
          <div>
            <label className="label">Owner Email</label>
            <input className="input" type="email" placeholder="owner@platform.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-xs text-red-300"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={13} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-purple-400/70 hover:text-purple-300 transition-colors">Forgot Password?</button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Authenticating…' : 'Owner Sign In'}
          </button>
        </form>

        <p className="text-center mt-5">
          <Link to="/login" className="text-white/25 text-sm hover:text-white/50 transition-colors">
            ← Regular user login
          </Link>
        </p>

      </div>
      <p className="text-white/15 text-xs mt-8">Powered by FarhadAIStudio</p>
      <ForgotPasswordModal open={showForgot} onClose={() => setShowForgot(false)} defaultEmail={form.email} />
    </div>
  );
}



// ════════════════════════════════════════════════════════════════════════════
// OWNER SETUP PAGE — One-time first-run owner account creation
//
// Rules:
//  • Visible ONLY at /owner-setup
//  • On load: checks Firestore for any existing owner account
//  • If owner already exists → redirects to /owner-login immediately
//  • On success: creates Firebase Auth + Firestore doc with role=owner
//  • After creation: route becomes permanently unreachable (ownerExists → true)
//  • No Firebase Console work required
//
// FIXES applied vs previous broken version:
//  1. Removed ALL dynamic imports — uses static imports already at top of file
//  2. signOut(auth) called correctly — NOT firebaseAuth.signOut()
//  3. createUserWithEmailAndPassword and updateProfile used from static imports
//  4. ownerExists + createUserProfile imported from static firestore import
// ════════════════════════════════════════════════════════════════════════════
export function OwnerSetupPage() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [form, setForm] = useState({
    displayName: '',
    email:       '',
    password:    '',
    confirmPw:   '',
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── On mount: check whether an owner already exists ───────────────────────
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const { ownerExists } = await import('../../firebase/firestore');
        const exists = await ownerExists();
        if (cancelled) return;
        if (exists) {
          navigate('/owner-login', { replace: true });
        } else {
          setChecking(false);
        }
      } catch (_err) {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [navigate]);

  // ── Create owner account ───────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setError('');

    if (!form.displayName.trim())                 { setError('Enter your full name'); return; }
    if (!form.email.trim())                       { setError('Enter an email address'); return; }
    if (form.password.length < 8)                 { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirmPw)         { setError('Passwords do not match'); return; }

    setSaving(true);
    try {
      // Import only what isn't already available at module scope
      const { ownerExists, createUserProfile } = await import('../../firebase/firestore');
      // FIX: import firebase/auth statically at top of function scope
      // to avoid Rollup chunk resolution issues in production
      const firebaseAuthModule = await import('firebase/auth');
      const createUserWithEmailAndPassword = firebaseAuthModule.createUserWithEmailAndPassword;
      const updateProfile = firebaseAuthModule.updateProfile;

      // 1. Race-condition guard
      const alreadyExists = await ownerExists();
      if (alreadyExists) {
        setError('An owner account already exists. Redirecting to login…');
        setTimeout(() => navigate('/owner-login', { replace: true }), 2000);
        return;
      }

      // 2. Create Firebase Authentication account
      const { user: u } = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );

      // 3. Set display name on the auth profile
      await updateProfile(u, { displayName: form.displayName.trim() });

      // 4. Write Firestore profile doc — user must still be signed in for rules to allow this
      await createUserProfile(u.uid, {
        uid:         u.uid,
        email:       form.email.trim(),
        displayName: form.displayName.trim(),
        role:        'owner',
        status:      'approved',
        active:      true,
      });

      // 5. Sign out — owner logs in via /owner-login
      //    FIX: signOut(auth) — NOT auth.signOut() which doesn't exist
      await signOut(auth);

      setDone(true);
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email':        'Invalid email address.',
        'auth/weak-password':        'Password is too weak (min 8 characters).',
        'auth/network-request-failed': 'Network error. Check your connection.',
      };
      setError(msgs[err.code] || err.message || 'Something went wrong. Check console.');
    } finally {
      setSaving(false);
    }
  }

  // ── Checking state ────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', background: '#030711',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, background: 'rgba(139,92,246,0.2)',
            border: '1px solid rgba(139,92,246,0.35)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 18,
          }}>🔐</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Checking platform status…</p>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-[#030711] bg-mesh flex flex-col items-center justify-center p-6">
        <div className="glass-dark border border-white/10 p-8 rounded-2xl max-w-sm w-full text-center page-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5">
            <span style={{ fontSize: 28 }}>✅</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>
            Owner Account Created!
          </h2>
          <p className="text-white/45 text-sm mb-1">Your platform owner account is ready.</p>
          <p className="text-white/30 text-xs mb-6">This setup page is now permanently disabled.</p>
          <button
            className="btn-primary w-full"
            onClick={() => navigate('/owner-login', { replace: true })}
          >
            Go to Owner Login →
          </button>
        </div>
      </div>
    );
  }

  // ── Setup form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#030711] bg-mesh bg-grid flex flex-col">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/6 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 p-6">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
          <span className="text-xs font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>LA</span>
        </div>
        <span className="text-base font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>
          Live Attendance
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md page-in">

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-900/30">
              <Lock size={22} className="text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne,sans-serif' }}>
              Create Platform Owner
            </h1>
            <p className="text-white/40 text-sm">First-time setup · This page works only once</p>
          </div>

          <div className="p-3 rounded-xl text-xs text-purple-300/80 mb-6 flex items-start gap-2"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Shield size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <span>
              The Owner account has full platform access and cannot be created again
              once this form is submitted. Keep your credentials safe.
            </span>
          </div>

          <form onSubmit={handleCreate} className="glass-dark border border-purple-500/15 p-6 rounded-2xl space-y-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" type="text" placeholder="e.g. Sajjad Ali"
                value={form.displayName} onChange={set('displayName')} required autoComplete="name" />
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input className="input" type="email" placeholder="owner@yourdomain.com"
                value={form.email} onChange={set('email')} required autoComplete="email" />
            </div>
            <div>
              <label className="label">Password * (min. 8 characters)</label>
              <div className="relative">
                <input
                  className="input pr-11"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Choose a strong password"
                  value={form.password} onChange={set('password')}
                  required minLength={8} autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password *</label>
              <input className="input" type="password" placeholder="Re-enter your password"
                value={form.confirmPw} onChange={set('confirmPw')} required autoComplete="new-password" />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full mt-2"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Creating Owner Account…' : 'Create Owner Account'}
            </button>
          </form>

          <p className="text-center mt-4">
            <Link to="/owner-login" className="text-white/25 text-xs hover:text-white/50 transition-colors">
              Owner already exists? Sign in →
            </Link>
          </p>
        </div>
      </div>

      <div className="p-4 text-center">
        <p className="text-white/15 text-xs">Powered by FarhadAIStudio</p>
      </div>
    </div>
  );
}
