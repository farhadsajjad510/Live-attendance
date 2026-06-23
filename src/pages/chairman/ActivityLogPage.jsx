import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { Avatar } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getActivityLog, getTeacherPerformance } from '../../firebase/firestore';
import { formatDateTime } from '../../utils/helpers';
import { ClipboardList, Search, UserCheck, UserX, UserCog, BarChart3, Calendar, TrendingUp, Activity } from 'lucide-react';

const TYPE_CONFIG = {
  approval:           { icon: UserCheck, color: 'text-emerald-400', badge: 'badge-green', label: 'Approval'   },
  rejection:          { icon: UserX,     color: 'text-red-400',     badge: 'badge-red',   label: 'Rejection'  },
  teacher_assignment: { icon: UserCog,   color: 'text-blue-400',    badge: 'badge-blue',  label: 'Assignment' },
  promotion:          { icon: TrendingUp,color: 'text-cyan-400',    badge: 'badge-cyan',  label: 'Promotion'  },
  graduation:         { icon: TrendingUp,color: 'text-amber-400',   badge: 'badge-amber', label: 'Graduation' },
};

export default function ActivityLogPage() {
  const { deptId } = useAuth();
  const [logs,        setLogs]        = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [perfLoading, setPerfLoading] = useState(true);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');

  useEffect(() => {
    if (!deptId) return;
    getActivityLog(deptId).then(setLogs).finally(() => setLoading(false));
    getTeacherPerformance(deptId).then(setPerformance).finally(() => setPerfLoading(false));
  }, [deptId]);

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.details?.toLowerCase().includes(search.toLowerCase()) || l.actorName?.toLowerCase().includes(search.toLowerCase());
    const matchType   = !typeFilter || l.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">Activity Log &amp; Teacher Performance</h1>
          <p className="page-sub">Track administrative actions and teaching statistics</p>
        </div>

        {/* Teacher Performance */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <BarChart3 size={15} className="text-blue-400" />
            <h3 className="section-title">Teacher Performance Analytics</h3>
          </div>
          {perfLoading ? (
            <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
          ) : performance.length === 0 ? (
            <div className="p-10 text-center text-white/30 text-sm">No teachers in this department yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Teacher</th><th>Total Sessions</th><th>This Month</th><th>Avg. Present</th></tr></thead>
                <tbody>
                  {performance.sort((a,b) => b.totalSessions - a.totalSessions).map(p => (
                    <tr key={p.teacher.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={p.teacher.displayName} size={7} />
                          <span className="font-medium text-white">{p.teacher.displayName}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-blue text-[10px]"><Activity size={10} className="inline mr-1" />{p.totalSessions}</span></td>
                      <td><span className="badge badge-cyan text-[10px]"><Calendar size={10} className="inline mr-1" />{p.sessionsThisMonth}</span></td>
                      <td className="text-white/60 text-sm">{p.avgPresent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} className="text-purple-400" />
              <h3 className="section-title">Activity Log</h3>
            </div>
            <div className="flex gap-2 sm:ml-auto flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input className="input pl-8 text-xs py-1.5 w-48" placeholder="Search…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="input text-xs py-1.5 w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                <option value="approval">Approvals</option>
                <option value="rejection">Rejections</option>
                <option value="teacher_assignment">Assignments</option>
                <option value="promotion">Promotions</option>
                <option value="graduation">Graduations</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-5 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 shimmer rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-white/30 text-sm">No activity recorded yet</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map(log => {
                const cfg = TYPE_CONFIG[log.type] || { icon: Activity, color: 'text-white/40', badge: 'badge-gray', label: log.type };
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`p-1.5 rounded-lg bg-white/[0.04] ${cfg.color}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/75 truncate">{log.details}</p>
                      <p className="text-xs text-white/30">by {log.actorName} · {formatDateTime(log.createdAt)}</p>
                    </div>
                    <span className={`badge text-[10px] ${cfg.badge} flex-shrink-0`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
