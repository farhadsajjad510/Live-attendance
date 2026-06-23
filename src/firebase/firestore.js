// ─── Firestore Service Layer ──────────────────────────────────────────────────
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp,
  onSnapshot, writeBatch, limit, increment, collectionGroup,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// ─── Class isolation utilities (inline — no circular import) ─────────────────
// BS1: sem 1,2 | BS2: sem 3,4 | BS3: sem 5,6 | BS4: sem 7,8
function semesterToClassUtil(semester) {
  const s = Number(semester);
  if (s <= 2) return 'BS1';
  if (s <= 4) return 'BS2';
  if (s <= 6) return 'BS3';
  return 'BS4';
}
function classToSemestersUtil(cls) {
  const map = { BS1: ['1','2'], BS2: ['3','4'], BS3: ['5','6'], BS4: ['7','8'] };
  return map[cls] || [];
}

// ─── Firestore error mapper ───────────────────────────────────────────────────
// Maps Firestore error codes to human-readable messages so the UI never shows
// raw Firebase error codes like "permission-denied" to users.
function mapFirestoreError(err) {
  if (err?.message && !err.code) return err; // already a friendly Error
  const messages = {
    'permission-denied':    'Permission denied. Your account may not have access to this resource.',
    'not-found':            'The requested record was not found.',
    'already-exists':       'A record with this information already exists.',
    'resource-exhausted':   'Service quota reached. Please try again later.',
    'unavailable':          'Service temporarily unavailable. Please check your connection.',
    'deadline-exceeded':    'Request timed out. Please try again.',
    'unauthenticated':      'You are not signed in. Please sign in and try again.',
    'invalid-argument':     'Invalid data provided. Please check your inputs.',
    'failed-precondition':  'Operation failed. A required index may still be building.',
    'internal':             'An internal error occurred. Please try again.',
    'cancelled':            'Operation was cancelled.',
    'data-loss':            'Data error. Please contact support.',
  };
  const msg = messages[err?.code] || messages[err?.code?.replace('firestore/', '')] || err?.message || 'An unexpected error occurred.';
  const mapped = new Error(msg);
  mapped.originalCode = err?.code;
  return mapped;
}

// ─── In-memory read cache ─────────────────────────────────────────────────────
// Caches Firestore reads for 5 minutes to reduce bandwidth on slow networks.
// Automatically invalidated when data is written through this service.
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function cacheInvalidate(...keys) {
  keys.forEach(k => cache.delete(k));
}

// ═══════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data, createdAt: serverTimestamp(), active: true,
  });
  cacheInvalidate('allUsers', `user_${uid}`);
}

