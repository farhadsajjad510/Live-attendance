import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { Modal, ConfirmDialog, EmptyState, Avatar } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getDeptTeachers, getJoinRequests, approveJoinRequest, rejectJoinRequest, updateUserProfile } from '../../firebase/firestore';
import { formatDate, roleLabel } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { UserCheck, CheckCircle, XCircle, Clock, Search, Filter, Loader2, Phone, GraduationCap, Hash } from 'lucide-react';

export default function TeachersPage() {
  const { deptId } = useAuth();
  const [teachers,  setTeachers]  = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('approved'); // approved | pending
  const [delId,     setDelId]     = useState(null);

  async function load() {
    if (!deptId) return;
    const [te, req] = await Promise.all([
      getDeptTeachers(deptId),
      getJoinRequests(deptId, 'pending'),
    ]);
    setTeachers(te);
    setRequests(req.filter(r => r.role === 'teacher'));
    setLoading(false);
  }

  useEffect(() => { load(); }, [deptId]);

  async function approve(req) {
    try { await approveJoinRequest(deptId, req.id, req.userId, 'teacher'); toast.success('Teacher approved!'); load(); }
    catch (e) { toast.error(e.message); }
  }

  async function reject(req) {
    try { await rejectJoinRequest(deptId, req.id); toast.success('Request rejected'); load(); }
    catch (e) { toast.error(e.message); }
  }

  async function removeTeacher(uid) {
    try {
      await updateUserProfile(uid, { departmentId: null, departmentRole: null, status: 'removed' });
      toast.success('Teacher removed'); load();
    } catch (e) { toast.error(e.message); }
  }

  const filtered = teachers.filter(t =>
    t.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Teachers</h1>
            <p className="page-sub">{teachers.length} approved · {requests.length} pending</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
          {[['approved','Approved'], ['pending','Pending']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t ? 'bg-blue-600 text-white' : 'text-white/45 hover:text-white'}`}
              style={{fontFamily:'Syne,sans-serif'}}>
              {l} {t==='pending' && requests.length > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{requests.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'approved' && (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input className="input pl-9 text-sm" placeholder="Search teachers…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-5 space-y-3">{[1,2,3].map(i=><div key={i} className="h-14 shimmer rounded-xl"/>)}</div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={UserCheck} title="No teachers yet" desc="Approve teacher requests from the Pending tab." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Teacher</th><th>Employee ID</th><th>Qualification</th><th>Phone</th><th>Joined</th><th></th></tr></thead>
                    <tbody>
                      {filtered.map(t => (
                        <tr key={t.id}>
                          <td><div className="flex items-center gap-2.5"><Avatar name={t.displayName} size={8}/><div><div className="font-medium text-white">{t.displayName}</div><div className="text-xs text-white/35">{t.email}</div></div></div></td>
                          <td><span className="font-mono text-xs text-blue-300 px-2 py-0.5 rounded-md" style={{background:'rgba(59,130,246,0.1)'}}>{t.employeeId||'—'}</span></td>
                          <td className="text-white/50 text-xs">{t.qualification||'—'}</td>
                          <td className="text-white/50 text-xs">{t.phone||'—'}</td>
                          <td className="text-white/35 text-xs">{formatDate(t.approvedAt)}</td>
                          <td><button onClick={() => setDelId(t.id)} className="btn-icon p-1.5"><XCircle size={13} className="text-red-400/60"/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'pending' && (
          <div className="card overflow-hidden">
            {requests.length === 0 ? (
              <EmptyState icon={Clock} title="No pending requests" desc="When teachers register and join your department, requests appear here." />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {requests.map(req => (
                  <div key={req.id} className="flex items-center gap-4 p-4">
                    <Avatar name={req.displayName} size={10}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">{req.displayName}</div>
                      <div className="text-xs text-white/40 mt-0.5">{req.email}</div>
                      <div className="flex gap-3 mt-1 text-xs text-white/30">
                        {req.employeeId && <span><Hash size={9} className="inline"/> {req.employeeId}</span>}
                        {req.qualification && <span><GraduationCap size={9} className="inline"/> {req.qualification}</span>}
                        {req.phone && <span><Phone size={9} className="inline"/> {req.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => reject(req)} className="btn-danger btn-xs flex items-center gap-1"><XCircle size={11}/>Reject</button>
                      <button onClick={() => approve(req)} className="btn-success btn-xs flex items-center gap-1"><CheckCircle size={11}/>Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={() => removeTeacher(delId)}
          title="Remove Teacher" message="Remove this teacher from the department? They can re-apply later." danger />
      </div>
    </Layout>
  );
}
