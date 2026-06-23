import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import {
  getAllUsers, getAllDepartments,
  suspendUser, restoreUser, deleteUserRecord,
  logAuditEvent,
} from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, roleLabel, roleBadge } from '../../utils/helpers';
import { Users, Search, BarChart3, Ban, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ui/index.jsx';

const TT = ({ active, payload, label }) => active && payload?.length ? (
  <div className="glass-dark border border-white/10 p-3 rounded-xl text-xs">
    <p className="text-white/60 mb-1">{label}</p>
    {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>)}
  </div>
) : null;

// ── Owner Users Page ──────────────────────────────────────────────────────────
export function OwnerUsersPage() {
  const { profile } = useAuth();
  const [users,    setUsers]   = useState([]);
  const [search,   setSearch]  = useState('');
  const [filter,   setFilter]  = useState('all');
  const [loading,  setLoading] = useState(true);
  const [actionId, setActionId]= useState(null);
  const [actionType, setActionType] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { load(); }, []);

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const u = await getAllUsers(PAGE_SIZE);
      setUsers(u);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function openConfirm(id, type) {
    setActionId(id); setActionType(type); setConfirmOpen(true);
  }

  async function handleAction() {
    if (!actionId || !actionType) return;
    try {
      if (actionType === 'suspend') {
        await suspendUser(actionId);
        await logAuditEvent(profile.uid, profile.displayName, 'SUSPEND_USER', actionId);
        toast.success('User suspended');
      } else if (actionType === 'restore') {
        await restoreUser(actionId);
        await logAuditEvent(profile.uid, profile.displayName, 'RESTORE_USER', actionId);
        toast.success('User restored');
      } else if (actionType === 'delete') {
        await deleteUserRecord(actionId);
        await logAuditEvent(profile.uid, profile.displayName, 'DELETE_USER', actionId);
        toast.success('User record deleted');
      }
      load();
    } catch (e) { toast.error(e.message); }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filter === 'all' || u.role === filter;
    return matchSearch && matchRole;
  });

  const actionLabels = {
    suspend: 'Suspend User',
    restore: 'Restore User',
    delete:  'Delete User Record',
  };
  const actionMessages = {
    suspend: 'Suspend this user? They will be unable to access the platform.',
    restore: 'Restore this user? Their access will be reinstated.',
    delete:  'Permanently delete this user record from Firestore? This cannot be undone.',
  };

  return (
    <Layout>
      <div className="page-in space-y-6">
        <h1 className="page-title">User Management</h1>
        <p className="page-sub">{users.length} registered accounts</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input className="input pl-9 text-sm" placeholder="Search by name or email…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="chairman">Chairman</option>
            <option value="teacher">Teacher</option>
            <option value="cr">CR</option>
            <option value="student">Student</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <span className="section-title">{filtered.length} users</span>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-10 shimmer rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Department</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {!u.active && <span className="badge badge-red text-[9px]">Suspended</span>}
                          <span className="font-semibold text-white">{u.displayName || '—'}</span>
                        </div>
                      </td>
                      <td className="text-white/45 text-xs">{u.email}</td>
                      <td><span className={`badge text-[10px] ${roleBadge(u.role)}`}>{roleLabel(u.role)}</span></td>
                      <td>
                        <span className={`badge text-[10px] ${
                          u.status === 'approved' ? 'badge-green' :
                          u.status === 'rejected' ? 'badge-red' : 'badge-amber'
                        }`}>
                          {u.status || 'pending'}
                        </span>
                      </td>
                      <td className="text-white/40 text-xs">{u.departmentName || '—'}</td>
                      <td className="text-white/30 text-xs">{formatDate(u.createdAt)}</td>
                      <td>
                        {/* Don't allow actions on other owner accounts */}
                        {u.role !== 'owner' && (
                          <div className="flex items-center gap-1">
                            {u.active !== false ? (
                              <button onClick={() => openConfirm(u.id, 'suspend')}
                                className="btn-icon p-1.5" title="Suspend">
                                <Ban size={12} className="text-amber-400/70" />
                              </button>
                            ) : (
                              <button onClick={() => openConfirm(u.id, 'restore')}
                                className="btn-icon p-1.5" title="Restore">
                                <RotateCcw size={12} className="text-emerald-400/70" />
                              </button>
                            )}
                            <button onClick={() => openConfirm(u.id, 'delete')}
                              className="btn-icon p-1.5" title="Delete">
                              <Trash2 size={12} className="text-red-400/60" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleAction}
          title={actionLabels[actionType] || 'Confirm'}
          message={actionMessages[actionType] || 'Are you sure?'}
          danger={actionType === 'delete' || actionType === 'suspend'}
        />
      </div>
    </Layout>
  );
}

// ── Owner Analytics Page ──────────────────────────────────────────────────────
export function OwnerAnalyticsPage() {
  const [depts,   setDepts]   = useState([]);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllDepartments(), getAllUsers()])
      .then(([d, u]) => { setDepts(d); setUsers(u); })
      .finally(() => setLoading(false));
  }, []);

  const roleBreakdown = ['chairman', 'teacher', 'cr', 'student'].map(r => ({
    name:  roleLabel(r),
    count: users.filter(u => u.role === r).length,
  }));

  const deptData = depts.slice(0, 10).map(d => ({
    name:     (d.name || '').slice(0, 10),
    Students: d.totalStudents || 0,
    Teachers: d.totalTeachers || 0,
  }));

  const statusBreakdown = ['approved', 'pending', 'rejected'].map(s => ({
    name:  s.charAt(0).toUpperCase() + s.slice(1),
    count: users.filter(u => u.status === s).length,
  }));

  return (
    <Layout>
      <div className="page-in space-y-6">
        <h1 className="page-title">Platform Analytics</h1>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <h3 className="section-title mb-4">Users by Role</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={roleBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-4">Account Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5 lg:col-span-2">
            <h3 className="section-title mb-4">Departments — Students & Teachers</h3>
            {deptData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-white/25 text-sm">No departments</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                  <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip content={<TT />} />
                  <Bar dataKey="Students" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Teachers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
