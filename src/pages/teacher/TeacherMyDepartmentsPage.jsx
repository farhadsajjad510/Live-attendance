// TeacherMyDepartmentsPage
// Allows a teacher to:
//   1. See all departments they belong to (primary + secondary)
//   2. Switch the active working department (all other pages use this)
//   3. Join another department by code or QR
//
// ISOLATION GUARANTEE:
//   Switching active dept updates AuthContext.activeDeptId.
//   All existing teacher pages (AttendancePage, TeacherSubPages, etc.)
//   read deptId from useAuth() — they transparently get the switched value.
//   No attendance data ever crosses department boundaries.

import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherDepartments,
  getDepartmentByCode,
  getDepartmentByQR,
  submitSecondaryDeptRequest,
} from '../../firebase/firestore';
import toast from 'react-hot-toast';
import {
  Building2, Plus, CheckCircle, Loader2, Hash,
  QrCode, ArrowRight, Star, RefreshCw, Clock,
} from 'lucide-react';

const DEPT_COLORS = [
  { border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   icon: 'bg-blue-500/15 border-blue-500/20'    },
  { border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   icon: 'bg-cyan-500/15 border-cyan-500/20'    },
  { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500/15 border-purple-500/20' },
  { border: 'border-emerald-500/30',bg: 'bg-emerald-500/10',text: 'text-emerald-400',icon: 'bg-emerald-500/15 border-emerald-500/20'},
  { border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  icon: 'bg-amber-500/15 border-amber-500/20'  },
];

export default function TeacherMyDepartmentsPage() {
  const { profile, deptId, activeDeptId, setActiveDept } = useAuth();

  const [depts,    setDepts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [joining,  setJoining]  = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinMode, setJoinMode] = useState('code'); // 'code' | 'qr'
  const [code,     setCode]     = useState('');
  const [foundDept,setFoundDept]= useState(null);
  const [searching,setSearching]= useState(false);
  const [submitting,setSubmitting]=useState(false);
  const scannerRef = useRef(null);
  const divRef     = useRef(null);

  // Load all departments this teacher belongs to
  async function loadDepts() {
    if (!profile) return;
    setLoading(true);
    try {
      const secondary = await getTeacherDepartments(profile.uid);

      // Build combined list: primary first, then secondary
      const primaryEntry = {
        id:        profile.departmentId,
        deptId:    profile.departmentId,
        deptName:  profile.departmentName || 'Primary Department',
        isPrimary: true,
        role:      'teacher',
      };

      // Deduplicate — secondary list may already include primary
      const secondaryFiltered = secondary.filter(
        d => d.deptId !== profile.departmentId
      );

      const all = profile.departmentId
        ? [primaryEntry, ...secondaryFiltered]
        : secondaryFiltered;

      setDepts(all);
    } catch (e) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDepts(); }, [profile?.uid]);

  // QR scanner for joining
  useEffect(() => {
    if (joinMode !== 'qr' || !showJoin) {
      try { scannerRef.current?.clear?.(); } catch {}
      return;
    }
    const timer = setTimeout(() => {
      if (!divRef.current) return;
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        if (!divRef.current) return;
        const scanner = new Html5QrcodeScanner('teacher-qr-reader', { fps: 8, qrbox: 200 }, false);
        scanner.render(
          (text) => {
            try { scanner.clear(); } catch {}
            const match = text.match(/[?&]qr=([^&]+)/);
            lookupByQR(match ? match[1] : text);
            setJoinMode('code');
          },
          () => {}
        );
        scannerRef.current = scanner;
      }).catch(() => toast.error('QR scanner failed'));
    }, 100);
    return () => {
      clearTimeout(timer);
      try { scannerRef.current?.clear?.(); } catch {}
    };
  }, [joinMode, showJoin]);

  async function lookupByQR(qrVal) {
    setSearching(true);
    try {
      const d = await getDepartmentByQR(qrVal);
      setFoundDept(d);
      toast.success(`Found: ${d.name}`);
    } catch (e) {
      toast.error('Invalid QR code');
    } finally { setSearching(false); }
  }

  async function lookupByCode(e) {
    e.preventDefault();
    if (code.length < 4) return;
    setSearching(true);
    try {
      const d = await getDepartmentByCode(code);
      setFoundDept(d);
    } catch (e) {
      toast.error(e.message);
    } finally { setSearching(false); }
  }

  async function handleJoinRequest() {
    if (!foundDept || !profile) return;
    setSubmitting(true);
    try {
      await submitSecondaryDeptRequest(foundDept.id, profile);
      toast.success(`Join request sent to ${foundDept.name}! Awaiting chairman approval.`);
      setShowJoin(false);
      setFoundDept(null);
      setCode('');
    } catch (e) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  }

  function handleSwitch(dept) {
    if (!dept.deptId) return;
    setActiveDept(dept.deptId);
    toast.success(`Switched to ${dept.deptName}`);
  }

  const currentActive = activeDeptId || profile?.departmentId;

  return (
    <Layout>
      <div className="page-in space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">My Departments</h1>
            <p className="page-sub">
              {depts.length} department{depts.length !== 1 ? 's' : ''} · Click to switch active workspace
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadDepts} className="btn-icon p-2" title="Refresh">
              <RefreshCw size={15} className={`text-white/50 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setShowJoin(true); setFoundDept(null); setCode(''); }}
              className="btn-primary btn-sm flex items-center gap-2"
            >
              <Plus size={14} /> Join Another Department
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="p-3 rounded-xl text-xs text-blue-300/70 flex items-start gap-2"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Building2 size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <span>
            Each department is fully isolated. Switching your active department changes which
            classes, subjects, and attendance sessions you see across the platform.
            Attendance records never cross department boundaries.
          </span>
        </div>

        {/* Department cards */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 shimmer rounded-2xl" />)}
          </div>
        ) : depts.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Building2 size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No departments yet.</p>
            <button
              onClick={() => setShowJoin(true)}
              className="btn-primary btn-sm mt-4 flex items-center gap-2 mx-auto"
            >
              <Plus size={13} /> Join a Department
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {depts.map((dept, idx) => {
              const col     = DEPT_COLORS[idx % DEPT_COLORS.length];
              const isActive = dept.deptId === currentActive;

              return (
                <div
                  key={dept.deptId || dept.id}
                  className={`card border p-5 flex flex-col gap-4 cursor-pointer transition-all duration-200 ${
                    isActive
                      ? `${col.border} ${col.bg} shadow-lg`
                      : 'border-white/[0.07] hover:border-white/20'
                  }`}
                  onClick={() => handleSwitch(dept)}
                >
                  {/* Icon + badges */}
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl border ${col.icon}`}>
                      <Building2 size={18} className={col.text} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {dept.isPrimary && (
                        <span className="badge badge-amber text-[9px] flex items-center gap-1">
                          <Star size={8} /> Primary
                        </span>
                      )}
                      {isActive && (
                        <span className="badge badge-green text-[9px] flex items-center gap-1">
                          <CheckCircle size={8} /> Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <div className={`font-bold text-sm leading-snug ${isActive ? col.text : 'text-white'}`}
                      style={{ fontFamily: 'Syne,sans-serif' }}>
                      {dept.deptName}
                    </div>
                    <div className="text-xs text-white/35 mt-0.5">
                      {dept.isPrimary ? 'Primary Department' : 'Secondary Department'}
                    </div>
                  </div>

                  {/* Switch button */}
                  {!isActive && (
                    <button
                      className="btn-secondary btn-xs flex items-center gap-1 mt-auto w-fit"
                      onClick={e => { e.stopPropagation(); handleSwitch(dept); }}
                    >
                      Switch to this <ArrowRight size={10} />
                    </button>
                  )}
                  {isActive && (
                    <div className="text-xs text-white/40 mt-auto flex items-center gap-1">
                      <CheckCircle size={11} className="text-emerald-400" />
                      Currently active workspace
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add more card */}
            <button
              onClick={() => setShowJoin(true)}
              className="card border border-dashed border-white/10 p-5 flex flex-col items-center justify-center gap-2 hover:border-blue-500/30 transition-all group min-h-[160px]"
            >
              <Plus size={20} className="text-white/20 group-hover:text-blue-400 transition-colors" />
              <span className="text-xs text-white/25 group-hover:text-white/50 transition-colors">
                Join another department
              </span>
            </button>
          </div>
        )}

        {/* Join another department panel */}
        {showJoin && (
          <div className="card border-blue-500/20 p-6" style={{ background: 'rgba(59,130,246,0.04)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="section-title">Join Another Department</h3>
              <button
                className="btn-ghost btn-xs"
                onClick={() => { setShowJoin(false); setFoundDept(null); setCode(''); }}
              >
                Cancel
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 rounded-xl w-fit mb-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[['code','Enter Code'],['qr','Scan QR']].map(([m,l]) => (
                <button key={m} onClick={() => setJoinMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    joinMode === m ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'
                  }`} style={{ fontFamily: 'Syne,sans-serif' }}>
                  {l}
                </button>
              ))}
            </div>

            {joinMode === 'code' ? (
              <form onSubmit={lookupByCode} className="space-y-3 max-w-sm">
                <div>
                  <label className="label">Department Invite Code</label>
                  <input
                    className="input font-mono text-lg tracking-[0.3em] uppercase text-center"
                    placeholder="XXXXXX" value={code} maxLength={8}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setFoundDept(null); }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || code.length < 4}
                  className="btn-primary btn-sm flex items-center gap-2"
                >
                  {searching ? <Loader2 size={13} className="animate-spin" /> : <Hash size={13} />}
                  {searching ? 'Searching…' : 'Find Department'}
                </button>
              </form>
            ) : (
              <div className="max-w-sm">
                <div id="teacher-qr-reader" ref={divRef} className="rounded-xl overflow-hidden" />
              </div>
            )}

            {/* Found department */}
            {foundDept && (
              <div className="mt-5 p-4 rounded-xl border border-blue-500/25 max-w-sm"
                style={{ background: 'rgba(59,130,246,0.06)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <Building2 size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm" style={{ fontFamily: 'Syne,sans-serif' }}>
                      {foundDept.name}
                    </div>
                    <div className="text-xs text-white/40">{foundDept.institution}</div>
                    <div className="text-xs text-white/30">Chairman: {foundDept.chairmanName}</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl text-xs text-amber-300/70 mb-3 flex items-center gap-1.5"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <Clock size={11} className="text-amber-400 flex-shrink-0" />
                  Your request will be reviewed by the Chairman before you gain access.
                </div>
                <button
                  onClick={handleJoinRequest}
                  disabled={submitting}
                  className="btn-primary btn-sm flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                  {submitting ? 'Sending Request…' : 'Send Join Request'}
                </button>
              </div>
            )}

            <div className="mt-4 p-3 rounded-xl text-xs text-white/35"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              Your primary department <span className="text-white/55">{profile?.departmentName}</span> remains
              unchanged. Secondary departments give you isolated access to their classes,
              subjects, and attendance sessions.
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
