import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { Modal, ConfirmDialog, EmptyState, Avatar } from '../../components/ui/index.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { getDeptStudentsPaginated, getJoinRequests, approveJoinRequest, rejectJoinRequest, updateUserProfile } from '../../firebase/firestore';
import { formatDate, calcPct, pctBadge } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { GraduationCap, CheckCircle, XCircle, Clock, Search, Hash, Phone, Filter, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentsPageChairman() {
  const { deptId } = useAuth();
  const [students,  setStudents] = useState([]);
  const [requests,  setRequests] = useState([]);
  const [search,    setSearch]   = useState('');
  const [semFilter, setSemFilter]= useState('');
  const [loading,   setLoading]  = useState(true);
  const [tab,       setTab]      = useState('enrolled');
  const [qrStudent, setQrStudent]= useState(null);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalHint, setTotalHint] = useState(0);

  async function load(resetPage = true) {
    if (!deptId) return;
    setLoading(true);
    try {
      const [{ students: st, hasMore: more, total }, req] = await Promise.all([
        getDeptStudentsPaginated(deptId, { pageSize: PAGE_SIZE }),
        getJoinRequests(deptId, 'pending'),
      ]);
      setStudents(st);
      setHasMore(more);
      setTotalHint(total);
      setRequests(req.filter(r => r.role === 'student' || r.role === 'cr'));
      if (resetPage) setPage(1);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [deptId]);

  async function approve(req) {
    try { await approveJoinRequest(deptId, req.id, req.userId, req.role); toast.success(`${req.displayName} approved!`); load(); }
    catch (e) { toast.error(e.message); }
  }
  async function reject(req) {
    try { await rejectJoinRequest(deptId, req.id); toast.success('Rejected'); load(); }
    catch (e) { toast.error(e.message); }
  }

  const semesters = [...new Set(students.map(s => s.semester).filter(Boolean))].sort();
  const filtered = students.filter(s => {
    const matchQ = s.displayName?.toLowerCase().includes(search.toLowerCase()) || s.rollNumber?.toLowerCase().includes(search.toLowerCase());
    const matchS = !semFilter || s.semester === semFilter;
    return matchQ && matchS;
  });

  return (
    <Layout>
      <div className="page-in space-y-5">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">{students.length}{hasMore ? '+' : ''} enrolled · {requests.length} pending</p>
        </div>

        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
          {[['enrolled','Enrolled'], ['pending','Pending']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?'bg-blue-600 text-white':'text-white/45 hover:text-white'}`}
              style={{fontFamily:'Syne,sans-serif'}}>
              {l} {t==='pending' && requests.length > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{requests.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'enrolled' && (
          <>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                <input className="input pl-9 text-sm" placeholder="Search by name or roll number…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              {semesters.length > 0 && (
                <select className="input text-sm w-40" value={semFilter} onChange={e=>setSemFilter(e.target.value)}>
                  <option value="">All Semesters</option>
                  {semesters.map(s=><option key={s} value={s}>Semester {s}</option>)}
                </select>
              )}
            </div>
            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-5 space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-12 shimmer rounded-xl"/>)}</div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={GraduationCap} title="No students enrolled" desc="Approve student join requests from the Pending tab."/>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Student</th><th>Roll No</th><th>Class</th><th>Program</th><th>Semester</th><th>Attendance</th><th>QR</th></tr></thead>
                    <tbody>
                      {filtered.map(s => {
                        const pct = s.attendancePct || 0;
                        return (
                          <tr key={s.id}>
                            <td><div className="flex items-center gap-2.5"><Avatar name={s.displayName} size={8}/><div><div className="font-medium text-white">{s.displayName}</div><div className="text-xs text-white/35">{s.role==='cr'?'Class Rep':'Student'}</div></div></div></td>
                            <td><span className="font-mono text-xs text-blue-300 px-2 py-0.5 rounded-md" style={{background:'rgba(59,130,246,0.1)'}}>{s.rollNumber||'—'}</span></td>
                            <td>{s.studentClass ? <span className="badge badge-blue text-[10px]">{s.studentClass}</span> : <span className="text-white/30 text-xs">—</span>}</td>
                            <td className="text-white/50 text-xs">{s.program||'—'}</td>
                            <td className="text-white/60 text-xs">Sem {s.semester||'—'}</td>
                            <td><span className={`badge text-[10px] ${pctBadge(pct)}`}>{pct}%</span></td>
                            <td>
                              <button onClick={() => setQrStudent(s)} className="btn-icon p-1.5">
                                <QrCode size={13} className="text-blue-400/70"/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'pending' && (
          <div className="card overflow-hidden">
            {requests.length === 0 ? (
              <EmptyState icon={Clock} title="No pending requests" desc="When students register and join, their requests appear here."/>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {requests.map(req => (
                  <div key={req.id} className="flex items-center gap-4 p-4">
                    <Avatar name={req.displayName} size={10}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">{req.displayName}</div>
                      <div className="text-xs text-white/40">{req.email}</div>
                      <div className="flex gap-3 mt-1 text-xs text-white/30">
                        {req.rollNumber && <span className="font-mono"><Hash size={9} className="inline"/> {req.rollNumber}</span>}
                        {req.program && <span>{req.program}</span>}
                        {req.semester && <span>Sem {req.semester}</span>}
                        <span className="badge badge-amber text-[10px]">{req.role==='cr'?'Class Rep':'Student'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => reject(req)} className="btn-danger btn-xs"><XCircle size={11}/>Reject</button>
                      <button onClick={() => approve(req)} className="btn-success btn-xs"><CheckCircle size={11}/>Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student QR Modal */}
      <Modal open={!!qrStudent} onClose={() => setQrStudent(null)} title="Student QR Code" size="sm">
        {qrStudent && (
          <div className="flex flex-col items-center gap-4">
            <Avatar name={qrStudent.displayName} size={12}/>
            <div className="text-center">
              <div className="font-bold text-white">{qrStudent.displayName}</div>
              <div className="text-xs text-white/40 font-mono mt-0.5">{qrStudent.rollNumber}</div>
            </div>
            <div className="p-4 bg-white rounded-2xl">
              <QRCodeSVG value={JSON.stringify({ uid: qrStudent.id, roll: qrStudent.rollNumber, name: qrStudent.displayName, dept: deptId })} size={180} level="H"/>
            </div>
            <p className="text-xs text-white/40 text-center">Teacher or CR scans this to mark attendance (Mode 2)</p>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
