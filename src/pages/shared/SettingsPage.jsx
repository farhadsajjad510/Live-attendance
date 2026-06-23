// SettingsPage — role-aware settings for Owner, Chairman, Teacher, CR, Student
// ROOT CAUSE FIX: Trash2 and Link were used in JSX but never imported → ReferenceError on load.
// ADDED: in-page password change (reauthenticate → updatePassword) and account deletion
//        with password confirmation, instead of routing to a separate page.

import { useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserProfile, deleteUserRecord } from '../../firebase/firestore';
import { roleLabel, roleBadge } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  User, Lock, Bell, Shield, Sliders, Loader2,
  Mail, Save, Building2, GraduationCap, Trash2,
  Eye, EyeOff, AlertTriangle, CheckCircle, X,
} from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import { auth } from '../../firebase/config';

export default function SettingsPage() {
  const { profile, refreshProfile, logout } = useAuth();
  const role = profile?.role || 'student';

  // ── Profile form ─────────────────────────────────────────────────────────
  const [name,  setName]  = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingProfile(true);
    try {
      await updateUserProfile(profile.uid, { displayName: name.trim(), phone: phone.trim() });
      await refreshProfile();
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Profile update failed. Please try again.');
    } finally { setSavingProfile(false); }
  }

  // ── Change Password (in-page, no email reset) ─────────────────────────────
  const [pwCurrent,  setPwCurrent]  = useState('');
  const [pwNew,      setPwNew]      = useState('');
  const [pwConfirm,  setPwConfirm]  = useState('');
  const [showPwCurr, setShowPwCurr] = useState(false);
  const [showPwNew,  setShowPwNew]  = useState(false);
  const [showPwConf, setShowPwConf] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!pwCurrent)               { toast.error('Enter your current password');          return; }
    if (pwNew.length < 6)         { toast.error('New password must be at least 6 characters'); return; }
    if (pwNew !== pwConfirm)      { toast.error('New passwords do not match');            return; }
    if (pwNew === pwCurrent)      { toast.error('New password must differ from current'); return; }

    setChangingPw(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, pwCurrent);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, pwNew);
      toast.success('Password changed successfully!');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect');
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please wait and try again.');
      } else if (err.code === 'auth/requires-recent-login') {
        toast.error('Session expired. Please sign out and sign in again.');
      } else {
        toast.error(err.message || 'Failed to change password');
      }
    } finally { setChangingPw(false); }
  }

  // ── Delete Account ────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword,   setDeletePassword]   = useState('');
  const [showDeletePw,     setShowDeletePw]     = useState(false);
  const [deleting,         setDeleting]         = useState(false);

  async function handleDeleteAccount() {
    if (!deletePassword) { toast.error('Enter your password to confirm deletion'); return; }
    setDeleting(true);
    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      // 2. Remove Firestore user record
      await deleteUserRecord(profile.uid);
      // 3. Delete Firebase Auth account
      await deleteUser(auth.currentUser);
      toast.success('Account deleted successfully');
      // logout() clears local state; Firebase Auth is already gone so it's safe
      await logout();
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Incorrect password. Account not deleted.');
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please wait and try again.');
      } else if (err.code === 'auth/requires-recent-login') {
        toast.error('Session expired. Please sign out and sign in again.');
      } else {
        toast.error(err.message || 'Account deletion failed. Please try again.');
      }
    } finally { setDeleting(false); }
  }

  // ── Preferences (per-user, localStorage) ─────────────────────────────────
  const prefKey = `la_prefs_${profile?.uid}`;
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(prefKey)) || {}; } catch { return {}; }
  });
  function setPref(key, val) {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    try { localStorage.setItem(prefKey, JSON.stringify(next)); } catch {}
    toast.success('Preference saved');
  }

  // ── Avatar initials helper ────────────────────────────────────────────────
  const initials = (profile?.displayName || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="page-in space-y-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/12 border border-blue-500/20">
            <Sliders size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-sub">
              <span className={`badge text-[10px] ${roleBadge(role)} mr-2`}>{roleLabel(role)}</span>
              Manage your account
            </p>
          </div>
        </div>

        {/* ── Profile Avatar + Summary ── */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-blue-300" style={{ fontFamily: 'Syne,sans-serif' }}>{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-lg leading-tight" style={{ fontFamily: 'Syne,sans-serif' }}>
              {profile?.displayName || '—'}
            </div>
            <div className="text-sm text-white/45 mt-0.5">{profile?.email}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`badge text-[10px] ${roleBadge(role)}`}>{roleLabel(role)}</span>
              {profile?.departmentName && (
                <span className="text-xs text-white/35 flex items-center gap-1">
                  <Building2 size={10} /> {profile.departmentName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Profile Information ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={15} className="text-blue-400" />
            <h3 className="section-title">Profile Information</h3>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input opacity-60" value={profile?.email || ''} disabled />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300…" />
              </div>
              <div>
                <label className="label">Role</label>
                <input className="input opacity-60" value={roleLabel(role)} disabled />
              </div>

              {/* Department (all roles that have one) */}
              {profile?.departmentName && (
                <div className="sm:col-span-2">
                  <label className="label">Department</label>
                  <div className="input opacity-60 flex items-center gap-2">
                    <Building2 size={13} className="text-cyan-400" /> {profile.departmentName}
                  </div>
                </div>
              )}

              {/* Student-specific fields */}
              {role === 'student' && profile?.studentClass && (
                <div>
                  <label className="label">Class</label>
                  <div className="input opacity-60 flex items-center gap-2">
                    <GraduationCap size={13} className="text-emerald-400" /> {profile.studentClass}
                  </div>
                </div>
              )}
              {role === 'student' && profile?.rollNumber && (
                <div>
                  <label className="label">Roll Number</label>
                  <div className="input opacity-60 font-mono">{profile.rollNumber}</div>
                </div>
              )}
            </div>
            <button type="submit" disabled={savingProfile} className="btn-primary btn-sm flex items-center gap-2">
              {savingProfile ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Changes
            </button>
          </form>
        </div>

        {/* ── Change Password ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={15} className="text-amber-400" />
            <h3 className="section-title">Change Password</h3>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="label">Current Password *</label>
              <div className="relative">
                <input
                  type={showPwCurr ? 'text' : 'password'}
                  className="input pr-10"
                  value={pwCurrent}
                  onChange={e => setPwCurrent(e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPwCurr(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPwCurr ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="label">New Password *</label>
              <div className="relative">
                <input
                  type={showPwNew ? 'text' : 'password'}
                  className="input pr-10"
                  value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPwNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPwNew ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              {pwNew && pwNew.length < 6 && (
                <p className="text-xs text-red-400/80 mt-1">Password must be at least 6 characters</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="label">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showPwConf ? 'text' : 'password'}
                  className="input pr-10"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPwConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPwConf ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              {pwConfirm && pwNew !== pwConfirm && (
                <p className="text-xs text-red-400/80 mt-1">Passwords do not match</p>
              )}
              {pwConfirm && pwNew === pwConfirm && pwConfirm.length >= 6 && (
                <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
                  <CheckCircle size={11}/> Passwords match
                </p>
              )}
            </div>

            <button type="submit" disabled={changingPw} className="btn-secondary btn-sm flex items-center gap-2">
              {changingPw ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
              {changingPw ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* ── Owner: Platform Preferences + Security ── */}
        {role === 'owner' && (
          <>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={15} className="text-purple-400" />
                <h3 className="section-title">Platform Preferences</h3>
              </div>
              <div className="space-y-3">
                <ToggleRow label="Email notifications for new departments"    prefs={prefs} setPref={setPref} k="notifyNewDept"    />
                <ToggleRow label="Email notifications for new users"          prefs={prefs} setPref={setPref} k="notifyNewUser"    />
                <ToggleRow label="Show suspended users in lists"              prefs={prefs} setPref={setPref} k="showSuspended"    />
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-red-400" />
                <h3 className="section-title">Security Settings</h3>
              </div>
              <div className="space-y-3">
                <ToggleRow label="Require re-authentication for sensitive actions" prefs={prefs} setPref={setPref} k="reauthSensitive" />
                <ToggleRow label="Log all admin actions to Audit Log"             prefs={prefs} setPref={setPref} k="logAllActions"   defaultOn />
              </div>
            </div>
          </>
        )}

        {/* ── Chairman: Department Preferences + Notifications ── */}
        {role === 'chairman' && (
          <>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-cyan-400" />
                <h3 className="section-title">Department Preferences</h3>
              </div>
              <div className="space-y-3">
                <ToggleRow label="Auto-approve students with matching roll number format" prefs={prefs} setPref={setPref} k="autoApproveStudents" />
                <ToggleRow label="Require GPS verification for attendance"               prefs={prefs} setPref={setPref} k="requireGPS"          defaultOn />
                <ToggleRow label="Allow Mode 2 (teacher scans student)"                  prefs={prefs} setPref={setPref} k="allowMode2"          defaultOn />
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={15} className="text-amber-400" />
                <h3 className="section-title">Notification Settings</h3>
              </div>
              <div className="space-y-3">
                <ToggleRow label="Notify me of new join requests"                prefs={prefs} setPref={setPref} k="notifyJoinRequests"  defaultOn />
                <ToggleRow label="Notify me when attendance drops below 75%"     prefs={prefs} setPref={setPref} k="notifyLowAttendance" defaultOn />
                <ToggleRow label="Weekly summary email"                          prefs={prefs} setPref={setPref} k="weeklySummary"       />
              </div>
            </div>
          </>
        )}

        {/* ── Teacher: Attendance Preferences ── */}
        {role === 'teacher' && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} className="text-blue-400" />
              <h3 className="section-title">Attendance Preferences</h3>
            </div>
            <div className="space-y-3">
              <ToggleRow label="Default to Mode 1 (students scan QR)"       prefs={prefs} setPref={setPref} k="defaultMode1"    defaultOn />
              <ToggleRow label="Auto-close session after 60 minutes"         prefs={prefs} setPref={setPref} k="autoCloseSession" />
              <ToggleRow label="Sound alert when a student marks attendance" prefs={prefs} setPref={setPref} k="soundAlert"       />
            </div>
          </div>
        )}

        {/* ── CR / Student: Personal Preferences ── */}
        {(role === 'cr' || role === 'student') && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} className="text-emerald-400" />
              <h3 className="section-title">Personal Preferences</h3>
            </div>
            <div className="space-y-3">
              <ToggleRow label="Notify me about new announcements"               prefs={prefs} setPref={setPref} k="notifyAnnouncements" defaultOn />
              <ToggleRow label="Notify me when my attendance drops below 75%"    prefs={prefs} setPref={setPref} k="notifyMyAttendance"  defaultOn />
              <ToggleRow label="Remember last scan mode"                         prefs={prefs} setPref={setPref} k="rememberScanMode"    defaultOn />
            </div>
          </div>
        )}

        {/* ── Danger Zone — Delete Account ── */}
        <div className="card p-5" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={15} className="text-red-400" />
            <h3 className="section-title" style={{ color: 'rgba(248,113,113,0.85)' }}>Danger Zone</h3>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button onClick={() => setShowDeleteDialog(true)}
            className="btn-danger btn-sm flex items-center gap-2 w-fit">
            <Trash2 size={13} /> Delete My Account
          </button>
        </div>

      </div>

      {/* ── Delete Account Confirmation Dialog ── */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', isolation: 'isolate', transform: 'translateZ(0)', willChange: 'transform' }}>
          <div className="card w-full max-w-sm p-6 space-y-5 relative"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}>

            {/* Close */}
            <button onClick={() => { setShowDeleteDialog(false); setDeletePassword(''); setShowDeletePw(false); }}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
              <X size={15}/>
            </button>

            {/* Warning header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-400"/>
              </div>
              <div>
                <h3 className="font-bold text-white" style={{ fontFamily: 'Syne,sans-serif' }}>Delete Account</h3>
                <p className="text-xs text-white/40">This cannot be undone</p>
              </div>
            </div>

            {/* Warning message */}
            <div className="p-3 rounded-xl text-xs text-red-300/80 space-y-1"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="font-semibold text-red-300">You are about to permanently delete:</p>
              <p>• Your account for <span className="text-white">{profile?.email}</span></p>
              <p>• Your profile and all personal data</p>
              <p>• Your attendance records will remain (anonymized)</p>
            </div>

            {/* Password confirmation */}
            <div>
              <label className="label">Enter your password to confirm *</label>
              <div className="relative">
                <input
                  type={showDeletePw ? 'text' : 'password'}
                  className="input pr-10"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowDeletePw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showDeletePw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteDialog(false); setDeletePassword(''); setShowDeletePw(false); }}
                className="btn-ghost btn-sm flex-1">
                Cancel
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting || !deletePassword}
                className="btn-danger btn-sm flex-1 flex items-center justify-center gap-2">
                {deleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Toggle row component ──────────────────────────────────────────────────────
function ToggleRow({ label, prefs, setPref, k, defaultOn = false }) {
  const value = prefs[k] !== undefined ? prefs[k] : defaultOn;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-white/65">{label}</span>
      <button
        onClick={() => setPref(k, !value)}
        className="relative rounded-full transition-colors flex-shrink-0"
        style={{
          background: value ? '#2563eb' : 'rgba(255,255,255,0.12)',
          height: 22, width: 40,
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 bg-white rounded-full transition-transform"
          style={{
            width: 18, height: 18,
            transform: value ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}
