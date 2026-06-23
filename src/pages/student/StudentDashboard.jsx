import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { StatsCard, EmptyState } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeStudentAttendance, getAnnouncements, subscribeAnnouncements } from '../../firebase/firestore';
import { formatDate, formatTime, calcPct, pctBadge, pctColor } from '../../utils/helpers';
import { TrendingUp, CheckCircle, XCircle, BookOpen, QrCode, Bell, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentDashboard() {
  const { profile, deptId } = useAuth();
  const [records,       setRecords]       = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);

  // PERF + REAL-TIME: subscribeStudentAttendance fires instantly when CR/teacher marks
  // the student — no polling, no page refresh needed. Uses collectionGroup onSnapshot.
  useEffect(() => {
    if (!deptId || !profile?.uid) return;
    const unsub = subscribeStudentAttendance(
      deptId, profile.uid, profile.studentClass || null,
      (r) => { setRecords(r); setLoading(false); }
    );
    return () => unsub();
  }, [deptId, profile?.uid, profile?.studentClass]);

  useEffect(() => {
    if (!deptId || !profile) return;
    getAnnouncements(deptId).then(setAnnouncements);
  }, [deptId]);

  useEffect(() => {
    if (!deptId) return;
    const unsub = subscribeAnnouncements(deptId, setAnnouncements);
    return () => unsub();
  }, [deptId]);

  const present = records.filter(r => r.status === 'present').length;
  const late    = records.filter(r => r.status === 'late').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const total   = records.length;
  const pct     = calcPct(present + late, total);

  const pieData = [
    { name:'Present', value:present, color:'#10b981' },
    { name:'Late',    value:late,    color:'#f59e0b' },
    { name:'Absent',  value:absent,  color:'#ef4444' },
  ].filter(d => d.value > 0);

  const firstName = profile?.displayName?.split(' ')[0] || 'Student';

  if (!deptId && !loading) return (
    <Layout>
      <div className="page-in flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center mb-4">
          <Clock size={24} className="text-amber-400"/>
        </div>
        <h2 className="page-title mb-2">Awaiting Approval</h2>
        <p className="text-white/40 text-sm max-w-xs mb-4">Your join request is pending. The Chairman will approve you shortly.</p>
        <Link to="/join" className="btn-primary btn-sm">Scan Department QR</Link>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">Hi, {firstName} 👋</h1>
          <p className="page-sub">{profile?.program} · {profile?.studentClass || (profile?.semester ? `Sem ${profile.semester}` : '')} · Roll: {profile?.rollNumber}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon={TrendingUp}  label="Overall Attendance" value={`${pct}%`}  color={pct>=75?'green':pct>=60?'amber':'red'}/>
          <StatsCard icon={CheckCircle} label="Present"            value={present}    color="green"/>
          <StatsCard icon={XCircle}     label="Absent"             value={absent}     color="red"/>
          <StatsCard icon={Clock}       label="Total Classes"      value={total}      color="blue"/>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Pie chart */}
          <div className="card p-5">
            <h3 className="section-title mb-4">Attendance Breakdown</h3>
            {total === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/25">
                <BookOpen size={28} className="mb-2 opacity-30"/>
                <p className="text-sm">No attendance records yet</p>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                      {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#070d1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {pieData.map(d=>(
                    <div key={d.name} className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:d.color}}/>
                      <div>
                        <div className="text-sm font-semibold text-white" style={{fontFamily:'Syne,sans-serif'}}>{d.value}</div>
                        <div className="text-xs text-white/40">{d.name}</div>
                      </div>
                    </div>
                  ))}
                  <div className={`text-2xl font-bold num mt-2 ${pctColor(pct)}`} style={{fontFamily:'Syne,sans-serif'}}>{pct}%</div>
                </div>
              </div>
            )}
          </div>

          {/* Recent records */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex justify-between">
              <h3 className="section-title">Recent Attendance</h3>
              <Link to="/student/attendance" className="text-xs text-blue-400">View all</Link>
            </div>
            {records.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No records yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {records.slice(0,6).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status==='present'?'bg-emerald-400':r.status==='late'?'bg-amber-400':'bg-red-400'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{r.session?.subjectName||'Class'}</div>
                      <div className="text-xs text-white/30">{formatDate(r.session?.createdAt)}</div>
                    </div>
                    <span className={`badge text-[10px] ${r.status==='present'?'badge-green':r.status==='late'?'badge-amber':'badge-red'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scan QR banner */}
        <div className="card border-blue-500/20 p-5 flex items-center gap-4" style={{borderColor:'rgba(59,130,246,0.2)'}}>
          <div className="p-3 rounded-xl bg-blue-500/12 border border-blue-500/20">
            <QrCode size={22} className="text-blue-400"/>
          </div>
          <div className="flex-1">
            <div className="font-bold text-white text-sm" style={{fontFamily:'Syne,sans-serif'}}>Mark Your Attendance</div>
            <div className="text-xs text-white/40 mt-0.5">When your teacher starts a session, scan the QR code shown on their screen.</div>
          </div>
          <Link to="/student/scan" className="btn-primary btn-sm flex items-center gap-1.5">
            <QrCode size={13}/> Scan QR
          </Link>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <Bell size={14} className="text-blue-400"/>
              <h3 className="section-title">Announcements</h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {announcements.slice(0,3).map(a=>(
                <div key={a.id} className="p-4">
                  <div className="font-semibold text-white text-sm">{a.title}</div>
                  <div className="text-xs text-white/50 mt-1">{a.message}</div>
                  <div className="text-[10px] text-white/25 mt-1.5">{a.postedBy} · {formatDate(a.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
