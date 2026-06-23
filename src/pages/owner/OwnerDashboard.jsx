import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { StatsCard } from '../../components/ui/index.jsx';
import {
  getPlatformStats, getAllDepartments, getAllUsers,
  getPlatformAttendanceStats,
  ownerSuspendUser, ownerActivateUser, ownerForceDeleteUser, ownerForceDeleteDepartment,
} from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, roleLabel, roleBadge } from '../../utils/helpers';
import {
  Building2, Users, GraduationCap, UserCheck,
  Activity, Shield, BarChart3, QrCode, TrendingUp,
  UserX, UserCheck2, Trash2, AlertTriangle, ShieldAlert, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';

const TT = ({ active, payload, label }) => active && payload?.length ? (
  <div className="glass-dark border border-white/10 p-3 rounded-xl text-xs">
    <p className="text-white/60 mb-1.5 font-semibold">{label}</p>
    {payload.map(p => (
      <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1.5">
        {p.name}: <span className="font-bold">{p.value}</span>
      </p>
    ))}
  </div>
) : null;

export default function OwnerDashboard() {
  const { profile } = useAuth();
  const [stats,      setStats]      = useState({});
  const [attStats,   setAttStats]   = useState({});
  const [departments,setDepartments]= useState([]);
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [acting,     setActing]     = useState(null); // uid being acted on
  const [userSearch, setUserSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');

  useEffect(() => {
    async function load() {
      // Load stats first (fast, no large reads) — show skeleton immediately
      setLoading(true);
      try {
        const [s, a] = await Promise.all([
          getPlatformStats(),
          getPlatformAttendanceStats(),
        ]);
        setStats(s); setAttStats(a);
      } catch (e) { /* stats non-critical */ }
      finally { setLoading(false); }

      // Load dept + user lists separately — these can be large
      // Cap to 50 departments and 200 users for dashboard display
      try {
        const d = await getAllDepartments();
        setDepartments(d.slice(0, 50));
      } catch {}
      try {
        const u = await getAllUsers(200);
        setUsers(u);
      } catch {}
    }
    load();
  }, []);

  async function handleSuspend(uid, name) {
    if (!window.confirm(`Suspend ${name}? They will lose access immediately.`)) return;
    setActing(uid);
    try {
      await ownerSuspendUser(uid, profile?.displayName);
      setUsers(us => us.map(u => u.id === uid ? { ...u, active: false, status: 'suspended' } : u));
      toast.success(`${name} suspended`);
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  }

  async function handleActivate(uid, name) {
    setActing(uid);
    try {
      await ownerActivateUser(uid, profile?.displayName);
      setUsers(us => us.map(u => u.id === uid ? { ...u, active: true, status: 'approved' } : u));
      toast.success(`${name} activated`);
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  }

  async function handleForceDelete(uid, name) {
    if (!window.confirm(`PERMANENTLY DELETE ${name}? This cannot be undone.`)) return;
    if (!window.confirm(`Are you absolutely sure? Type YES in the next prompt.`)) return;
    setActing(uid);
    try {
      await ownerForceDeleteUser(uid, profile?.displayName);
      setUsers(us => us.filter(u => u.id !== uid));
      toast.success(`${name} deleted from Firestore`);
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  }

  async function handleForceDeleteDept(deptId, name) {
    if (!window.confirm(`Force remove department "${name}"? All members will be unlinked.`)) return;
    setActing(deptId);
    try {
      await ownerForceDeleteDepartment(deptId, profile?.displayName);
      setDepartments(ds => ds.filter(d => d.id !== deptId));
      toast.success(`Department "${name}" removed`);
    } catch (e) { toast.error(e.message); }
    finally { setActing(null); }
  }

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredDepts = departments.filter(d =>
    !deptSearch || d.name?.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const roleData = [
    { name: 'Chairmen', value: stats.totalChairmen || 0, color: '#06b6d4' },
    { name: 'Teachers',  value: stats.totalTeachers  || 0, color: '#3b82f6' },
    { name: 'Students',  value: stats.totalStudents  || 0, color: '#10b981' },
  ].filter(d => d.value > 0);

  const deptChart = departments.slice(0, 8).map(d => ({
    name:     (d.name || '').slice(0, 10),
    Students: d.totalStudents || 0,
    Teachers: d.totalTeachers || 0,
  }));

  const overallAttPct = attStats.totalStudentsMarked > 0
    ? Math.round((attStats.totalPresent / attStats.totalStudentsMarked) * 100)
    : 0;

  return (
    <Layout>
      <div className="page-in space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-purple-500/12 border border-purple-500/20">
            <Shield size={22} className="text-purple-400" />
          </div>
          <div>
            <h1 className="page-title">Platform Overview</h1>
            <p className="page-sub">Live Attendance · FarhadAIStudio · Owner Dashboard</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/40">Live</span>
            <span className="badge badge-purple ml-2">Platform Owner</span>
          </div>
        </div>

        {/* ── Stats row 1 ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon={Building2}     label="Departments"    value={stats.totalDepartments || 0} color="cyan"   />
          <StatsCard icon={Users}         label="Total Users"    value={stats.totalUsers        || 0} color="blue"   />
          <StatsCard icon={UserCheck}     label="Teachers"       value={stats.totalTeachers     || 0} color="purple" />
          <StatsCard icon={GraduationCap} label="Students"       value={stats.totalStudents     || 0} color="green"  />
        </div>

        {/* ── Stats row 2 ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon={QrCode}      label="Total Sessions"      value={attStats.totalSessions      || 0} color="amber"  />
          <StatsCard icon={TrendingUp}  label="Overall Attendance"  value={`${overallAttPct}%`}             color="green"  />
          <StatsCard icon={Activity}    label="New Today"           value={stats.newToday              || 0} color="cyan"   />
          <StatsCard icon={BarChart3}   label="Present Records"     value={attStats.totalPresent       || 0} color="blue"   />
        </div>

        {/* ── Charts ── */}
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card p-5">
            <h3 className="section-title mb-4">Departments — Students & Teachers</h3>
            {deptChart.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-white/25 text-sm">No departments yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptChart}>
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

          <div className="card p-5">
            <h3 className="section-title mb-4">User Distribution</h3>
            {roleData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-white/25 text-sm">No users yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {roleData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#070d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── System Health ── */}
        <div className="card p-5">
          <h3 className="section-title mb-4">System Health</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Firebase Auth',    status: 'Operational', color: 'badge-green'  },
              { label: 'Firestore DB',     status: 'Operational', color: 'badge-green'  },
              { label: 'QR Attendance',    status: 'Active',      color: 'badge-green'  },
              { label: 'GPS Verify',       status: 'Active',      color: 'badge-blue'   },
              { label: 'PDF Export',       status: 'Ready',       color: 'badge-green'  },
              { label: 'Excel Export',     status: 'Ready',       color: 'badge-green'  },
              { label: 'Role Isolation',   status: 'Enforced',    color: 'badge-purple' },
              { label: 'Real-time Sync',   status: 'Live',        color: 'badge-cyan'   },
            ].map(s => (
              <div key={s.label}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-white/55">{s.label}</span>
                <span className={`badge text-[10px] ${s.color}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Departments table ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <h3 className="section-title">All Departments ({departments.length})</h3>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-10 shimmer rounded-lg" />)}</div>
          ) : departments.length === 0 ? (
            <div className="p-10 text-center text-white/30 text-sm">No departments created yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Department</th><th>Institution</th><th>Chairman</th><th>Students</th><th>Teachers</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.id}>
                      <td><div className="font-semibold text-white">{d.name}</div></td>
                      <td className="text-white/50">{d.institution || '—'}</td>
                      <td className="text-white/60">{d.chairmanName || '—'}</td>
                      <td><span className="badge badge-green">{d.totalStudents || 0}</span></td>
                      <td><span className="badge badge-blue">{d.totalTeachers || 0}</span></td>
                      <td className="text-white/35 text-xs">{formatDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Recent users ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h3 className="section-title">Recent Registrations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map(u => (
                  <tr key={u.id}>
                    <td className="font-medium text-white">{u.displayName || '—'}</td>
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
                    <td className="text-white/35 text-xs">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ EMERGENCY CONTROLS ═══ */}
        <div className="card border-red-500/20 overflow-hidden"
          style={{background:'rgba(239,68,68,0.03)'}}>
          <div className="px-5 py-4 border-b border-red-500/15 flex items-center gap-2">
            <ShieldAlert size={15} className="text-red-400"/>
            <h3 className="section-title text-red-400/80">Emergency Controls</h3>
            <span className="text-xs text-white/25 ml-auto">Owner-only · Immediate effect</span>
          </div>

          {/* User Controls */}
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-sm font-semibold text-white/70">User Management</h4>
              <input className="input py-1 text-xs w-56 ml-auto"
                placeholder="Search by name or email…"
                value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredUsers.slice(0, 100).map(u => (
                    <tr key={u.id}>
                      <td className="font-medium text-white">{u.displayName || '—'}</td>
                      <td className="text-white/45 text-xs">{u.email}</td>
                      <td><span className={`badge text-[10px] ${roleBadge(u.role)}`}>{roleLabel(u.role)}</span></td>
                      <td>
                        <span className={`badge text-[10px] ${
                          u.status === 'approved' ? 'badge-green' :
                          u.status === 'suspended' ? 'badge-red' : 'badge-amber'
                        }`}>{u.status || 'pending'}</span>
                      </td>
                      <td>
                        {u.role !== 'owner' && (
                          <div className="flex gap-1.5">
                            {u.active !== false && u.status !== 'suspended' ? (
                              <button onClick={()=>handleSuspend(u.id, u.displayName)}
                                disabled={acting===u.id} className="btn-xs btn-danger flex items-center gap-1">
                                {acting===u.id ? <Loader2 size={10} className="animate-spin"/> : <UserX size={10}/>}
                                Suspend
                              </button>
                            ) : (
                              <button onClick={()=>handleActivate(u.id, u.displayName)}
                                disabled={acting===u.id} className="btn-xs btn-success flex items-center gap-1">
                                {acting===u.id ? <Loader2 size={10} className="animate-spin"/> : <UserCheck size={10}/>}
                                Activate
                              </button>
                            )}
                            <button onClick={()=>handleForceDelete(u.id, u.displayName)}
                              disabled={acting===u.id} className="btn-xs btn-danger flex items-center gap-1">
                              {acting===u.id ? <Loader2 size={10} className="animate-spin"/> : <Trash2 size={10}/>}
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Controls */}
          <div className="p-5 border-t border-red-500/10">
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-sm font-semibold text-white/70">Department Removal</h4>
              <input className="input py-1 text-xs w-48 ml-auto"
                placeholder="Search departments…"
                value={deptSearch} onChange={e => setDeptSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              {filteredDepts.filter(d => !d.forceDeleted).slice(0, 50).map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-white">{d.name}</span>
                    <span className="text-xs text-white/35 ml-2">{d.institution}</span>
                  </div>
                  <span className="text-xs text-white/30">{d.totalStudents||0} students</span>
                  <button onClick={()=>handleForceDeleteDept(d.id, d.name)}
                    disabled={acting===d.id} className="btn-xs btn-danger flex items-center gap-1">
                    {acting===d.id ? <Loader2 size={10} className="animate-spin"/> : <Trash2 size={10}/>}
                    Force Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
