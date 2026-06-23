import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeStudentAttendance } from '../../firebase/firestore';
import { calcPct, pctColor, pctBadge, formatDate, formatTime } from '../../utils/helpers';
import { CheckCircle, XCircle, Clock, BarChart3, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function StudentAttendancePage() {
  const { profile, deptId } = useAuth();
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all'); // all | present | absent

  // PERF + REAL-TIME: live subscription — attendance appears the moment it is marked
  useEffect(() => {
    if (!deptId || !profile?.uid) { setLoading(false); return; }
    const unsub = subscribeStudentAttendance(
      deptId, profile.uid, profile.studentClass || null,
      (r) => { setRecords(r); setLoading(false); }
    );
    return () => unsub();
  }, [deptId, profile?.uid, profile?.studentClass]);

  const present = records.filter(r => r.status === 'present').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const late    = records.filter(r => r.status === 'late').length;
  const total   = records.length;
  const pct     = calcPct(present, total);

  const filtered = filter === 'all' ? records
    : records.filter(r => r.status === filter);

  const pieData = [
    { name:'Present', value:present, color:'#10b981' },
    { name:'Absent',  value:absent,  color:'#ef4444' },
    { name:'Late',    value:late,    color:'#f59e0b' },
  ].filter(d => d.value > 0);

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-sub">Complete attendance history</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label:'Overall',  value:`${pct}%`, icon:BarChart3,   color: pct>=75?'green':'red'  },
            { label:'Present',  value:present,   icon:CheckCircle, color:'green'  },
            { label:'Absent',   value:absent,    icon:XCircle,     color:'red'    },
            { label:'Late',     value:late,      icon:Clock,       color:'amber'  },
          ].map(({ label, value, icon: Icon, color }) => {
            const c = { green:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', red:'text-red-400 bg-red-500/10 border-red-500/20', amber:'text-amber-400 bg-amber-500/10 border-amber-500/20' }[color];
            return (
              <div key={label} className="stat-card border border-white/[0.06]">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${c}`}>
                  <Icon size={16} />
                </div>
                <div className={`text-2xl font-bold num ${c.split(' ')[0]}`} style={{fontFamily:'Syne,sans-serif'}}>{value}</div>
                <div className="text-xs text-white/35">{label}</div>
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Pie chart */}
          {total > 0 && (
            <div className="card p-5">
              <h3 className="section-title mb-4">Breakdown</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#070d1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:12}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{backgroundColor:d.color}} />
                      <span className="text-white/50">{d.name}</span>
                    </div>
                    <span className="font-semibold text-white/70">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Records table */}
          <div className={`card overflow-hidden ${total > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <h3 className="section-title">Session History</h3>
              <div className="flex gap-1">
                {['all','present','absent'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${filter===f?'bg-blue-600 text-white':'text-white/40 hover:text-white'}`}
                    style={{fontFamily:'Syne,sans-serif'}}>{f}</button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-10 shimmer rounded-lg"/>)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-white/30 text-sm">No records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Subject</th><th>Teacher</th><th>Date</th><th>Time</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={i}>
                        <td className="font-medium text-white">{r.session?.subjectName || '—'}</td>
                        <td className="text-white/45">{r.session?.teacherName || '—'}</td>
                        <td className="text-white/40 text-xs">{formatDate(r.session?.createdAt)}</td>
                        <td className="text-white/40 text-xs">{r.markedAt ? formatTime(r.markedAt) : '—'}</td>
                        <td>
                          <span className={`badge text-[10px] ${r.status==='present'?'badge-green':r.status==='late'?'badge-amber':'badge-red'}`}>
                            {(r.status||'absent').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
