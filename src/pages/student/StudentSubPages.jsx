import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSubjects, getTeacherAssignments, getAnnouncements,
  getStudentHierarchySubjects,
} from '../../firebase/firestore';
import { formatDateTime, semesterToClass } from '../../utils/helpers';
import { BookOpen, Megaphone, User, Hash } from 'lucide-react';

export function StudentClassesPage() {
  const { profile, deptId } = useAuth();
  const [subjects,    setSubjects]    = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!deptId || !profile) { setLoading(false); return; }
    // PERF: fire both fetches in parallel; stable dep on uid+class prevents
    // unnecessary re-fetches when unrelated profile fields change
    Promise.all([
      getStudentHierarchySubjects(deptId, profile),
      getTeacherAssignments(deptId),
    ]).then(([s, a]) => {
      setSubjects(s);
      const studentClass = profile.studentClass || (profile.semester ? semesterToClass(profile.semester) : null);
      const relevant = a.filter(x => {
        if (profile.levelId && profile.classId && profile.semesterId) {
          return x.levelId === profile.levelId &&
                 x.classId === profile.classId &&
                 String(x.semesterId) === String(profile.semesterId);
        }
        if (studentClass && x.semester) {
          const assignClass = semesterToClass(x.semester);
          if (assignClass !== studentClass) return false;
        }
        return (!profile.program || x.program === profile.program);
      });
      setAssignments(relevant);
    }).finally(() => setLoading(false));
    // Stable deps: only re-fetch when dept, uid, or class changes
  }, [deptId, profile?.uid, profile?.studentClass, profile?.semester]);

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">My Classes</h1>
          <p className="page-sub">{profile?.program} · {profile?.studentClass || (profile?.semester ? `Sem ${profile.semester}` : '')}</p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i=><div key={i} className="h-28 shimmer rounded-2xl"/>)}
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No subjects assigned for your program & semester yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {subjects.map(sub => {
              const assign = assignments.find(a => a.subjectId === sub.id);
              return (
                <div key={sub.id} className="card p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm" style={{fontFamily:'Syne,sans-serif'}}>{sub.name}</div>
                      <div className="text-xs text-white/40">{sub.code && <span className="font-mono mr-2">{sub.code}</span>}{sub.creditHours && `${sub.creditHours} credit hrs`}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-white/35">
                      <User size={11} />
                      {assign ? assign.teacherName : <span className="italic text-white/20">Not assigned yet</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <span className="badge badge-blue text-[10px]">{sub.program}</span>
                      <span className="badge badge-gray text-[10px]">Sem {sub.semester}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

export function StudentAnnouncementsPage() {
  const { deptId } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deptId) { setLoading(false); return; }
    getAnnouncements(deptId).then(setAnnouncements).finally(() => setLoading(false));
  }, [deptId]);

  return (
    <Layout>
      <div className="page-in space-y-6">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">Notices from your department</p>
        </div>

        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-24 shimmer rounded-2xl"/>)}</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Megaphone size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>{a.title}</h3>
                  <span className="text-[10px] text-white/25 flex-shrink-0 mt-0.5">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="text-sm text-white/55 leading-relaxed">{a.message}</p>
                <div className="mt-3 text-[11px] text-white/25">— {a.postedBy}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
