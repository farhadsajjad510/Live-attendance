// OwnerDeletionPage — Owner reviews and approves/rejects account deletion requests.

import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getDeletionRequests, approveDeletion, rejectDeletion } from '../../firebase/firestore';
import { ConfirmDialog, Avatar } from '../../components/ui/index.jsx';
import { formatDateTime, roleLabel } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Trash2, CheckCircle, XCircle, Loader2, ShieldAlert } from 'lucide-react';

export default function OwnerDeletionPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [confirm,  setConfirm]  = useState(null); // { req, action: 'approve'|'reject' }
  const [acting,   setActing]   = useState(null);

  async function load() {
    setLoading(true);
    try { setRequests(await getDeletionRequests()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleAction() {
    if (!confirm) return;
    const { req, action } = confirm;
    setActing(req.uid);
    try {
      if (action === 'approve') {
        await approveDeletion(req.uid, profile?.displayName);
        toast.success(`${req.displayName}'s account has been deactivated`);
      } else {
        await rejectDeletion(req.uid, profile?.displayName);
        toast.success('Request rejected — account remains active');
      }
      setConfirm(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  }

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div>
          <h1 className="page-title">Account Deletion Requests</h1>
          <p className="page-sub">Review and approve or reject user account deletion requests</p>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)}</div>
        ) : requests.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle size={28} className="text-emerald-400/40 mx-auto mb-3" />
            <p className="text-white/35 text-sm">No pending deletion requests</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <ShieldAlert size={15} className="text-red-400" />
              <h3 className="section-title">Pending Requests</h3>
              <span className="badge badge-red text-[10px] ml-auto">{requests.length}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {requests.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-4">
                  <Avatar name={req.displayName} size={9} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{req.displayName}</div>
                    <div className="text-xs text-white/40">{req.email} · {roleLabel(req.role)}</div>
                    {req.reason && <div className="text-xs text-white/30 mt-0.5 italic">"{req.reason}"</div>}
                    <div className="text-xs text-white/25 mt-0.5">Submitted: {formatDateTime(req.submittedAt)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={acting === req.uid}
                      onClick={() => setConfirm({ req, action: 'reject' })}
                      className="btn-secondary btn-xs flex items-center gap-1"
                    >
                      {acting === req.uid ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                      Reject
                    </button>
                    <button
                      disabled={acting === req.uid}
                      onClick={() => setConfirm({ req, action: 'approve' })}
                      className="btn-danger btn-xs flex items-center gap-1"
                    >
                      {acting === req.uid ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={handleAction}
          title={confirm?.action === 'approve' ? 'Approve Account Deletion?' : 'Reject Deletion Request?'}
          message={confirm?.action === 'approve'
            ? `${confirm?.req?.displayName}'s account will be deactivated immediately. Their Firestore data is retained for audit purposes. Firebase Authentication deletion requires manual action in Firebase Console.`
            : `${confirm?.req?.displayName}'s account will remain fully active. The deletion request will be closed.`}
          danger={confirm?.action === 'approve'}
        />
      </div>
    </Layout>
  );
}