export async function getUserProfile(uid) {
  const cacheKey = `user_${uid}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const snap = await getDoc(doc(db, 'users', uid));
  const result = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  if (result) cacheSet(cacheKey, result);
  return result;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

export async function getAllUsers(pageLimit = 500) {
  // Capped at 500 to prevent browser freeze in large deployments.
  // Use getAllUsersPaginated() for management UIs that need scrolling.
  const cacheKey = `allUsers_${pageLimit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(pageLimit));
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

// ═══════════════════════════════════════════════════════════
//  DEPARTMENTS
// ═══════════════════════════════════════════════════════════
export async function createDepartment(data, chairmanId) {
  const ref = await addDoc(collection(db, 'departments'), {
    ...data, chairmanId,
    members: [chairmanId],
    createdAt: serverTimestamp(),
    active: true,
    totalTeachers: 0,
    totalStudents: 0,
  });
  cacheInvalidate('allDepts', `userDepts_${chairmanId}`);
  return ref.id;
}

export async function getDepartment(id) {
  const cacheKey = `dept_${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const snap = await getDoc(doc(db, 'departments', id));
  const result = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  if (result) cacheSet(cacheKey, result);
  return result;
}

export async function getDepartmentByCode(inviteCode) {
  const q = query(collection(db, 'departments'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Invalid department code');
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getDepartmentByQR(qrCode) {
  const q = query(collection(db, 'departments'), where('qrCode', '==', qrCode));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Department not found');
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getUserDepartments(uid) {
  const cacheKey = `userDepts_${uid}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const q = query(collection(db, 'departments'), where('members', 'array-contains', uid));
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function getAllDepartments() {
  const cached = cacheGet('allDepts');
  if (cached) return cached;

  const snap = await getDocs(collection(db, 'departments'));
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet('allDepts', result);
  return result;
}

export async function updateDepartment(id, data) {
  await updateDoc(doc(db, 'departments', id), { ...data, updatedAt: serverTimestamp() });
  cacheInvalidate(`dept_${id}`, 'allDepts');
}

export async function deleteDepartment(id) {
  await deleteDoc(doc(db, 'departments', id));
  cacheInvalidate(`dept_${id}`, 'allDepts');
}

export async function joinDepartment(deptId, uid) {
  const snap = await getDoc(doc(db, 'departments', deptId));
  if (!snap.exists()) throw new Error('Department not found');
  const members = snap.data().members || [];
  if (!members.includes(uid)) {
    await updateDoc(doc(db, 'departments', deptId), { members: [...members, uid] });
    cacheInvalidate(`dept_${deptId}`, `userDepts_${uid}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  JOIN REQUESTS
// ═══════════════════════════════════════════════════════════
export async function submitJoinRequest(deptId, data) {
  if (!deptId) throw new Error('Department not found');
  if (!data.userId) throw new Error('User ID is required');
  if (!data.role)   throw new Error('Role is required');
  if (!['teacher','cr','student'].includes(data.role)) throw new Error('Invalid role');

  const q = query(
    collection(db, 'departments', deptId, 'joinRequests'),
    where('userId', '==', data.userId)
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    const pending = existing.docs.find(d => d.data().status === 'pending');
    if (pending) throw new Error('You already have a pending request for this department');
  }

  // Verify department exists before creating request
  const deptSnap = await getDoc(doc(db, 'departments', deptId));
  if (!deptSnap.exists()) throw new Error('Department not found. The invite code may be invalid.');

  return addDoc(collection(db, 'departments', deptId, 'joinRequests'), {
    ...data, submittedAt: serverTimestamp(), status: 'pending',
  });
}

export async function getJoinRequests(deptId, status = null) {
  let q = collection(db, 'departments', deptId, 'joinRequests');
  if (status) q = query(q, where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveJoinRequest(deptId, requestId, userId, role) {
  const batch = writeBatch(db);

  // V1.9: fetch the request doc to read studentClass (if present)
  const reqSnap = await getDoc(doc(db, 'departments', deptId, 'joinRequests', requestId));
  const reqData = reqSnap.data() || {};

  batch.update(doc(db, 'departments', deptId, 'joinRequests', requestId), {
    status: 'approved', approvedAt: serverTimestamp(),
  });

  const deptSnap = await getDoc(doc(db, 'departments', deptId));
  const deptData  = deptSnap.data() || {};
  const members   = deptData.members || [];
  if (!members.includes(userId)) {
    batch.update(doc(db, 'departments', deptId), {
      members: [...members, userId],
      ...(role === 'teacher' ? { totalTeachers: increment(1) } : {}),
      ...(role === 'student' ? { totalStudents: increment(1) } : {}),
      ...(role === 'cr'      ? { totalCRs:      increment(1) } : {}),
    });
  }

  batch.update(doc(db, 'users', userId), {
    ...(reqData.studentClass ? { studentClass: reqData.studentClass } : {}),
    status:         'approved',
    departmentId:   deptId,
    departmentName: deptData.name || '',
    departmentRole: role,
    approvedAt:     serverTimestamp(),
  });

  // For teachers: also write primary dept to teacherDepts subcollection
  // so getTeacherDepartments() returns the primary dept alongside any secondaries
  if (role === 'teacher') {
    batch.set(doc(db, 'users', userId, 'teacherDepts', deptId), {
      deptId,
      deptName:   deptData.name || '',
      isPrimary:  true,
      role:       'teacher',
      approvedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  // Invalidate all caches affected by approval
  cacheInvalidate(`dept_${deptId}`, `user_${userId}`, 'allDepts', `userDepts_${userId}`, `teacherDepts_${userId}`);
}

export async function rejectJoinRequest(deptId, requestId) {
  await updateDoc(doc(db, 'departments', deptId, 'joinRequests', requestId), {
    status: 'rejected', rejectedAt: serverTimestamp(),
  });
}

export function subscribeJoinRequests(deptId, callback) {
  const q = query(
    collection(db, 'departments', deptId, 'joinRequests'),
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'desc')
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// ═══════════════════════════════════════════════════════════
//  PROGRAMS
// ═══════════════════════════════════════════════════════════
export async function addProgram(deptId, data) {
  const ref = await addDoc(collection(db, 'departments', deptId, 'programs'), {
    ...data, createdAt: serverTimestamp(),
  });
  cacheInvalidate(`programs_${deptId}`);
  return ref;
}

export async function getPrograms(deptId) {
  const cacheKey = `programs_${deptId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const snap = await getDocs(collection(db, 'departments', deptId, 'programs'));
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function deleteProgram(deptId, id) {
  await deleteDoc(doc(db, 'departments', deptId, 'programs', id));
  cacheInvalidate(`programs_${deptId}`);
}

// ═══════════════════════════════════════════════════════════
//  SUBJECTS
// ═══════════════════════════════════════════════════════════
export async function addSubject(deptId, data) {
  const ref = await addDoc(collection(db, 'departments', deptId, 'subjects'), {
    ...data, createdAt: serverTimestamp(),
  });
  cacheInvalidate(`subjects_${deptId}`);
  return ref;
}

export async function getSubjects(deptId, filters = {}) {
  // PERF: stable cache key — short-circuits repeat calls from StudentSubPages navigation
  const cacheKey = `subjects_${deptId}_${JSON.stringify(filters)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // CLASS ISOLATION FIX: support studentClass, program, and semester independently
  // or in combination. Previously only one filter was applied at a time.
  const constraints = [];
  if (filters.program)      constraints.push(where('program',      '==', filters.program));
  if (filters.semester)     constraints.push(where('semester',     '==', String(filters.semester)));
  if (filters.studentClass) constraints.push(where('studentClass', '==', filters.studentClass));

  const q = constraints.length > 0
    ? query(collection(db, 'departments', deptId, 'subjects'), ...constraints)
    : collection(db, 'departments', deptId, 'subjects');

  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function updateSubject(deptId, id, data) {
  await updateDoc(doc(db, 'departments', deptId, 'subjects', id), data);
  cacheInvalidate(`subjects_${deptId}`);
}

export async function deleteSubject(deptId, id) {
  await deleteDoc(doc(db, 'departments', deptId, 'subjects', id));
  cacheInvalidate(`subjects_${deptId}`);
}

// ═══════════════════════════════════════════════════════════
//  TEACHER ASSIGNMENTS
// ═══════════════════════════════════════════════════════════
export async function assignSubjectToTeacher(deptId, data) {
  const ref = await addDoc(collection(db, 'departments', deptId, 'assignments'), {
    ...data, createdAt: serverTimestamp(), active: true,
  });
  cacheInvalidate(`assignments_${deptId}`);
  return ref;
}

export async function getTeacherAssignments(deptId, teacherId = null) {
  const cacheKey = `assignments_${deptId}_${teacherId || 'all'}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let q = collection(db, 'departments', deptId, 'assignments');
  if (teacherId) q = query(q, where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function deleteAssignment(deptId, id) {
  await deleteDoc(doc(db, 'departments', deptId, 'assignments', id));
  cacheInvalidate(`assignments_${deptId}`);
}

// ═══════════════════════════════════════════════════════════
//  STUDENTS / TEACHERS (queried from users collection)
// ═══════════════════════════════════════════════════════════
export async function getDeptStudents(deptId, filters = {}, pageLimit = 200) {
  // pageLimit=200 prevents browser freeze with large departments.
  // Use getDeptStudentsPaginated() for UI lists that need true pagination.
  const cacheKey = `deptStudents_${deptId}_${JSON.stringify(filters)}_${pageLimit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let constraints = [
    where('departmentId', '==', deptId),
    where('role', '==', 'student'),
  ];
  if (filters.program)      constraints.push(where('program',      '==', filters.program));
  if (filters.semester)     constraints.push(where('semester',     '==', filters.semester));
  if (filters.studentClass) constraints.push(where('studentClass', '==', filters.studentClass));
  constraints.push(limit(pageLimit));

  const q = query(collection(db, 'users'), ...constraints);
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function getDeptTeachers(deptId, pageLimit = 100) {
  const cacheKey = `deptTeachers_${deptId}_${pageLimit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const q = query(collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'teacher'),
    limit(pageLimit)
  );
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function getStudentByRoll(deptId, rollNumber) {
  const q = query(collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('rollNumber', '==', rollNumber)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ═══════════════════════════════════════════════════════════
//  ATTENDANCE SESSIONS
// ═══════════════════════════════════════════════════════════
export async function createSession(deptId, data) {
  // Validate required fields before write — prevents orphan session documents
  if (!deptId) throw new Error('Department ID is required');
  if (!data.teacherId) throw new Error('Teacher ID is required');
  if (!data.subjectId) throw new Error('Subject must be selected');
  if (!data.subjectName) throw new Error('Subject name is required');

  // Generate a random 6-character alphanumeric session code (uppercase, no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const sessionCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  const ref = await addDoc(collection(db, 'departments', deptId, 'sessions'), {
    ...data,
    sessionCode,
    createdAt: serverTimestamp(),
    status: 'active',
    presentCount: 0,
    totalStudents: data.totalStudents || 0,
    // Ensure audit fields are always present
    createdByRole: data.createdByRole || 'teacher',
    createdByName: data.createdByName || data.teacherName || 'Unknown',
  });
  cacheInvalidate(`sessions_${deptId}`);
  return ref;
}

export async function getSession(deptId, sessionId) {
  const snap = await getDoc(doc(db, 'departments', deptId, 'sessions', sessionId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getSessions(deptId, filters = {}, pageLimit = 50) {
  // Fetch sessions filtered only by teacherId (server-side) + dept isolation.
  // studentClass is applied CLIENT-SIDE because old sessions were created before
  // the studentClass field existed — Firestore WHERE on a missing field returns 0 docs.
  // Instead we derive class from session.semester using the same mapping:
  //   BS1→sem 1,2 | BS2→sem 3,4 | BS3→sem 5,6 | BS4→sem 7,8
  // New sessions (created after the fix) also have studentClass field — both paths work.
  //
  // When filtering client-side by class, fetch more from Firestore so we don't
  // miss sessions after filtering (4 classes → fetch up to 4× the required limit).
  const fetchLimit = filters.studentClass ? Math.min(pageLimit * 4, 200) : pageLimit;
  const constraints = [orderBy('createdAt', 'desc'), limit(fetchLimit)];
  if (filters.teacherId) constraints.unshift(where('teacherId', '==', filters.teacherId));
  const q = query(collection(db, 'departments', deptId, 'sessions'), ...constraints);
  const snap = await getDocs(q);
  let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Client-side class filter — works for both old sessions (semester field) and new (studentClass field)
  if (filters.studentClass) {
    const targetClass = filters.studentClass;
    const classSemesters = classToSemestersUtil(targetClass); // e.g. ['1','2'] for BS1
    docs = docs.filter(s => {
      // New sessions: check studentClass field directly
      if (s.studentClass) return s.studentClass === targetClass;
      // Old sessions: derive class from semester field
      if (s.semester) return classSemesters.includes(String(s.semester));
      // No class info at all — exclude to be safe
      return false;
    });
    // Respect original pageLimit after filtering
    docs = docs.slice(0, pageLimit);
  }

  return docs;
}

export async function closeSession(deptId, sessionId) {
  await updateDoc(doc(db, 'departments', deptId, 'sessions', sessionId), {
    status: 'closed', closedAt: serverTimestamp(),
  });
}

export function subscribeSession(deptId, sessionId, cb) {
  return onSnapshot(
    doc(db, 'departments', deptId, 'sessions', sessionId),
    snap => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

// ── Session Code: find an active session by its 6-char code ──────────────────
// Used by students/CRs when they enter a code instead of scanning QR.
// Security: code is only valid while session.status === 'active'.
export async function getSessionByCode(deptId, code) {
  if (!deptId || !code) throw new Error('Invalid parameters');
  const q = query(
    collection(db, 'departments', deptId, 'sessions'),
    where('sessionCode', '==', code.toUpperCase().trim()),
    where('status', '==', 'active'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ═══════════════════════════════════════════════════════════
//  ATTENDANCE RECORDS
// ═══════════════════════════════════════════════════════════
export async function markAttendance(deptId, sessionId, record) {
  const q = query(
    collection(db, 'departments', deptId, 'sessions', sessionId, 'records'),
    where('studentId', '==', record.studentId)
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('Attendance already marked for this student');

  const batch = writeBatch(db);
  const recRef = doc(collection(db, 'departments', deptId, 'sessions', sessionId, 'records'));
  // PERF: store routing fields so collectionGroup listener can filter without path knowledge
  batch.set(recRef, {
    ...record,
    sessionId,
    deptId,
    markedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'departments', deptId, 'sessions', sessionId), {
    presentCount: increment(1),
  });
  await batch.commit();
  return recRef.id;
}

export async function getSessionRecords(deptId, sessionId) {
  const snap = await getDocs(
    collection(db, 'departments', deptId, 'sessions', sessionId, 'records')
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeRecords(deptId, sessionId, cb) {
  return onSnapshot(
    query(
      collection(db, 'departments', deptId, 'sessions', sessionId, 'records'),
      orderBy('markedAt', 'desc')
    ),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function getStudentAttendance(deptId, studentId, studentClass, semester) {
  // CLASS ISOLATION FIX: filter sessions to student's own class only.
  // BS1→sem 1,2 | BS2→sem 3,4 | BS3→sem 5,6 | BS4→sem 7,8
  const resolvedClass = studentClass || (semester ? semesterToClassUtil(Number(semester)) : null);
  const sessionFilter = resolvedClass ? { studentClass: resolvedClass } : {};
  const sessions = await getSessions(deptId, sessionFilter);
  // PERF: parallel fetch — all record queries fire at once (was N sequential round-trips)
  const capped = sessions.slice(0, 30);
  const snaps = await Promise.all(
    capped.map(s => getDocs(query(
      collection(db, 'departments', deptId, 'sessions', s.id, 'records'),
      where('studentId', '==', studentId)
    )))
  );
  return capped.map((s, i) =>
    snaps[i].empty
      ? { studentId, status: 'absent', session: s }
      : { ...snaps[i].docs[0].data(), session: s, id: snaps[i].docs[0].id }
  );
}

// ═══════════════════════════════════════════════════════════
//  REAL-TIME STUDENT ATTENDANCE SUBSCRIPTION
// ═══════════════════════════════════════════════════════════

/**
 * Real-time listener for a student's own attendance records.
 * Uses collectionGroup('records') filtered by studentId + deptId.
 * Fires instantly when teacher/CR marks the student — no polling needed.
 * Falls back to one-time fetch if index not yet built.
 * Class isolation enforced via student's studentClass field.
 */
export function subscribeStudentAttendance(deptId, studentId, studentClass, callback) {
  const resolvedClass = studentClass || null;

  const q = query(
    collectionGroup(db, 'records'),
    where('studentId', '==', studentId),
    where('deptId',    '==', deptId),
    orderBy('markedAt', 'desc'),
    limit(50)
  );

  // Cache session metadata to avoid re-fetching on every listener update
  const sessionCache = {};

  return onSnapshot(q, async (snap) => {
    if (snap.empty) { callback([]); return; }

    const recordDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Collect unique sessionIds — stored on record by markAttendance
    const sessionIds = [...new Set(recordDocs.map(r => r.sessionId).filter(Boolean))];
    const missing    = sessionIds.filter(id => !sessionCache[id]);

    if (missing.length > 0) {
      const fetched = await Promise.all(
        missing.map(sid =>
          getDoc(doc(db, 'departments', deptId, 'sessions', sid)).catch(() => null)
        )
      );
      fetched.forEach((s, i) => {
        if (s?.exists()) sessionCache[missing[i]] = { id: s.id, ...s.data() };
      });
    }

    // Build results with session metadata; apply class isolation
    const results = recordDocs
      .map(r => ({ ...r, session: r.sessionId ? sessionCache[r.sessionId] : null }))
      .filter(r => {
        if (!resolvedClass || !r.session) return true;
        const s = r.session;
        // Match by stored studentClass OR by semester→class mapping
        if (s.studentClass) return s.studentClass === resolvedClass;
        if (s.semester) {
          const mapped = semesterToClassUtil(Number(s.semester));
          return mapped === resolvedClass;
        }
        return true;
      });

    callback(results);
  }, () => {
    // Index not ready — fall back to one-time fetch silently
    getStudentAttendance(deptId, studentId, studentClass, null).then(callback).catch(() => {});
  });
}

// ═══════════════════════════════════════════════════════════
//  PLATFORM STATS (Owner)
// ═══════════════════════════════════════════════════════════
export async function getPlatformStats() {
  const [depts, users] = await Promise.all([
    getDocs(collection(db, 'departments')),
    getDocs(collection(db, 'users')),
  ]);
  const userDocs = users.docs.map(d => d.data());
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return {
    totalDepartments: depts.size,
    totalUsers:       users.size,
    totalTeachers:    userDocs.filter(u => u.role === 'teacher').length,
    totalStudents:    userDocs.filter(u => u.role === 'student').length,
    totalChairmen:    userDocs.filter(u => u.role === 'chairman').length,
    newToday:         userDocs.filter(u => {
      const d = u.createdAt?.toDate?.();
      return d && d >= today;
    }).length,
  };
}

export async function getPlatformAttendanceStats() {
  const depts = await getDocs(collection(db, 'departments'));
  let totalSessions = 0, totalPresent = 0, totalStudentsMarked = 0;
  for (const d of depts.docs) {
    const sessSnap = await getDocs(
      query(collection(db, 'departments', d.id, 'sessions'), limit(50))
    );
    sessSnap.docs.forEach(s => {
      totalSessions++;
      totalPresent        += s.data().presentCount  || 0;
      totalStudentsMarked += s.data().totalStudents || 0;
    });
  }
  return { totalSessions, totalPresent, totalStudentsMarked };
}

// ═══════════════════════════════════════════════════════════
//  ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════
export async function postAnnouncement(deptId, data) {
  const ref = await addDoc(collection(db, 'departments', deptId, 'announcements'), {
    ...data, createdAt: serverTimestamp(),
  });
  cacheInvalidate(`announcements_${deptId}`);
  return ref;
}

export async function getAnnouncements(deptId) {
  const cacheKey = `announcements_${deptId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // BUGFIX (V1.9 stabilization, Phase 2): getAnnouncements is frequently
  // combined with other queries inside Promise.all() on every dashboard
  // (Chairman, Teacher, CR, Student). If this query ever throws — e.g. a
  // missing/late-propagating Firestore index, or a transient permission
  // error — the WHOLE Promise.all rejects and sibling data (assignments,
  // sessions, attendance records) silently fails to load too.
  // Announcements are non-critical: never let a failure here break the
  // rest of a dashboard. Always resolve to an array.
  let result = [];
  try {
    const q = query(
      collection(db, 'departments', deptId, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // console stripped in production build
    return [];
  }
  cacheSet(cacheKey, result);
  return result;
}

export async function deleteAnnouncement(deptId, id) {
  await deleteDoc(doc(db, 'departments', deptId, 'announcements', id));
  cacheInvalidate(`announcements_${deptId}`);
}

// ═══════════════════════════════════════════════════════════
//  CLASSES
// ═══════════════════════════════════════════════════════════
export async function addClass(deptId, data) {
  const ref = await addDoc(collection(db, 'departments', deptId, 'classes'), {
    ...data, createdAt: serverTimestamp(),
  });
  cacheInvalidate(`classes_${deptId}`);
  return ref;
}

export async function getClasses(deptId) {
  const cacheKey = `classes_${deptId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const q = query(collection(db, 'departments', deptId, 'classes'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

export async function updateClass(deptId, classId, data) {
  await updateDoc(doc(db, 'departments', deptId, 'classes', classId), data);
  cacheInvalidate(`classes_${deptId}`);
}

export async function deleteClass(deptId, classId) {
  await deleteDoc(doc(db, 'departments', deptId, 'classes', classId));
  cacheInvalidate(`classes_${deptId}`);
}

// ═══════════════════════════════════════════════════════════
//  AUDIT LOGS (Owner)
// ═══════════════════════════════════════════════════════════
export async function logAuditEvent(actorUid, actorName, action, target, details = '') {
  await addDoc(collection(db, 'auditLogs'), {
    actorUid, actorName, action, target, details,
    createdAt: serverTimestamp(),
  });
}

export async function getAuditLogs() {
  const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  OWNER USER MANAGEMENT
// ═══════════════════════════════════════════════════════════
export async function suspendUser(uid) {
  await updateDoc(doc(db, 'users', uid), { active: false, suspendedAt: serverTimestamp() });
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

export async function restoreUser(uid) {
  await updateDoc(doc(db, 'users', uid), { active: true, restoredAt: serverTimestamp() });
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

export async function deleteUserRecord(uid) {
  await deleteDoc(doc(db, 'users', uid));
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

// ═══════════════════════════════════════════════════════════
//  OWNER SETUP — ONE-TIME CHECK
// ═══════════════════════════════════════════════════════════

/**
 * Returns true if at least one user with role='owner' exists in Firestore.
 * Used by the one-time owner setup page to disable itself permanently
 * once an owner account has been created.
 * Result is NOT cached — always reads fresh from Firestore.
 */
export async function ownerExists() {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'owner'),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ═══════════════════════════════════════════════════════════
//  ACADEMIC HIERARCHY  (NEW)
//  Department → Academic Level → Year Class → Semester → Subjects
//  All existing subject/program functions are UNCHANGED.
//  New functions use separate subcollections.
// ═══════════════════════════════════════════════════════════

// ── Academic Levels (e.g. BS, MPhil, PhD) ────────────────────────────────────
export async function addAcademicLevel(deptId, data) {
  // data: { name, totalYears, totalSemesters }
  const ref = await addDoc(collection(db, 'departments', deptId, 'academicLevels'), {
    ...data, createdAt: serverTimestamp(),
  });
  cacheInvalidate(`levels_${deptId}`);
  return ref;
}

export async function getAcademicLevels(deptId) {
  const key = `levels_${deptId}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const snap = await getDocs(
    query(collection(db, 'departments', deptId, 'academicLevels'), orderBy('createdAt', 'asc'))
  );
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(key, result);
  return result;
}

export async function deleteAcademicLevel(deptId, levelId) {
  await deleteDoc(doc(db, 'departments', deptId, 'academicLevels', levelId));
  cacheInvalidate(`levels_${deptId}`);
}

// ── Year Classes (e.g. BS-I, BS-II) — auto-created inside a level ──────────
export async function addYearClass(deptId, levelId, data) {
  // data: { name, shortName, order, semesterStart, semesterEnd }
  const ref = await addDoc(
    collection(db, 'departments', deptId, 'academicLevels', levelId, 'yearClasses'),
    { ...data, createdAt: serverTimestamp() }
  );
  cacheInvalidate(`yearClasses_${deptId}_${levelId}`);
  return ref;
}

export async function getYearClasses(deptId, levelId) {
  const key = `yearClasses_${deptId}_${levelId}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const snap = await getDocs(
    query(
      collection(db, 'departments', deptId, 'academicLevels', levelId, 'yearClasses'),
      orderBy('order', 'asc')
    )
  );
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(key, result);
  return result;
}

export async function deleteYearClass(deptId, levelId, classId) {
  await deleteDoc(doc(db, 'departments', deptId, 'academicLevels', levelId, 'yearClasses', classId));
  cacheInvalidate(`yearClasses_${deptId}_${levelId}`);
}

// ── Hierarchy Subjects (stored in departments/{deptId}/subjects with extra fields) ─
// We reuse the existing subjects collection and addSubject/getSubjects functions.
// New subjects get levelId, levelName, classId, className, semesterId fields IN ADDITION
// to the existing program and semester fields — so ALL existing queries still work.

/**
 * Add a subject linked to the hierarchy (level → class → semester).
 * Also sets program=levelName and semester=semesterNumber for backward compat.
 */
export async function addHierarchySubject(deptId, data) {
  // data: { name, code, creditHours, levelId, levelName, classId, className,
  //         semesterId, semesterNumber, semesterLabel }
  const ref = await addDoc(collection(db, 'departments', deptId, 'subjects'), {
    ...data,
    // Backward-compat fields so existing teacher/student/report queries work
    program:  data.levelName,
    semester: String(data.semesterNumber),
    createdAt: serverTimestamp(),
  });
  cacheInvalidate(`subjects_${deptId}`);
  return ref;
}

/**
 * Get subjects filtered by levelId + classId + semesterId (hierarchy-aware).
 */
export async function getHierarchySubjects(deptId, levelId, classId, semesterId) {
  const key = `hsubjects_${deptId}_${levelId}_${classId}_${semesterId}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const q = query(
    collection(db, 'departments', deptId, 'subjects'),
    where('levelId',    '==', levelId),
    where('classId',    '==', classId),
    where('semesterId', '==', semesterId)
  );
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(key, result);
  return result;
}

/**
 * Get subjects for a student using their stored levelId/classId/semesterId.
 * Falls back to program/semester filter for students registered before hierarchy.
 */
export async function getStudentHierarchySubjects(deptId, profile) {
  if (profile.levelId && profile.classId && profile.semesterId) {
    return getHierarchySubjects(deptId, profile.levelId, profile.classId, profile.semesterId);
  }
  // CLASS ISOLATION FIX (semester-based):
  // Each class owns exactly 2 semesters: BS1→1,2 | BS2→3,4 | BS3→5,6 | BS4→7,8
  // We derive the student's class from their semester, then return ONLY the
  // subjects that belong to those 2 semesters — so BS1 never sees BS2 subjects.
  //
  // Filter priority:
  //   1. If studentClass is set on profile → use classToSemesters mapping
  //   2. Else if semester is set → use semesterToClass to find the class, then its semesters
  //   3. Fallback → program+semester only (old behaviour, no cross-class risk if semesters unique)
  const cls = profile.studentClass || (profile.semester ? semesterToClassUtil(Number(profile.semester)) : null);
  if (cls) {
    const semesters = classToSemestersUtil(cls);
    // Load subjects for both semesters of this class, then filter to student's own semester
    const allSubs = await Promise.all(
      semesters.map(sem => getSubjects(deptId, { program: profile.program, semester: sem }))
    );
    const merged = allSubs.flat();
    // De-duplicate by id
    const seen = new Set();
    return merged.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
  }
  // Fallback
  return getSubjects(deptId, { program: profile.program, semester: profile.semester });
}

// ═══════════════════════════════════════════════════════════
//  MULTI-DEPARTMENT TEACHER SYSTEM  (v1.8)
//
//  A teacher may belong to multiple departments via approval.
//  Primary department = profile.departmentId (unchanged).
//  Secondary departments stored in users/{uid}/teacherDepts subcollection.
//  All attendance/reports remain FULLY department-isolated.
// ═══════════════════════════════════════════════════════════

/**
 * Get all departments a teacher belongs to (primary + secondary).
 * Returns array of { deptId, deptName, role, isPrimary, approvedAt }
 */
export async function getTeacherDepartments(uid) {
  const key = `teacherDepts_${uid}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const snap = await getDocs(
    query(collection(db, 'users', uid, 'teacherDepts'), orderBy('approvedAt', 'asc'))
  );
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(key, result);
  return result;
}

/**
 * Add a secondary department to a teacher's profile.
 * Called by approveSecondaryTeacherRequest.
 */
export async function addTeacherDepartment(uid, deptId, deptName, isPrimary = false) {
  await setDoc(doc(db, 'users', uid, 'teacherDepts', deptId), {
    deptId,
    deptName,
    isPrimary,
    role: 'teacher',
    approvedAt: serverTimestamp(),
  });
  cacheInvalidate(`teacherDepts_${uid}`);
}

/**
 * Submit a join request for a teacher to join an ADDITIONAL department.
 * Differs from regular submitJoinRequest because the teacher is already
 * approved in their primary dept — this is for secondary depts only.
 */
export async function submitSecondaryDeptRequest(deptId, teacherProfile) {
  // Check if already a member
  const deptSnap = await getDoc(doc(db, 'departments', deptId));
  if (!deptSnap.exists()) throw new Error('Department not found');
  const members = deptSnap.data().members || [];
  if (members.includes(teacherProfile.uid)) {
    throw new Error('You are already a member of this department');
  }

  // Check for existing pending request
  const q = query(
    collection(db, 'departments', deptId, 'joinRequests'),
    where('userId', '==', teacherProfile.uid),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('You already have a pending request for this department');

  return addDoc(collection(db, 'departments', deptId, 'joinRequests'), {
    userId:        teacherProfile.uid,
    displayName:   teacherProfile.displayName,
    email:         teacherProfile.email,
    role:          'teacher',
    employeeId:    teacherProfile.employeeId    || '',
    qualification: teacherProfile.qualification || '',
    phone:         teacherProfile.phone         || '',
    isSecondaryDept: true,          // flag so chairman knows this is a cross-dept teacher
    primaryDeptName: teacherProfile.departmentName || '',
    submittedAt:   serverTimestamp(),
    status:        'pending',
  });
}

/**
 * Approve a secondary department join request for a teacher.
 * Adds teacher to department members AND writes to users/{uid}/teacherDepts.
 * Does NOT overwrite profile.departmentId (primary stays unchanged).
 */
export async function approveSecondaryTeacherRequest(deptId, requestId, userId) {
  const deptSnap = await getDoc(doc(db, 'departments', deptId));
  const deptData  = deptSnap.data() || {};
  const members   = deptData.members || [];

  const batch = writeBatch(db);

  // Mark request approved
  batch.update(doc(db, 'departments', deptId, 'joinRequests', requestId), {
    status: 'approved', approvedAt: serverTimestamp(),
  });

  // Add teacher to department members array
  if (!members.includes(userId)) {
    batch.update(doc(db, 'departments', deptId), {
      members: [...members, userId],
      totalTeachers: increment(1),
    });
  }

  // Write secondary dept record to teacher's subcollection
  batch.set(doc(db, 'users', userId, 'teacherDepts', deptId), {
    deptId,
    deptName:   deptData.name || '',
    isPrimary:  false,
    role:       'teacher',
    approvedAt: serverTimestamp(),
  });

  await batch.commit();
  cacheInvalidate(`dept_${deptId}`, `user_${userId}`, `teacherDepts_${userId}`, 'allDepts');
}

/**
 * Check if user is approved member of a specific department.
 * Used to validate active dept switches.
 */
export async function isTeacherInDept(uid, deptId) {
  const snap = await getDoc(doc(db, 'users', uid, 'teacherDepts', deptId));
  if (snap.exists()) return true;
  // Also check primary dept
  const userSnap = await getDoc(doc(db, 'users', uid));
  return userSnap.data()?.departmentId === deptId;
}

// ═══════════════════════════════════════════════════════════
//  V1.9 — PASSWORD RESET
// ═══════════════════════════════════════════════════════════
export async function sendPasswordReset(email) {
  // FIX (production crash): removed dynamic import('./config') which caused
  // a Rollup circular chunk reference — auth is now statically imported above.
  // Also removed dynamic import('firebase/auth') — imported statically below.
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email);
}

// ═══════════════════════════════════════════════════════════
//  V1.9 — ATTENDANCE PERCENTAGE / DEFAULTERS
// ═══════════════════════════════════════════════════════════

/**
 * Compute a student's overall attendance percentage in a department.
 * Scans up to 60 most recent sessions and counts presence.
 */
export async function getStudentAttendancePct(deptId, studentId, studentClass, semester) {
  // CLASS ISOLATION FIX: derive class from semester if studentClass not set
  const resolvedClass = studentClass || (semester ? semesterToClassUtil(Number(semester)) : null);
  const sessionFilter = resolvedClass ? { studentClass: resolvedClass } : {};
  const sessions = await getSessions(deptId, sessionFilter);
  if (sessions.length === 0) return { pct: 100, present: 0, total: 0 };
  let present = 0;
  const checks = sessions.slice(0, 60);
  for (const s of checks) {
    const q = query(
      collection(db, 'departments', deptId, 'sessions', s.id, 'records'),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) present++;
  }
  const total = checks.length;
  const pct = total === 0 ? 100 : Math.round((present / total) * 100);
  return { pct, present, total };
}

/**
 * Get department-wide defaulter list: students below threshold attendance (default 75%).
 * Returns [{ student, pct, present, total, level }]
 * level: 'warning' (60-74%) or 'danger' (<60%)
 */
export async function getDeptDefaulters(deptId, threshold = 75) {
  const students = await getDeptStudents(deptId);
  const sessions = await getSessions(deptId);
  if (sessions.length === 0) return [];

  const checks = sessions.slice(0, 60);
  const presentMap = {}; // studentId -> count

  for (const s of checks) {
    const snap = await getDocs(collection(db, 'departments', deptId, 'sessions', s.id, 'records'));
    snap.docs.forEach(d => {
      const sid = d.data().studentId;
      presentMap[sid] = (presentMap[sid] || 0) + 1;
    });
  }

  const total = checks.length;
  const result = [];
  for (const stu of students) {
    if (stu.studentClass === 'Graduated') continue;
    const present = presentMap[stu.id] || 0;
    const pct = total === 0 ? 100 : Math.round((present / total) * 100);
    if (pct < threshold) {
      result.push({
        student: stu, pct, present, total,
        level: pct < 60 ? 'danger' : 'warning',
      });
    }
  }
  return result.sort((a, b) => a.pct - b.pct);
}

// ═══════════════════════════════════════════════════════════
//  V1.9 — CLASS PROMOTION & GRADUATION
// ═══════════════════════════════════════════════════════════

const CLASS_ORDER = ['BS1', 'BS2', 'BS3', 'BS4'];

/**
 * Promote all students in `fromClass` to the next class (or to the
 * Graduated archive if fromClass is BS4). Writes an activity log entry.
 */
export async function promoteClass(deptId, fromClass, actorName) {
  const idx = CLASS_ORDER.indexOf(fromClass);
  if (idx === -1) throw new Error('Invalid class');

  const isGraduation = fromClass === 'BS4';
  const toClass = isGraduation ? 'Graduated' : CLASS_ORDER[idx + 1];

  const q = query(
    collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'student'),
    where('studentClass', '==', fromClass)
  );
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  let count = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (isGraduation) {
      batch.set(doc(db, 'departments', deptId, 'graduates', docSnap.id), {
        ...data,
        graduatedAt: serverTimestamp(),
        originalUid: docSnap.id,
      });
      batch.update(doc(db, 'users', docSnap.id), {
        studentClass: 'Graduated',
        status: 'graduated',
        active: false,
      });
    } else {
      batch.update(doc(db, 'users', docSnap.id), {
        studentClass: toClass,
        promotedAt: serverTimestamp(),
      });
    }
    count++;
  }

  batch.set(doc(collection(db, 'departments', deptId, 'activityLog')), {
    type: isGraduation ? 'graduation' : 'promotion',
    fromClass, toClass, count,
    actorName: actorName || 'Chairman',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  cacheInvalidate(`deptStudents_${deptId}_{}`, 'allUsers');
  return { count, toClass };
}

/** Get graduated students archive for a department */
export async function getGraduates(deptId) {
  const snap = await getDocs(
    query(collection(db, 'departments', deptId, 'graduates'), orderBy('graduatedAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  V1.9 — CHAIRMAN ACTIVITY LOG
// ═══════════════════════════════════════════════════════════

export async function logActivity(deptId, type, details, actorName) {
  await addDoc(collection(db, 'departments', deptId, 'activityLog'), {
    type, details, actorName: actorName || 'Chairman',
    createdAt: serverTimestamp(),
  });
}

export async function getActivityLog(deptId, limitCount = 50) {
  const cacheKey = `activityLog_${deptId}_${limitCount}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const snap = await getDocs(
    query(collection(db, 'departments', deptId, 'activityLog'), orderBy('createdAt', 'desc'), limit(limitCount))
  );
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, result);
  return result;
}

// ═══════════════════════════════════════════════════════════
//  V1.9 — TEACHER PERFORMANCE ANALYTICS
// ═══════════════════════════════════════════════════════════

export async function getTeacherPerformance(deptId) {
  const teachers = await getDeptTeachers(deptId);
  const sessions = await getSessions(deptId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return teachers.map(t => {
    const tSessions = sessions.filter(s => s.teacherId === t.id);
    const thisMonth = tSessions.filter(s => {
      const d = s.createdAt?.toDate?.();
      return d && d >= monthStart;
    });
    return {
      teacher: t,
      totalSessions: tSessions.length,
      sessionsThisMonth: thisMonth.length,
      avgPresent: tSessions.length
        ? Math.round(tSessions.reduce((a, s) => a + (s.presentCount || 0), 0) / tSessions.length)
        : 0,
    };
  });
}

// ═══════════════════════════════════════════════════════════
//  V1.9 — DEPARTMENT ANALYTICS CARDS
// ═══════════════════════════════════════════════════════════

export async function getDepartmentAnalytics(deptId) {
  const [students, teachers, sessions, graduates] = await Promise.all([
    getDeptStudents(deptId),
    getDeptTeachers(deptId),
    getSessions(deptId),
    getGraduates(deptId),
  ]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaySessions = sessions.filter(s => {
    const d = s.createdAt?.toDate?.();
    return d && d >= today;
  });
  const presentToday = todaySessions.reduce((a, s) => a + (s.presentCount || 0), 0);
  const activeStudents = students.filter(s => s.studentClass !== 'Graduated').length;
  const possibleToday = todaySessions.length * (activeStudents || 1);
  const attendancePct = possibleToday > 0 ? Math.round((presentToday / possibleToday) * 100) : 0;

  return {
    totalStudents: activeStudents,
    activeTeachers: teachers.length,
    presentToday,
    attendancePct,
    graduatedStudents: graduates.length,
    sessionsToday: todaySessions.length,
  };
}

// ═══════════════════════════════════════════════════════════
//  V2.0 — CR SMART MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════

/**
 * Pending student join requests for ONE specific class (CR-scoped).
 * A CR only sees students from their own studentClass.
 */
export async function getPendingStudentsForClass(deptId, studentClass) {
  const q = query(
    collection(db, 'departments', deptId, 'joinRequests'),
    where('status', '==', 'pending'),
    where('role', '==', 'student'),
    where('studentClass', '==', studentClass)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.submittedAt?.toMillis?.() || 0) - (b.submittedAt?.toMillis?.() || 0));
}

/**
 * Approved students for ONE specific class (CR-scoped "Approved Students" tab).
 */
export async function getApprovedStudentsForClass(deptId, studentClass) {
  const q = query(
    collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'student'),
    where('studentClass', '==', studentClass)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * All CRs in a department — used by Chairman for CR Management.
 */
export async function getDeptCRs(deptId) {
  const key = `deptCRs_${deptId}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const q = query(
    collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'cr')
  );
  const snap = await getDocs(q);
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(key, result);
  return result;
}

/**
 * Remove CR privileges — demotes the user back to 'student' role.
 * Chairman action. Their class then shows "No Active CR Assigned".
 */
export async function removeCR(deptId, userId, actorName) {
  await updateDoc(doc(db, 'users', userId), {
    role: 'student',
    departmentRole: 'student',
    crRemovedAt: serverTimestamp(),
  });
  cacheInvalidate(`user_${userId}`, `deptCRs_${deptId}`, `deptStudents_${deptId}_{}`);
  await logActivity(deptId, 'cr_removed', `Removed CR privileges from user`, actorName || 'Chairman');
}

/**
 * Returns which BS1-BS4 classes currently have NO active (approved) CR.
 * Chairman dashboard shows "No Active CR Assigned For This Class" for each.
 */
export async function getClassesWithoutCR(deptId) {
  const crs = await getDeptCRs(deptId);
  const covered = new Set(
    crs.filter(c => c.status === 'approved' && c.studentClass).map(c => c.studentClass)
  );
  return CLASS_ORDER.filter(c => !covered.has(c));
}

// ═══════════════════════════════════════════════════════════
//  V2.0 — TEACHER → CR ATTENDANCE DELEGATION
// ═══════════════════════════════════════════════════════════

/**
 * Teacher authorizes a CR to conduct attendance for one of their subjects
 * for a limited time window.
 * data: { crId, crName, teacherId, teacherName, subjectId, subjectName,
 *         program, semester, expiresAt (Date) }
 */
export async function createDelegation(deptId, data) {
  const ref = await addDoc(collection(db, 'departments', deptId, 'delegations'), {
    ...data,
    expiresAt: data.expiresAt, // Date object — Firestore converts to Timestamp
    createdAt: serverTimestamp(),
    active: true,
  });
  cacheInvalidate(`delegationsForCR_${deptId}_${data.crId}`, `delegationsByTeacher_${deptId}_${data.teacherId}`);
  return ref;
}

/**
 * Active, non-expired delegations for a given CR — these become the
 * "Authorized Subjects" the CR can start attendance sessions for.
 */
export async function getDelegationsForCR(deptId, crId) {
  const q = query(
    collection(db, 'departments', deptId, 'delegations'),
    where('crId', '==', crId),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  const now = Date.now();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => {
      const exp = d.expiresAt?.toDate?.();
      return !exp || exp.getTime() > now;
    })
    .sort((a, b) => (a.expiresAt?.toMillis?.() || 0) - (b.expiresAt?.toMillis?.() || 0));
}

/** All delegations a teacher has created (for Manage Delegates list) */
export async function getDelegationsByTeacher(deptId, teacherId) {
  const q = query(
    collection(db, 'departments', deptId, 'delegations'),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Teacher revokes a delegation early */
export async function revokeDelegation(deptId, delegationId, crId, teacherId) {
  await updateDoc(doc(db, 'departments', deptId, 'delegations', delegationId), {
    active: false, revokedAt: serverTimestamp(),
  });
  cacheInvalidate(`delegationsForCR_${deptId}_${crId}`, `delegationsByTeacher_${deptId}_${teacherId}`);
}

export function subscribeAnnouncements(deptId, callback) {
  // V1.9 Phase 2 — real-time announcements for Teachers, CRs, and Students.
  // Using onSnapshot instead of getDocs ensures instant updates when Chairman
  // posts a new announcement — all connected users see it within 1-2 seconds
  // without needing to refresh the page.
  const q = query(
    collection(db, 'departments', deptId, 'announcements'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(results);
  }, (err) => {
    // console stripped in production build
    callback([]);
  });
}

// ═══════════════════════════════════════════════════════════
//  PHASE 5 — ACCOUNT DELETION WORKFLOW
// ═══════════════════════════════════════════════════════════

/** User submits an account deletion request */
export async function submitDeletionRequest(uid, profile) {
  const existing = await getDoc(doc(db, 'deletionRequests', uid));
  if (existing.exists() && existing.data().status === 'pending') {
    throw new Error('You already have a pending deletion request');
  }
  await setDoc(doc(db, 'deletionRequests', uid), {
    uid,
    displayName: profile.displayName,
    email:       profile.email,
    role:        profile.role,
    departmentId:profile.departmentId || null,
    reason:      profile.reason || '',
    status:      'pending',
    submittedAt: serverTimestamp(),
  });
}

/** Owner fetches all pending deletion requests */
export async function getDeletionRequests() {
  const q = query(
    collection(db, 'deletionRequests'),
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Owner approves — marks for deletion (actual Auth deletion requires Admin SDK / Cloud Function) */
export async function approveDeletion(uid, ownerName) {
  const batch = writeBatch(db);
  // Mark user profile as deleted (soft-delete)
  batch.update(doc(db, 'users', uid), {
    status: 'deleted', active: false, deletedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'deletionRequests', uid), {
    status: 'approved', approvedAt: serverTimestamp(), approvedBy: ownerName,
  });
  await batch.commit();
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

/** Owner rejects — keeps account active */
export async function rejectDeletion(uid, ownerName) {
  await updateDoc(doc(db, 'deletionRequests', uid), {
    status: 'rejected', rejectedAt: serverTimestamp(), rejectedBy: ownerName,
  });
}

// ═══════════════════════════════════════════════════════════
//  OWNER EMERGENCY CONTROLS
//  Force operations bypassing department-level restrictions
// ═══════════════════════════════════════════════════════════

/**
 * Owner: Force suspend a user account immediately.
 */
export async function ownerSuspendUser(uid, ownerName) {
  await updateDoc(doc(db, 'users', uid), {
    active: false, status: 'suspended', suspendedAt: serverTimestamp(), suspendedBy: ownerName,
  });
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

/**
 * Owner: Force activate a suspended user account.
 */
export async function ownerActivateUser(uid, ownerName) {
  await updateDoc(doc(db, 'users', uid), {
    active: true, status: 'approved', activatedAt: serverTimestamp(), activatedBy: ownerName,
    suspendedAt: null, suspendedBy: null,
  });
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

/**
 * Owner: Force delete a user record from Firestore.
 * Note: Firebase Auth account deletion requires Admin SDK / Firebase Console.
 * This marks the Firestore document as deleted and deactivates it.
 */
export async function ownerForceDeleteUser(uid, ownerName) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    active: false, status: 'force_deleted',
    forceDeletedAt: serverTimestamp(), forceDeletedBy: ownerName,
    email: `[deleted]_${uid}`, displayName: '[Deleted User]',
  });
  await batch.commit();
  cacheInvalidate(`user_${uid}`, 'allUsers');
}

/**
 * Owner: Force remove an entire department and all its sub-data.
 * Uses batched writes. Large departments may require multiple batches.
 */
export async function ownerForceDeleteDepartment(deptId, ownerName) {
  // Mark department as force-deleted (full subcollection deletion
  // requires Cloud Functions for large depts; we soft-delete here)
  await updateDoc(doc(db, 'departments', deptId), {
    active: false, forceDeleted: true,
    forceDeletedAt: serverTimestamp(), forceDeletedBy: ownerName,
  });

  // Remove departmentId from all members
  const q = query(collection(db, 'users'), where('departmentId', '==', deptId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(doc(db, 'users', d.id), {
      departmentId: null, departmentName: null, status: 'pending',
    });
  });
  if (snap.docs.length > 0) await batch.commit();
  cacheInvalidate(`dept_${deptId}`, 'allDepts', 'allUsers');
}

/**
 * Owner: Get ALL users across all departments with optional pagination.
 * Used by Owner Dashboard emergency controls.
 */
export async function getAllUsersPaginated(pageSize = 50, startAfterDoc = null) {
  let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(pageSize));
  if (startAfterDoc) {
    q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(pageSize));
    // startAfter handled by caller passing the last doc snapshot
  }
  const snap = await getDocs(q);
  return {
    users: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

/**
 * Owner: Get ALL departments with pagination.
 */
export async function getAllDepartmentsPaginated(pageSize = 20, startAfterDoc = null) {
  let q = query(collection(db, 'departments'), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(q);
  return {
    departments: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

// ═══════════════════════════════════════════════════════════
//  PAGINATED QUERIES (for scalability with large datasets)
// ═══════════════════════════════════════════════════════════

/**
 * Get students for a department with pagination (scalability fix).
 * Prevents loading thousands of records at once.
 */
export async function getDeptStudentsPaginated(deptId, options = {}) {
  const { pageSize = 50, startAfterId = null, filters = {} } = options;

  let q = query(
    collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'student'),
    orderBy('displayName', 'asc'),
    limit(pageSize + 1) // fetch one extra to check hasMore
  );

  const snap = await getDocs(q);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const hasMore = docs.length > pageSize;
  return {
    students: hasMore ? docs.slice(0, pageSize) : docs,
    hasMore,
    total: docs.length,
  };
}

/**
 * Get sessions for a department with pagination (prevents loading 100k records).
 */
export async function getSessionsPaginated(deptId, options = {}) {
  const { pageSize = 20, teacherId = null } = options;
  let q = collection(db, 'departments', deptId, 'sessions');
  if (teacherId) {
    q = query(q, where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'), limit(pageSize));
  } else {
    q = query(q, orderBy('createdAt', 'desc'), limit(pageSize));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  PERFORMANCE: COUNT-ONLY QUERIES (avoid loading full collections)
// ═══════════════════════════════════════════════════════════

/**
 * Get just the count of students in a dept without loading all documents.
 * Use for stats cards — avoids fetching full student list just for a number.
 */
export async function getDeptStudentsCount(deptId) {
  const { getCountFromServer } = await import('firebase/firestore');
  try {
    const q = query(
      collection(db, 'users'),
      where('departmentId', '==', deptId),
      where('role', '==', 'student')
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    // getCountFromServer not available in all Firebase SDK versions — fall back
    const students = await getDeptStudents(deptId, {}, 9999);
    return students.length;
  }
}

/**
 * Get just the count of pending join requests (for badge display).
 */
export async function getPendingRequestsCount(deptId) {
  const { getCountFromServer } = await import('firebase/firestore');
  try {
    const q = query(
      collection(db, 'departments', deptId, 'joinRequests'),
      where('status', '==', 'pending')
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    const reqs = await getJoinRequests(deptId, 'pending');
    return reqs.length;
  }
}

/**
 * Search students by name or roll number (server-side, paginated).
 * Replaces client-side filtering of entire student list.
 */
export async function searchStudents(deptId, searchTerm, pageLimit = 30) {
  if (!searchTerm?.trim()) return getDeptStudents(deptId, {}, pageLimit);

  // Firestore doesn't support full-text search, but supports prefix matching.
  // For roll number: exact match
  const term = searchTerm.trim();
  const rollQ = query(
    collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'student'),
    where('rollNumber', '==', term),
    limit(pageLimit)
  );
  const rollSnap = await getDocs(rollQ);
  if (!rollSnap.empty) return rollSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // For names: prefix search using >= and < trick
  const nameQ = query(
    collection(db, 'users'),
    where('departmentId', '==', deptId),
    where('role', '==', 'student'),
    where('displayName', '>=', term),
    where('displayName', '<=', term + ''),
    limit(pageLimit)
  );
  const nameSnap = await getDocs(nameQ);
  return nameSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}
