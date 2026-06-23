import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getClasses, addClass, updateClass, deleteClass,
  getAcademicLevels, getYearClasses, getHierarchySubjects, deleteSubject,
} from '../../firebase/firestore';
import { Modal, ConfirmDialog, EmptyState } from '../../components/ui/index.jsx';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Edit2, Trash2, Loader2, Users, ChevronRight, ChevronDown, Layers, GraduationCap } from 'lucide-react';

// Default class template — chairman can add more
const DEFAULT_CLASSES = [
  { name: 'First Year',  shortName: 'FY',  order: 1 },
  { name: 'Second Year', shortName: 'SY',  order: 2 },
  { name: 'Third Year',  shortName: 'TY',  order: 3 },
  { name: 'Final Year',  shortName: 'FIN', order: 4 },
];

const CLASS_COLORS = [
  'border-blue-500/30 bg-blue-500/10',
  'border-cyan-500/30 bg-cyan-500/10',
  'border-purple-500/30 bg-purple-500/10',
  'border-emerald-500/30 bg-emerald-500/10',
  'border-amber-500/30 bg-amber-500/10',
  'border-pink-500/30 bg-pink-500/10',
];
const CLASS_TEXT = [
  'text-blue-400', 'text-cyan-400', 'text-purple-400',
  'text-emerald-400', 'text-amber-400', 'text-pink-400',
];

