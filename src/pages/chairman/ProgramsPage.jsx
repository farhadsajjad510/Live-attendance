import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { Modal, ConfirmDialog, EmptyState } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getPrograms, addProgram, deleteProgram } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { BookMarked, Plus, Trash2, Loader2 } from 'lucide-react';

const DEFAULT_PROGRAMS = ['BS', 'MSc', 'MPhil', 'PhD', 'FSc', 'FA', 'Associate Degree'];
const SEMESTERS = [1,2,3,4,5,6,7,8];

export default function ProgramsPage() {
  const { deptId } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [addOpen,  setAddOpen]  = useState(false);
  const [delId,    setDelId]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ name:'', customName:'', totalSemesters:8, description:'' });

  async function load() {
    if (!deptId) return;
    const p = await getPrograms(deptId);
    setPrograms(p); setLoading(false);
  }
  useEffect(() => { load(); }, [deptId]);

  async function handleAdd(e) {
    e.preventDefault();
    const name = form.name === 'custom' ? form.customName : form.name;
    if (!name) { toast.error('Enter program name'); return; }
    setSaving(true);
    try {
      await addProgram(deptId, { name, totalSemesters: Number(form.totalSemesters), description: form.description });
      toast.success('Program added!');
      setAddOpen(false);
      setForm({ name:'', customName:'', totalSemesters:8, description:'' });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await deleteProgram(deptId, id); toast.success('Program deleted'); load(); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="page-title">Programs</h1><p className="page-sub">Manage degree programs in your department</p></div>
          <button onClick={() => setAddOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
            <Plus size={14}/> Add Program
          </button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-28 shimmer rounded-2xl"/>)}</div>
        ) : programs.length === 0 ? (
          <EmptyState icon={BookMarked} title="No programs yet" desc="Add programs like BS, MSc, MPhil to organize your department."
            action={<button onClick={() => setAddOpen(true)} className="btn-primary btn-sm">Add First Program</button>}/>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map(p => (
              <div key={p.id} className="card p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/12 border border-purple-500/20">
                    <BookMarked size={16} className="text-purple-400"/>
                  </div>
                  <button onClick={() => setDelId(p.id)} className="btn-icon p-1.5 opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} className="text-red-400/70"/>
                  </button>
                </div>
                <div className="font-bold text-white text-base" style={{fontFamily:'Syne,sans-serif'}}>{p.name}</div>
                {p.description && <p className="text-xs text-white/40 mt-0.5">{p.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <span className="badge badge-purple text-[10px]">{p.totalSemesters} Semesters</span>
                </div>
                {/* Semester chips */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {Array.from({length: p.totalSemesters||8}, (_,i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md text-white/40" style={{background:'rgba(255,255,255,0.05)'}}>
                      Sem {i+1}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Program" size="sm">
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="label">Program Type</label>
              <select className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required>
                <option value="">Select program…</option>
                {DEFAULT_PROGRAMS.map(p=><option key={p} value={p}>{p}</option>)}
                <option value="custom">Custom…</option>
              </select>
            </div>
            {form.name === 'custom' && (
              <div>
                <label className="label">Custom Name</label>
                <input className="input" placeholder="e.g. Diploma in IT" value={form.customName} onChange={e=>setForm(f=>({...f,customName:e.target.value}))} required/>
              </div>
            )}
            <div>
              <label className="label">Total Semesters</label>
              <select className="input" value={form.totalSemesters} onChange={e=>setForm(f=>({...f,totalSemesters:e.target.value}))}>
                {SEMESTERS.map(s=><option key={s} value={s}>{s} Semesters</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input className="input" placeholder="Brief description…" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm">
                {saving && <Loader2 size={13} className="animate-spin"/>} Add Program
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={() => handleDelete(delId)}
          title="Delete Program" message="Delete this program? Subjects under it won't be deleted." danger/>
      </div>
    </Layout>
  );
}
