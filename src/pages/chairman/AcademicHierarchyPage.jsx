// AcademicHierarchyPage — Chairman manages the full hierarchy:
// Department → Academic Level (BS/MPhil) → Year Classes (BS-I..BS-IV)
//           → Semesters (auto-assigned) → Subjects
//
// NEW PAGE — does not modify any existing page.
// Existing ProgramsPage, SubjectsPage, ClassesPage remain unchanged.

import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import { Modal, ConfirmDialog, EmptyState } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAcademicLevels, addAcademicLevel, deleteAcademicLevel,
  getYearClasses, addYearClass, deleteYearClass,
  getHierarchySubjects, addHierarchySubject, deleteSubject,
} from '../../firebase/firestore';
import toast from 'react-hot-toast';
import {
  BookMarked, BookOpen, Plus, Trash2, Loader2,
  ChevronRight, ChevronDown, Layers, GraduationCap,
} from 'lucide-react';

// ── Year class templates per program type ─────────────────────────────────────
function buildYearClasses(levelName, totalYears) {
  // e.g. BS → BS-I, BS-II, BS-III, BS-IV with 2 semesters each
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const classes = [];
  let semCounter = 1;
  for (let y = 0; y < totalYears; y++) {
    const name      = `${levelName}-${roman[y] || (y + 1)}`;
    const shortName = `${levelName}${roman[y] || (y + 1)}`;
    const sems      = [];
    for (let s = 0; s < 2; s++) {
      sems.push({ number: semCounter, label: `Semester ${semCounter}` });
      semCounter++;
    }
    classes.push({ name, shortName, order: y + 1, semesters: sems });
  }
  return classes;
}

const LEVEL_PRESETS = [
  { name: 'BS',       totalYears: 4, label: 'BS (4 years · 8 semesters)' },
  { name: 'MSc',      totalYears: 2, label: 'MSc (2 years · 4 semesters)' },
  { name: 'MPhil',    totalYears: 2, label: 'MPhil (2 years · 4 semesters)' },
  { name: 'PhD',      totalYears: 3, label: 'PhD (3 years · 6 semesters)' },
  { name: 'MS',       totalYears: 2, label: 'MS (2 years · 4 semesters)' },
  { name: 'FSc',      totalYears: 2, label: 'FSc (2 years · 4 semesters)' },
  { name: 'FA',       totalYears: 2, label: 'FA (2 years · 4 semesters)' },
  { name: 'Custom',   totalYears: 4, label: 'Custom…' },
];

const COLORS = [
  { card: 'border-blue-500/25 bg-blue-500/06',    text: 'text-blue-400',    icon: 'bg-blue-500/12 border-blue-500/20'    },
  { card: 'border-cyan-500/25 bg-cyan-500/06',    text: 'text-cyan-400',    icon: 'bg-cyan-500/12 border-cyan-500/20'    },
  { card: 'border-purple-500/25 bg-purple-500/06',text: 'text-purple-400',  icon: 'bg-purple-500/12 border-purple-500/20'},
  { card: 'border-emerald-500/25',                text: 'text-emerald-400', icon: 'bg-emerald-500/12 border-emerald-500/20'},
  { card: 'border-amber-500/25',                  text: 'text-amber-400',   icon: 'bg-amber-500/12 border-amber-500/20'  },
];

