import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { getAuditLogs } from '../../firebase/firestore';
import { formatDateTime } from '../../utils/helpers';
import { Shield, RefreshCw, Search } from 'lucide-react';

const ACTION_COLORS = {
  SUSPEND_USER:  'badge-amber',
  RESTORE_USER:  'badge-green',
  DELETE_USER:   'badge-red',
  CREATE_DEPT:   'badge-cyan',
  DELETE_DEPT:   'badge-red',
  APPROVE_USER:  'badge-green',
  REJECT_USER:   'badge-red',
};

export default function OwnerAuditPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(data);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l =>
    !search ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.actorName?.toLowerCase().includes(search.toLowerCase()) ||
    l.target?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-purple-500/12 border border-purple-500/20">
              <Shield size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="page-title">Audit Logs</h1>
              <p className="page-sub">All owner actions are recorded here</p>
            </div>
          </div>
          <button onClick={load} className="btn-secondary btn-sm flex items-center gap-2">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search by action, actor, or target…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <span className="section-title">{filtered.length} log entries</span>
            <span className="badge badge-purple text-[10px]">Owner Only</span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 shimmer rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Shield size={28} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No audit logs yet.</p>
              <p className="text-white/20 text-xs mt-1">Actions like suspending or deleting users will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Performed By</th>
                    <th>Target</th>
                    <th>Details</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => (
                    <tr key={log.id}>
                      <td>
                        <span className={`badge text-[10px] ${ACTION_COLORS[log.action] || 'badge-gray'}`}>
                          {log.action || '—'}
                        </span>
                      </td>
                      <td className="font-medium text-white">{log.actorName || '—'}</td>
                      <td className="text-white/50 text-xs font-mono">{log.target || '—'}</td>
                      <td className="text-white/40 text-xs">{log.details || '—'}</td>
                      <td className="text-white/30 text-xs whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="p-4 rounded-xl text-xs text-white/40 leading-relaxed"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <span className="text-purple-400 font-semibold">Audit Trail:</span> Every owner action (suspend, restore,
          delete user) is automatically recorded in the <code className="text-purple-300">auditLogs</code> Firestore
          collection with the actor's name, target UID, and timestamp.
        </div>
      </div>
    </Layout>
  );
}
