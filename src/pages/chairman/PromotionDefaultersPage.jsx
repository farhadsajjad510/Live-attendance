import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { ConfirmDialog } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getDeptStudents, getDeptDefaulters, promoteClass, getGraduates } from '../../firebase/firestore';
import { CLASS_OPTIONS, classLabel, attendanceBadge, attendanceLabel } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { GraduationCap, ArrowRight, AlertTriangle, Loader2, TrendingUp, Archive, ChevronRight } from 'lucide-react';

export default function PromotionDefaultersPage() {
  const { deptId, profile } = useAuth();
  const [students,      setStudents]     = useState([]);
  const [defaulters,    setDefaulters]   = useState([]);
  const [graduates,     setGraduates]    = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [defLoading,    setDefLoading]   = useState(true);
  const [promoting,     setPromoting]    = useState(null);
  const [confirmClass,  setConfirmClass] = useState(null);

  async function load() {
    if (!deptId) return;
    setLoading(true);
    try {
      const [st, grads] = await Promise.all([getDeptStudents(deptId), getGraduates(deptId)]);
      setStudents(st); setGraduates(grads);
    } finally { setLoading(false); }
  }

  async function loadDefaulters() {
    if (!deptId) return;
    setDefLoading(true);
    try { setDefaulters(await getDeptDefaulters(deptId, 75)); }
    catch { toast.error('Failed to load defaulters'); }
    finally { setDefLoading(false); }
  }

  useEffect(() => { load(); loadDefaulters(); }, [deptId]);

  const classCounts = CLASS_OPTIONS.reduce((acc, c) => {
    acc[c] = students.filter(s => (s.studentClass || 'BS1') === c).length;
    return acc;
  }, {});

  async function handlePromote(cls) {
    setPromoting(cls);
    try {
      const { count, toClass } = await promoteClass(deptId, cls, profile?.displayName);
      toast.success(toClass === 'Graduated'
        ? `${count} student(s) graduated and moved to archive!`
        : `${count} student(s) promoted to ${classLabel(toClass)}!`);
      setConfirmClass(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setPromoting(null); }
  }

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">Promotions &amp; Attendance Alerts</h1>
          <p className="page-sub">Promote year classes and monitor attendance compliance</p>
        </div>

        {/* Promote Classes */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={15} className="text-emerald-400" />
            <h3 className="section-title">Promote Classes</h3>
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-28 shimmer rounded-xl" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CLASS_OPTIONS.map((cls, idx) => {
                const nextCls = CLASS_OPTIONS[idx + 1] || 'Graduated';
                const isLast  = cls === 'BS4';
                const count   = classCounts[cls] || 0;
                return (
                  <div key={cls} className="p-4 rounded-xl border border-white/[0.08]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm" style={{ fontFamily: 'Syne,sans-serif' }}>
                        {classLabel(cls)}
                      </span>
                      <span className="badge badge-blue text-[10px]">{count}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/35 mb-3">
                      {isLast ? <Archive size={11} className="text-amber-400" /> : <ArrowRight size={11} />}
                      <span>{isLast ? 'Graduate Archive' : classLabel(nextCls)}</span>
                    </div>
                    <button
                      onClick={() => setConfirmClass(cls)}
                      disabled={count === 0 || promoting === cls}
                      className={`btn-sm w-full flex items-center justify-center gap-1.5 ${isLast ? 'btn-danger' : 'btn-secondary'}`}>
                      {promoting === cls ? <Loader2 size={12} className="animate-spin" /> : isLast ? <Archive size={12} /> : <ChevronRight size={12} />}
                      {isLast ? 'Graduate' : 'Promote'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {graduates.length > 0 && (
            <div className="mt-4 p-3 rounded-xl text-xs text-amber-300/70 flex items-center gap-2"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <Archive size={12} className="flex-shrink-0" />
              {graduates.length} graduated students in archive — records permanently preserved
            </div>
          )}
        </div>

        {/* Attendance Defaulters */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400" />
            <h3 className="section-title">Attendance Defaulters</h3>
            <span className="text-xs text-white/30 ml-auto">Below 75% attendance</span>
          </div>
          {defLoading ? (
            <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
          ) : defaulters.length === 0 ? (
            <div className="p-10 text-center">
              <TrendingUp size={26} className="text-emerald-400/40 mx-auto mb-2" />
              <p className="text-white/35 text-sm">No defaulters — all students above 75%!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Student</th><th>Roll No</th><th>Class</th><th>Present / Total</th><th>%</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {defaulters.map(d => (
                    <tr key={d.student.id}>
                      <td className="font-medium text-white">{d.student.displayName}</td>
                      <td className="font-mono text-xs text-white/50">{d.student.rollNumber || '—'}</td>
                      <td><span className="badge badge-blue text-[10px]">{classLabel(d.student.studentClass || 'BS1')}</span></td>
                      <td className="text-white/50 text-sm">{d.present} / {d.total}</td>
                      <td className="font-bold text-sm" style={{ color: d.level === 'danger' ? '#f87171' : '#fbbf24' }}>{d.pct}%</td>
                      <td><span className={`badge text-[10px] ${attendanceBadge(d.pct)}`}>{attendanceLabel(d.pct)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!confirmClass}
          onClose={() => setConfirmClass(null)}
          onConfirm={() => handlePromote(confirmClass)}
          title={confirmClass === 'BS4' ? 'Graduate BS4 Students?' : `Promote ${classLabel(confirmClass)}?`}
          message={confirmClass === 'BS4'
            ? `All ${classCounts['BS4'] || 0} BS-IV students will be archived as graduated. Records are preserved permanently.`
            : `All ${classCounts[confirmClass] || 0} students in ${classLabel(confirmClass)} will be promoted to ${classLabel(CLASS_OPTIONS[CLASS_OPTIONS.indexOf(confirmClass)+1])}.`}
          danger={confirmClass === 'BS4'}
        />
      </div>
    </Layout>
  );
}
