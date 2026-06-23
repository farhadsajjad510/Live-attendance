import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { Modal, ConfirmDialog, EmptyState } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherAssignments, assignSubjectToTeacher, deleteAssignment, getDeptTeachers, getSubjects, getPrograms, logActivity } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { UserCog, Plus, Trash2, Loader2, BookOpen } from 'lucide-react';

export default function AssignmentsPage() {
  const { deptId, profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [subjects,    setSubjects]    = useState([]);
  const [programs,    setPrograms]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [addOpen,     setAddOpen]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [delId,       setDelId]       = useState(null);
  const [form, setForm] = useState({ teacherId:'', subjectId:'', program:'', semester:'' });

  async function load() {
    if (!deptId) return;
    const [a, t, s, p] = await Promise.all([
      getTeacherAssignments(deptId), getDeptTeachers(deptId), getSubjects(deptId), getPrograms(deptId),
    ]);
    setAssignments(a); setTeachers(t); setSubjects(s); setPrograms(p); setLoading(false);
  }
  useEffect(() => { load(); }, [deptId]);

  const filteredSubjects = subjects.filter(s =>
    (!form.program  || s.program  === form.program) &&
    (!form.semester || s.semester === form.semester)
  );

  async function handleAdd(e) {
    e.preventDefault();
    const teacher = teachers.find(t => t.id === form.teacherId);
    const subject = subjects.find(s => s.id === form.subjectId);
    if (!teacher || !subject) { toast.error('Select teacher and subject'); return; }
    const dup = assignments.find(a => a.teacherId === form.teacherId && a.subjectId === form.subjectId);
    if (dup) { toast.error('Already assigned'); return; }
    setSaving(true);
    try {
      await assignSubjectToTeacher(deptId, {
        teacherId: teacher.id, teacherName: teacher.displayName,
        subjectId: subject.id, subjectName: subject.name,
        program: subject.program, semester: subject.semester,
      });
      toast.success('Subject assigned!');
      logActivity(deptId, 'teacher_assignment', `Assigned subject to teacher`, profile?.displayName).catch(()=>{});
      setAddOpen(false);
      setForm({ teacherId:'', subjectId:'', program:'', semester:'' });
      load();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  // Group by teacher
  const byTeacher = assignments.reduce((acc, a) => {
    if (!acc[a.teacherId]) acc[a.teacherId] = { name: a.teacherName, items: [] };
    acc[a.teacherId].items.push(a);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="page-title">Teacher Assignments</h1><p className="page-sub">Assign subjects to teachers</p></div>
          <button onClick={() => setAddOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
            <Plus size={14}/> Assign Subject
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-28 shimmer rounded-2xl"/>)}</div>
        ) : assignments.length === 0 ? (
          <EmptyState icon={UserCog} title="No assignments yet" desc="Assign subjects to teachers so they can take attendance."
            action={<button onClick={() => setAddOpen(true)} className="btn-primary btn-sm">Assign First Subject</button>}/>
        ) : (
          <div className="space-y-4">
            {Object.entries(byTeacher).map(([tid, { name, items }]) => (
              <div key={tid} className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.05]" style={{background:'rgba(255,255,255,0.02)'}}>
                  <span className="font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>{name}</span>
                  <span className="ml-2 badge badge-blue text-[10px]">{items.length} subject{items.length>1?'s':''}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-3 group">
                      <div className="p-2 rounded-lg bg-blue-500/10"><BookOpen size={13} className="text-blue-400"/></div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{item.subjectName}</div>
                        <div className="text-xs text-white/35">{item.program} · Sem {item.semester}</div>
                      </div>
                      <button onClick={() => setDelId(item.id)} className="btn-icon p-1.5 opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} className="text-red-400/60"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Assign Subject to Teacher" size="md">
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="label">Teacher *</label>
              <select className="input" value={form.teacherId} onChange={e=>setForm(f=>({...f,teacherId:e.target.value}))} required>
                <option value="">Select teacher…</option>
                {teachers.map(t=><option key={t.id} value={t.id}>{t.displayName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Program</label>
                <select className="input" value={form.program} onChange={e=>setForm(f=>({...f,program:e.target.value,subjectId:''}))}>
                  <option value="">All Programs</option>
                  {programs.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester</label>
                <select className="input" value={form.semester} onChange={e=>setForm(f=>({...f,semester:e.target.value,subjectId:''}))}>
                  <option value="">All Semesters</option>
                  {[1,2,3,4,5,6,7,8].map(s=><option key={s} value={String(s)}>Semester {s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Subject *</label>
              <select className="input" value={form.subjectId} onChange={e=>setForm(f=>({...f,subjectId:e.target.value}))} required>
                <option value="">Select subject…</option>
                {filteredSubjects.map(s=><option key={s.id} value={s.id}>{s.name} ({s.program} · Sem {s.semester})</option>)}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm">
                {saving && <Loader2 size={13} className="animate-spin"/>} Assign
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={async () => { await deleteAssignment(deptId, delId); load(); toast.success('Assignment removed'); }}
          title="Remove Assignment" message="Remove this subject assignment from the teacher?" danger/>
      </div>
    </Layout>
  );
}