export default function ClassesPage() {
  const { profile, deptId } = useAuth();
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [addOpen,     setAddOpen]     = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [seeding,     setSeeding]     = useState(false);
  // Hierarchy view tab
  const [tab,         setTab]         = useState('classes'); // 'classes' | 'hierarchy'
  const [levels,      setLevels]      = useState([]);
  const [openLevel,   setOpenLevel]   = useState(null);
  const [openClass,   setOpenClass]   = useState(null);
  const [openSem,     setOpenSem]     = useState(null);
  const [classMap,    setClassMap]    = useState({});
  const [subjectMap,  setSubjectMap]  = useState({});
  const [hierLoading, setHierLoading] = useState(false);
  const [form, setForm] = useState({ name: '', shortName: '', description: '', order: '' });

  async function load() {
    if (!deptId) { setLoading(false); return; }
    const data = await getClasses(deptId);
    setClasses(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [deptId]);

  async function loadHierarchy() {
    if (!deptId || levels.length > 0) return;
    setHierLoading(true);
    try { setLevels(await getAcademicLevels(deptId)); }
    catch { /* silent */ }
    finally { setHierLoading(false); }
  }

  async function toggleLevel(id) {
    if (openLevel === id) { setOpenLevel(null); return; }
    setOpenLevel(id);
    if (!classMap[id]) {
      const cls = await getYearClasses(deptId, id).catch(() => []);
      setClassMap(m => ({ ...m, [id]: cls }));
    }
  }

  async function toggleSem(levelId, classId, sem) {
    const key = classId + '_' + sem.number;
    if (openSem === key) { setOpenSem(null); return; }
    setOpenSem(key);
    if (!subjectMap[key]) {
      const subs = await getHierarchySubjects(deptId, levelId, classId, String(sem.number)).catch(() => []);
      setSubjectMap(m => ({ ...m, [key]: subs }));
    }
  }

  async function handleDeleteSubject(sub, classId, semNum) {
    try {
      await deleteSubject(deptId, sub.id);
      const key = classId + '_' + semNum;
      setSubjectMap(m => ({ ...m, [key]: (m[key]||[]).filter(s => s.id !== sub.id) }));
      toast.success('Subject deleted');
    } catch (e) { toast.error(e.message); }
  }

  // Seed default four year classes
  async function seedDefaults() {
    if (!deptId) return;
    setSeeding(true);
    try {
      for (const cls of DEFAULT_CLASSES) {
        await addClass(deptId, cls);
      }
      toast.success('Default year classes added!');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSeeding(false);
    }
  }

  function openAdd() {
    setEditItem(null);
    setForm({ name: '', shortName: '', description: '', order: String(classes.length + 1) });
    setAddOpen(true);
  }

  function openEdit(cls) {
    setEditItem(cls);
    setForm({
      name:        cls.name        || '',
      shortName:   cls.shortName   || '',
      description: cls.description || '',
      order:       String(cls.order || ''),
    });
    setAddOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Class name is required'); return; }
    setSaving(true);
    try {
      const data = {
        name:        form.name.trim(),
        shortName:   form.shortName.trim().toUpperCase(),
        description: form.description.trim(),
        order:       Number(form.order) || classes.length + 1,
      };
      if (editItem) {
        await updateClass(deptId, editItem.id, data);
        toast.success('Class updated');
      } else {
        await addClass(deptId, data);
        toast.success('Class added!');
      }
      setAddOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteClass(deptId, id);
      toast.success('Class deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  if (!deptId) {
    return (
      <Layout>
        <div className="page-in">
          <EmptyState
            icon={BookOpen}
            title="No Department Yet"
            desc="Create your department first to manage classes."
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-in space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Classes</h1>
            <p className="page-sub">Manage year groups within your department</p>
          </div>
          <div className="flex gap-2">
            {tab === 'classes' && classes.length === 0 && (
              <button onClick={seedDefaults} disabled={seeding}
                className="btn-secondary btn-sm flex items-center gap-2">
                {seeding ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
                Add Default Years
              </button>
            )}
            {tab === 'classes' && (
              <button onClick={openAdd} className="btn-primary btn-sm flex items-center gap-2">
                <Plus size={14} /> Add Class
              </button>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['classes', 'Classes', BookOpen], ['hierarchy', 'Hierarchy View', Layers]].map(([k, l, Icon]) => (
            <button key={k}
              onClick={() => { setTab(k); if (k === 'hierarchy') loadHierarchy(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                tab === k ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'
              }`} style={{ fontFamily: 'Syne,sans-serif' }}>
              <Icon size={12} /> {l}
            </button>
          ))}
        </div>

        {/* ── Hierarchy View Tab ── */}
        {tab === 'hierarchy' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl text-xs text-blue-300/70 flex items-center gap-2"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <Layers size={13} className="text-blue-400 flex-shrink-0" />
              Program → Class → Semester → Subjects. Use the Subjects page to create subjects.
              Delete buttons remove subjects from this view.
            </div>

            {hierLoading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
            ) : levels.length === 0 ? (
              <div className="card p-10 text-center">
                <GraduationCap size={28} className="text-white/20 mx-auto mb-2" />
                <p className="text-white/35 text-sm">No academic levels yet. Create them in Academic Structure.</p>
              </div>
            ) : levels.map(level => {
              const isOpen = openLevel === level.id;
              const yearClasses = classMap[level.id] || [];
              return (
                <div key={level.id} className="card overflow-hidden border border-white/[0.07]">
                  {/* Level row */}
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => toggleLevel(level.id)}>
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/15">
                      <GraduationCap size={15} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-blue-400" style={{ fontFamily: 'Syne,sans-serif' }}>
                        {level.name}
                      </div>
                      <div className="text-xs text-white/35">{level.totalYears} years · {level.totalSemesters || (level.totalYears*2)} semesters</div>
                    </div>
                    {isOpen ? <ChevronDown size={15} className="text-white/30" /> : <ChevronRight size={15} className="text-white/20" />}
                  </div>

                  {/* Year classes */}
                  {isOpen && (
                    <div className="border-t border-white/[0.05]">
                      {yearClasses.length === 0 ? (
                        <div className="p-4 text-center text-white/25 text-xs">No classes in this level</div>
                      ) : yearClasses.map(cls => {
                        const classOpen = openClass === cls.id;
                        const semesters = cls.semesters || [];
                        return (
                          <div key={cls.id} className="border-b border-white/[0.04] last:border-0">
                            {/* Class row */}
                            <div className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-white/[0.02]"
                              onClick={() => setOpenClass(classOpen ? null : cls.id)}>
                              <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white/50">{cls.order}</span>
                              </div>
                              <span className="text-sm font-semibold text-white/80 flex-1">{cls.name}</span>
                              <span className="text-xs text-white/30">{semesters.length} sem</span>
                              {classOpen ? <ChevronDown size={13} className="text-white/25" /> : <ChevronRight size={13} className="text-white/15" />}
                            </div>

                            {/* Semesters */}
                            {classOpen && semesters.map(sem => {
                              const key = cls.id + '_' + sem.number;
                              const semOpen = openSem === key;
                              const subjects = subjectMap[key] || [];
                              return (
                                <div key={sem.number} className="border-b border-white/[0.03] last:border-0 bg-white/[0.01]">
                                  {/* Semester row */}
                                  <div className="flex items-center gap-3 px-8 py-2.5 cursor-pointer hover:bg-white/[0.02]"
                                    onClick={() => toggleSem(level.id, cls.id, sem)}>
                                    <div className="w-5 h-5 rounded-md bg-white/[0.05] flex items-center justify-center">
                                      <span className="text-[9px] font-bold text-white/40">{sem.number}</span>
                                    </div>
                                    <span className="text-xs text-white/60 flex-1">{sem.label}</span>
                                    <span className="text-[10px] text-white/25">{semOpen ? `${subjects.length} subjects` : ''}</span>
                                    {semOpen ? <ChevronDown size={12} className="text-white/20" /> : <ChevronRight size={12} className="text-white/15" />}
                                  </div>

                                  {/* Subjects */}
                                  {semOpen && (
                                    <div className="px-10 pb-3 space-y-1">
                                      {subjects.length === 0 ? (
                                        <p className="text-xs text-white/25 py-2">No subjects. Add them from the Subjects page.</p>
                                      ) : subjects.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.03] group">
                                          <div className="p-1 rounded bg-purple-500/10">
                                            <BookOpen size={10} className="text-purple-400" />
                                          </div>
                                          <span className="text-xs text-white/70 flex-1">{sub.name}</span>
                                          {sub.code && <span className="font-mono text-[9px] text-white/25 bg-white/[0.04] px-1.5 rounded">{sub.code}</span>}
                                          <span className="text-[9px] text-white/25">{sub.creditHours}hr</span>
                                          <button
                                            onClick={() => handleDeleteSubject(sub, cls.id, sem.number)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/15 transition-all">
                                            <Trash2 size={10} className="text-red-400/70" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info banner */}
        <div className="p-4 rounded-xl text-xs text-blue-300/70 leading-relaxed"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <span className="font-bold text-blue-300">Department Classes</span> represent year groups
          (First Year, Second Year, etc.). Students are assigned to a class when they enroll.
          Teachers are assigned to classes via the Assignments page. You can also add custom class groups.
        </div>

        {/* Loading */}
        {tab === 'classes' && loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-36 shimmer rounded-2xl" />)}
          </div>
        ) : classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            desc="Add the default year groups (First Year → Final Year) or create custom classes."
            action={
              <div className="flex gap-3">
                <button
                  onClick={seedDefaults}
                  disabled={seeding}
                  className="btn-secondary btn-sm flex items-center gap-2"
                >
                  {seeding ? <Loader2 size={13} className="animate-spin" /> : null}
                  Add Default Years
                </button>
                <button onClick={openAdd} className="btn-primary btn-sm flex items-center gap-2">
                  <Plus size={13} /> Custom Class
                </button>
              </div>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {classes.sort((a, b) => (a.order || 0) - (b.order || 0)).map((cls, idx) => {
              const colorCard = CLASS_COLORS[idx % CLASS_COLORS.length];
              const colorText = CLASS_TEXT[idx % CLASS_TEXT.length];
              return (
                <div
                  key={cls.id}
                  className={`card border p-5 flex flex-col gap-3 group ${colorCard}`}
                >
                  {/* Icon + actions */}
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${colorCard} ${colorText}`}
                      style={{ fontFamily: 'Syne,sans-serif' }}>
                      {cls.shortName || cls.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(cls)} className="btn-icon p-1.5">
                        <Edit2 size={12} className="text-white/50" />
                      </button>
                      <button onClick={() => setDeleteId(cls.id)} className="btn-icon p-1.5">
                        <Trash2 size={12} className="text-red-400/60" />
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <div className={`font-bold text-sm ${colorText}`} style={{ fontFamily: 'Syne,sans-serif' }}>
                      {cls.name}
                    </div>
                    {cls.description && (
                      <div className="text-xs text-white/35 mt-0.5">{cls.description}</div>
                    )}
                  </div>

                  {/* Order badge */}
                  <div className="flex items-center gap-2 mt-auto">
                    <span className="badge badge-gray text-[9px]">Order: {cls.order || idx + 1}</span>
                  </div>
                </div>
              );
            })}

            {/* Add more card */}
            <button
              onClick={openAdd}
              className="card border border-dashed border-white/10 p-5 flex flex-col items-center justify-center gap-2 hover:border-blue-500/30 transition-all group min-h-[144px]"
            >
              <Plus size={20} className="text-white/20 group-hover:text-blue-400 transition-colors" />
              <span className="text-xs text-white/25 group-hover:text-white/50 transition-colors">Add class</span>
            </button>
          </div>
        )}

        {/* Students per class table */}
        {classes.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05]">
              <h3 className="section-title">Class Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Short Name</th>
                    <th>Order</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.sort((a, b) => (a.order || 0) - (b.order || 0)).map(cls => (
                    <tr key={cls.id}>
                      <td className="font-semibold text-white">{cls.name}</td>
                      <td>
                        <span className="font-mono text-xs text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md">
                          {cls.shortName || '—'}
                        </span>
                      </td>
                      <td className="text-white/40">{cls.order || '—'}</td>
                      <td className="text-white/45 text-xs">{cls.description || '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(cls)} className="btn-icon p-1.5">
                            <Edit2 size={12} className="text-white/40" />
                          </button>
                          <button onClick={() => setDeleteId(cls.id)} className="btn-icon p-1.5">
                            <Trash2 size={12} className="text-red-400/60" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Modal */}
        <Modal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title={editItem ? 'Edit Class' : 'Add Class'}
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Class Name *</label>
              <input className="input" placeholder="e.g. First Year, Second Year, Final Year"
                value={form.name} onChange={set('name')} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Short Name</label>
                <input className="input font-mono uppercase" placeholder="e.g. FY, TY"
                  value={form.shortName} onChange={set('shortName')} maxLength={5} />
              </div>
              <div>
                <label className="label">Display Order</label>
                <input className="input" type="number" min="1" placeholder="1"
                  value={form.order} onChange={set('order')} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" placeholder="Optional description…"
                value={form.description} onChange={set('description')} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm flex items-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {editItem ? 'Save Changes' : 'Add Class'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete confirm */}
        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
          title="Delete Class"
          message="Delete this class? Students assigned to it will not be removed, but the class group will no longer exist."
          danger
        />
      </div>
    </Layout>
  );
}
