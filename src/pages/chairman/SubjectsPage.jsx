import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { Modal, ConfirmDialog, EmptyState } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjects, addSubject, deleteSubject, getPrograms } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Trash2, Loader2, Filter } from 'lucide-react';

export default function SubjectsPage() {
  const { deptId } = useAuth();
  const [subjects,  setSubjects] = useState([]);
  const [programs,  setPrograms] = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [addOpen,   setAddOpen]  = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [delId,     setDelId]    = useState(null);
  const [filterPrg, setFilterPrg]= useState('');
  const [filterSem, setFilterSem]= useState('');
  const [form, setForm] = useState({ name:'', code:'', program:'', semester:'1', creditHours:3, description:'' });

  async function load() {
    if (!deptId) return;
    const [sub, prg] = await Promise.all([getSubjects(deptId), getPrograms(deptId)]);
    setSubjects(sub); setPrograms(prg); setLoading(false);
  }
  useEffect(() => { load(); }, [deptId]);

  async function handleAdd(e) {
    e.preventDefault();
    // Check duplicate
    const dup = subjects.find(s => s.name.toLowerCase()===form.name.toLowerCase() && s.program===form.program && s.semester===form.semester);
    if (dup) { toast.error('Subject already exists for this program/semester'); return; }
    setSaving(true);
    try {
      await addSubject(deptId, { ...form, semester: String(form.semester), creditHours: Number(form.creditHours) });
      toast.success('Subject added!');
      setAddOpen(false);
      setForm({ name:'', code:'', program:'', semester:'1', creditHours:3, description:'' });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await deleteSubject(deptId, id); toast.success('Subject deleted'); load(); }
    catch (e) { toast.error(e.message); }
  }

  const filtered = subjects.filter(s =>
    (!filterPrg || s.program === filterPrg) &&
    (!filterSem || s.semester === filterSem)
  );

  // Group by program+semester
  const grouped = filtered.reduce((acc, s) => {
    const key = `${s.program} · Semester ${s.semester}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="page-title">Subjects</h1><p className="page-sub">{subjects.length} subjects across all programs</p></div>
          <button onClick={() => setAddOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
            <Plus size={14}/> Add Subject
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <select className="input text-sm w-44" value={filterPrg} onChange={e=>setFilterPrg(e.target.value)}>
            <option value="">All Programs</option>
            {programs.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select className="input text-sm w-40" value={filterSem} onChange={e=>setFilterSem(e.target.value)}>
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6,7,8].map(s=><option key={s} value={String(s)}>Semester {s}</option>)}
          </select>
          <span className="text-sm text-white/35 self-center">{filtered.length} subjects</span>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-24 shimmer rounded-2xl"/>)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects yet" desc="Add subjects for each program and semester."
            action={<button onClick={() => setAddOpen(true)} className="btn-primary btn-sm">Add First Subject</button>}/>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([group, subs]) => (
              <div key={group} className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.05]" style={{background:'rgba(255,255,255,0.02)'}}>
                  <span className="text-sm font-bold text-white/70" style={{fontFamily:'Syne,sans-serif'}}>{group}</span>
                  <span className="ml-2 badge badge-blue text-[10px]">{subs.length}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {subs.map(s => (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 group hover:bg-white/[0.015]">
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/15">
                        <BookOpen size={13} className="text-blue-400"/>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{s.name}</div>
                        <div className="flex gap-2 mt-0.5">
                          {s.code && <span className="font-mono text-[10px] text-white/35 bg-white/[0.04] px-1.5 py-0.5 rounded">{s.code}</span>}
                          <span className="text-[10px] text-white/30">{s.creditHours} Credit hrs</span>
                        </div>
                      </div>
                      <button onClick={() => setDelId(s.id)} className="btn-icon p-1.5 opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} className="text-red-400/60"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Subject" size="md">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Subject Name *</label>
                <input className="input" placeholder="e.g. Classical Mechanics" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
              </div>
              <div>
                <label className="label">Subject Code</label>
                <input className="input font-mono" placeholder="e.g. PHY-301" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))}/>
              </div>
              <div>
                <label className="label">Credit Hours</label>
                <select className="input" value={form.creditHours} onChange={e=>setForm(f=>({...f,creditHours:e.target.value}))}>
                  {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} hrs</option>)}
                </select>
              </div>
              <div>
                <label className="label">Program *</label>
                <select className="input" value={form.program} onChange={e=>setForm(f=>({...f,program:e.target.value}))} required>
                  <option value="">Select…</option>
                  {programs.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester *</label>
                <select className="input" value={form.semester} onChange={e=>setForm(f=>({...f,semester:e.target.value}))}>
                  {[1,2,3,4,5,6,7,8].map(s=><option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm">
                {saving && <Loader2 size={13} className="animate-spin"/>} Add Subject
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={() => handleDelete(delId)}
          title="Delete Subject" message="Delete this subject? Existing attendance records won't be affected." danger/>
      </div>
    </Layout>
  );
}
