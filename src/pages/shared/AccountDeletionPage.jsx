// AccountDeletionPage — any authenticated user can submit a deletion request
// Owner reviews and approves/rejects from the Owner Dashboard.

import { useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { submitDeletionRequest } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export default function AccountDeletionPage() {
  const { profile, logout } = useAuth();
  const [reason,   setReason]   = useState('');
  const [confirm,  setConfirm]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!confirm) { toast.error('Please confirm you understand this action'); return; }
    setSaving(true);
    try {
      await submitDeletionRequest(profile.uid, { ...profile, reason: reason.trim() });
      setDone(true);
      toast.success('Deletion request submitted. We will process it shortly.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit request');
    } finally { setSaving(false); }
  }

  if (done) {
    return (
      <Layout>
        <div className="page-in max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Request Submitted</h2>
          <p className="text-white/45 text-sm mb-6">
            Your account deletion request has been sent to the Platform Owner for review.
            You will be notified once it is processed.
          </p>
          <button onClick={logout} className="btn-ghost btn-sm">Sign Out</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-in max-w-md mx-auto space-y-6">
        <div>
          <h1 className="page-title">Delete Account</h1>
          <p className="page-sub">Request permanent deletion of your account and data</p>
        </div>

        <div className="p-4 rounded-xl flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-300/80">
            <p className="font-semibold mb-1">This action is permanent.</p>
            <p>Deleting your account will remove your profile, attendance history, and access to the platform. This cannot be undone.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="label">Reason for deletion (optional)</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Let us know why you're leaving…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 flex-shrink-0"
              checked={confirm}
              onChange={e => setConfirm(e.target.checked)}
            />
            <span className="text-sm text-white/60">
              I understand that deleting my account is permanent and all my data will be removed.
            </span>
          </label>

          <button
            type="submit"
            disabled={saving || !confirm}
            className="btn-danger w-full flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {saving ? 'Submitting Request…' : 'Submit Deletion Request'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