export default function AcademicHierarchyPage() {
  const { deptId } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [levels,    setLevels]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // What's expanded
  const [openLevel, setOpenLevel] = useState(null); // levelId
  const [openClass, setOpenClass] = useState(null); // classId
  const [openSem,   setOpenSem]   = useState(null); // `${classId}_${semNum}`

  // Per-level classes cache: { [levelId]: [...] }
  const [classMap,   setClassMap]   = useState({});
  // Per-semester subjects cache: { [`${classId}_${semId}`]: [...] }
  const [subjectMap, setSubjectMap] = useState({});
  // Loading states per section
  const [classLoading,   setClassLoading]   = useState({});
  const [subjectLoading, setSubjectLoading] = useState({});

  // Modals
  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [addSubOpen,   setAddSubOpen]   = useState(null); // { levelId, levelName, classId, className, semesterId, semesterNumber, semesterLabel }
  const [delLevel,     setDelLevel]     = useState(null);
  const [delSubject,   setDelSubject]   = useState(null); // { id }

  // Level form
  const [levelForm, setLevelForm] = useState({ preset: 'BS', customName: '', totalYears: 4 });
  // Subject form
  const [subForm, setSubForm] = useState({ name: '', code: '', creditHours: 3 });

  // ── Load levels ────────────────────────────────────────────────────────────
  async function loadLevels() {
    if (!deptId) return;
    try {
      const data = await getAcademicLevels(deptId);
      setLevels(data);
    } catch (e) { toast.error('Failed to load academic structure'); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadLevels(); }, [deptId]);

  // ── Toggle level → load its classes ───────────────────────────────────────
  async function toggleLevel(levelId) {
    if (openLevel === levelId) { setOpenLevel(null); return; }
    setOpenLevel(levelId);
    if (classMap[levelId]) return; // already loaded

    setClassLoading(c => ({ ...c, [levelId]: true }));
    try {
      const classes = await getYearClasses(deptId, levelId);
      setClassMap(m => ({ ...m, [levelId]: classes }));
    } catch (e) { toast.error('Failed to load classes'); }
    finally { setClassLoading(c => ({ ...c, [levelId]: false })); }
  }

  // ── Toggle class → just expand semesters (they're on the class object) ────
  function toggleClass(classId) {
    setOpenClass(openClass === classId ? null : classId);
  }

  // ── Toggle semester → load subjects ───────────────────────────────────────
  async function toggleSemester(levelId, classId, sem) {
    const key = `${classId}_${sem.number}`;
    if (openSem === key) { setOpenSem(null); return; }
    setOpenSem(key);
    if (subjectMap[key]) return;

    setSubjectLoading(s => ({ ...s, [key]: true }));
    try {
      const subjects = await getHierarchySubjects(deptId, levelId, classId, String(sem.number));
      setSubjectMap(m => ({ ...m, [key]: subjects }));
    } catch (e) { toast.error('Failed to load subjects'); }
    finally { setSubjectLoading(s => ({ ...s, [key]: false })); }
  }

  // ── Create Academic Level ──────────────────────────────────────────────────
  async function handleAddLevel(e) {
    e.preventDefault();
    const isCustom = levelForm.preset === 'Custom';
    const name     = isCustom ? levelForm.customName.trim() : levelForm.preset;
    const years    = Number(levelForm.totalYears);
    if (!name) { toast.error('Enter level name'); return; }
    if (levels.find(l => l.name === name)) { toast.error(`${name} already exists`); return; }

    setSaving(true);
    try {
      // 1. Create the academic level doc
      const levelRef = await addAcademicLevel(deptId, {
        name, totalYears: years, totalSemesters: years * 2,
      });
      const levelId = levelRef.id;

      // 2. Auto-create year classes with semesters embedded
      const yearClasses = buildYearClasses(name, years);
      for (const cls of yearClasses) {
        await addYearClass(deptId, levelId, {
          name:          cls.name,
          shortName:     cls.shortName,
          order:         cls.order,
          semesters:     cls.semesters,  // stored as array on the class doc
          levelName:     name,
        });
      }

      toast.success(`${name} created with ${yearClasses.length} year classes!`);
      setAddLevelOpen(false);
      setLevelForm({ preset: 'BS', customName: '', totalYears: 4 });
      await loadLevels();
      // Pre-open the new level
      setOpenLevel(levelId);
      const classes = await getYearClasses(deptId, levelId);
      setClassMap(m => ({ ...m, [levelId]: classes }));
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  // ── Add subject to semester ────────────────────────────────────────────────
  async function handleAddSubject(e) {
    e.preventDefault();
    if (!subForm.name.trim()) { toast.error('Enter subject name'); return; }
    if (!addSubOpen) return;
    setSaving(true);
    try {
      const subjectData = {
        name:           subForm.name.trim(),
        code:           subForm.code.trim(),
        creditHours:    Number(subForm.creditHours),
        levelId:        addSubOpen.levelId,
        levelName:      addSubOpen.levelName,
        classId:        addSubOpen.classId,
        className:      addSubOpen.className,
        semesterId:     String(addSubOpen.semesterNumber),
        semesterNumber: addSubOpen.semesterNumber,
        semesterLabel:  addSubOpen.semesterLabel,
      };
      await addHierarchySubject(deptId, subjectData);
      toast.success('Subject added!');

      // Refresh subjects for this semester
      const key = `${addSubOpen.classId}_${addSubOpen.semesterNumber}`;
      const fresh = await getHierarchySubjects(
        deptId, addSubOpen.levelId, addSubOpen.classId, String(addSubOpen.semesterNumber)
      );
      setSubjectMap(m => ({ ...m, [key]: fresh }));
      setSubForm({ name: '', code: '', creditHours: 3 });
      setAddSubOpen(null);
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  // ── Delete subject ─────────────────────────────────────────────────────────
  async function handleDeleteSubject() {
    if (!delSubject) return;
    try {
      await deleteSubject(deptId, delSubject.id);
      const key = `${delSubject.classId}_${delSubject.semesterNumber}`;
      setSubjectMap(m => ({ ...m, [key]: (m[key] || []).filter(s => s.id !== delSubject.id) }));
      toast.success('Subject deleted');
    } catch (err) { toast.error(err.message); }
  }

  // ── Delete level ───────────────────────────────────────────────────────────
  async function handleDeleteLevel() {
    if (!delLevel) return;
    try {
      await deleteAcademicLevel(deptId, delLevel.id);
      setLevels(ls => ls.filter(l => l.id !== delLevel.id));
      setClassMap(m => { const n = { ...m }; delete n[delLevel.id]; return n; });
      toast.success(`${delLevel.name} deleted`);
    } catch (err) { toast.error(err.message); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="page-in space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Academic Structure</h1>
            <p className="page-sub">Department → Level → Year Class → Semester → Subjects</p>
          </div>
          <button onClick={() => setAddLevelOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
            <Plus size={14} /> Add Level
          </button>
        </div>

        {/* Legend */}
        <div className="p-3 rounded-xl text-xs text-blue-300/70 flex items-start gap-2"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Layers size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <span>
            Create an Academic Level (e.g. <b>BS</b>). Year classes and semesters are created automatically.
            Open any semester to add subjects. Students and CRs select their level → class → semester when joining.
          </span>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 shimmer rounded-2xl" />)}</div>
        ) : levels.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No academic levels yet"
            desc="Add a level like BS, MSc, or MPhil. Year classes and semesters will be created automatically."
            action={
              <button onClick={() => setAddLevelOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
                <Plus size={13} /> Add First Level
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {levels.map((level, li) => {
              const col     = COLORS[li % COLORS.length];
              const isOpen  = openLevel === level.id;
              const classes = classMap[level.id] || [];

              return (
                <div key={level.id} className={`card border ${col.card} overflow-hidden`}>
                  {/* Level row */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleLevel(level.id)}
                  >
                    <div className={`p-2 rounded-xl border ${col.icon}`}>
                      <BookMarked size={15} className={col.text} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm ${col.text}`} style={{ fontFamily: 'Syne,sans-serif' }}>
                        {level.name}
                      </div>
                      <div className="text-xs text-white/35">
                        {level.totalYears} years · {level.totalSemesters || level.totalYears * 2} semesters
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setDelLevel(level); }}
                      className="btn-icon p-1.5 opacity-0 group-hover:opacity-100 mr-2"
                      style={{ opacity: isOpen ? 1 : undefined }}
                    >
                      <Trash2 size={12} className="text-red-400/60" />
                    </button>
                    {isOpen
                      ? <ChevronDown size={16} className="text-white/40 flex-shrink-0" />
                      : <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
                    }
                  </div>

                  {/* Year classes */}
                  {isOpen && (
                    <div className="border-t border-white/[0.05]">
                      {classLoading[level.id] ? (
                        <div className="p-4 space-y-2">
                          {[1,2].map(i => <div key={i} className="h-10 shimmer rounded-lg" />)}
                        </div>
                      ) : classes.length === 0 ? (
                        <div className="p-6 text-center text-white/30 text-sm">No classes found</div>
                      ) : (
                        <div>
                          {classes.map(cls => {
                            const classOpen = openClass === cls.id;
                            const semesters = cls.semesters || [];

                            return (
                              <div key={cls.id} className="border-b border-white/[0.04] last:border-0">
                                {/* Class row */}
                                <div
                                  className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                  onClick={() => toggleClass(cls.id)}
                                >
                                  <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                                    <span className="text-[10px] font-bold text-white/50"
                                      style={{ fontFamily: 'Syne,sans-serif' }}>
                                      {cls.shortName?.slice(-1) || cls.order}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm font-semibold text-white/80">{cls.name}</span>
                                    <span className="ml-2 text-xs text-white/30">
                                      {semesters.length} semesters
                                    </span>
                                  </div>
                                  {classOpen
                                    ? <ChevronDown size={14} className="text-white/30 flex-shrink-0" />
                                    : <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                                  }
                                </div>

                                {/* Semesters */}
                                {classOpen && (
                                  <div className="bg-white/[0.015]">
                                    {semesters.map(sem => {
                                      const semKey    = `${cls.id}_${sem.number}`;
                                      const semOpen   = openSem === semKey;
                                      const subjects  = subjectMap[semKey] || [];
                                      const semLoading= subjectLoading[semKey];

                                      return (
                                        <div key={sem.number} className="border-b border-white/[0.03] last:border-0">
                                          {/* Semester row */}
                                          <div
                                            className="flex items-center gap-3 px-8 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                            onClick={() => toggleSemester(level.id, cls.id, sem)}
                                          >
                                            <div className="w-5 h-5 rounded-md bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                                              <span className="text-[9px] font-bold text-white/40">{sem.number}</span>
                                            </div>
                                            <span className="text-xs text-white/60 flex-1">{sem.label}</span>
                                            {semOpen && (
                                              <button
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  setSubForm({ name: '', code: '', creditHours: 3 });
                                                  setAddSubOpen({
                                                    levelId:        level.id,
                                                    levelName:      level.name,
                                                    classId:        cls.id,
                                                    className:      cls.name,
                                                    semesterId:     String(sem.number),
                                                    semesterNumber: sem.number,
                                                    semesterLabel:  sem.label,
                                                  });
                                                }}
                                                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mr-2 transition-colors"
                                                style={{ fontFamily: 'Syne,sans-serif' }}
                                              >
                                                <Plus size={10} /> Add Subject
                                              </button>
                                            )}
                                            {semOpen
                                              ? <ChevronDown size={13} className="text-white/25 flex-shrink-0" />
                                              : <ChevronRight size={13} className="text-white/15 flex-shrink-0" />
                                            }
                                          </div>

                                          {/* Subjects list */}
                                          {semOpen && (
                                            <div className="px-10 pb-3">
                                              {semLoading ? (
                                                <div className="space-y-1.5 pt-1">
                                                  {[1,2].map(i => <div key={i} className="h-7 shimmer rounded-lg" />)}
                                                </div>
                                              ) : subjects.length === 0 ? (
                                                <div className="py-3 text-center">
                                                  <p className="text-xs text-white/25 mb-2">No subjects yet</p>
                                                  <button
                                                    onClick={() => {
                                                      setSubForm({ name: '', code: '', creditHours: 3 });
                                                      setAddSubOpen({
                                                        levelId:        level.id,
                                                        levelName:      level.name,
                                                        classId:        cls.id,
                                                        className:      cls.name,
                                                        semesterId:     String(sem.number),
                                                        semesterNumber: sem.number,
                                                        semesterLabel:  sem.label,
                                                      });
                                                    }}
                                                    className="btn-primary btn-xs flex items-center gap-1 mx-auto"
                                                  >
                                                    <Plus size={10} /> Create Subject
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="space-y-1 pt-1">
                                                  {subjects.map(sub => (
                                                    <div key={sub.id}
                                                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.03] group transition-colors">
                                                      <div className="p-1 rounded bg-blue-500/10 flex-shrink-0">
                                                        <BookOpen size={10} className="text-blue-400" />
                                                      </div>
                                                      <span className="text-xs text-white/70 flex-1">{sub.name}</span>
                                                      {sub.code && (
                                                        <span className="font-mono text-[9px] text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                                          {sub.code}
                                                        </span>
                                                      )}
                                                      <span className="text-[9px] text-white/25">{sub.creditHours}hr</span>
                                                      <button
                                                        onClick={() => setDelSubject({
                                                          ...sub,
                                                          classId:        cls.id,
                                                          semesterNumber: sem.number,
                                                        })}
                                                        className="opacity-0 group-hover:opacity-100 btn-icon p-1 transition-opacity"
                                                      >
                                                        <Trash2 size={10} className="text-red-400/60" />
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add Level Modal ── */}
        <Modal open={addLevelOpen} onClose={() => setAddLevelOpen(false)} title="Add Academic Level" size="sm">
          <form onSubmit={handleAddLevel} className="space-y-4">
            <div>
              <label className="label">Program Type</label>
              <select className="input" value={levelForm.preset}
                onChange={e => setLevelForm(f => ({ ...f, preset: e.target.value }))}>
                {LEVEL_PRESETS.map(p => (
                  <option key={p.name} value={p.name}>{p.label}</option>
                ))}
              </select>
            </div>
            {levelForm.preset === 'Custom' && (
              <div>
                <label className="label">Custom Level Name *</label>
                <input className="input" placeholder="e.g. BBA, LLB, MBA"
                  value={levelForm.customName}
                  onChange={e => setLevelForm(f => ({ ...f, customName: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="label">Total Years</label>
              <select className="input" value={levelForm.totalYears}
                onChange={e => setLevelForm(f => ({ ...f, totalYears: Number(e.target.value) }))}>
                {[1,2,3,4,5,6].map(n => (
                  <option key={n} value={n}>{n} year{n>1?'s':''} ({n*2} semesters)</option>
                ))}
              </select>
            </div>
            <div className="p-3 rounded-xl text-xs text-emerald-300/70"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
              ✓ Year classes and semesters will be created automatically.
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAddLevelOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm flex items-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Create Level
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Add Subject Modal ── */}
        <Modal open={!!addSubOpen} onClose={() => setAddSubOpen(null)}
          title={addSubOpen ? `Add Subject — ${addSubOpen.semesterLabel}` : 'Add Subject'} size="sm">
          <form onSubmit={handleAddSubject} className="space-y-4">
            {addSubOpen && (
              <div className="p-2.5 rounded-xl text-xs text-white/45"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {addSubOpen.levelName} → {addSubOpen.className} → {addSubOpen.semesterLabel}
              </div>
            )}
            <div>
              <label className="label">Subject Name *</label>
              <input className="input" placeholder="e.g. Classical Mechanics"
                value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Subject Code</label>
                <input className="input font-mono" placeholder="PHY-301"
                  value={subForm.code} onChange={e => setSubForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <label className="label">Credit Hours</label>
                <select className="input" value={subForm.creditHours}
                  onChange={e => setSubForm(f => ({ ...f, creditHours: Number(e.target.value) }))}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} hrs</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAddSubOpen(null)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary btn-sm flex items-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Add Subject
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Delete subject confirm ── */}
        <ConfirmDialog
          open={!!delSubject}
          onClose={() => setDelSubject(null)}
          onConfirm={handleDeleteSubject}
          title="Delete Subject"
          message="Delete this subject? Existing attendance records won't be affected."
          danger
        />

        {/* ── Delete level confirm ── */}
        <ConfirmDialog
          open={!!delLevel}
          onClose={() => setDelLevel(null)}
          onConfirm={handleDeleteLevel}
          title={`Delete ${delLevel?.name}`}
          message={`Delete ${delLevel?.name} and all its year classes? Subjects created under it will remain in the database.`}
          danger
        />
      </div>
    </Layout>
  );
}
