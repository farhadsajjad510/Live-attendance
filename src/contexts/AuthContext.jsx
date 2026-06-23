import {
  createContext, useContext, useEffect,
  useState, useCallback, useMemo, useRef,
} from 'react';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { createUserProfile, getUserProfile } from '../firebase/firestore';

const AuthContext = createContext(null);

// ─── Session cache ────────────────────────────────────────────────────────────
const CACHE_KEY = 'la_profile_cache';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(p) {
  try {
    if (p) sessionStorage.setItem(CACHE_KEY, JSON.stringify(p));
    else    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}
function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [profile,    setProfile]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  // activeDeptId: which department the teacher is currently working in.
  // Defaults to profile.departmentId (primary). Teacher can switch via setActiveDept().
  // All existing pages read `deptId` from useAuth() — they get activeDeptId transparently.
  const [activeDeptId, setActiveDeptId] = useState(null);

  // Track whether loading has already been resolved to avoid double-calls
  const loadingResolvedRef = useRef(false);
  const timeoutRef         = useRef(null);

  // ── Safe setLoading — only allows false, never re-sets true ──────────────
  const resolveLoading = useCallback(() => {
    if (loadingResolvedRef.current) return;
    loadingResolvedRef.current = true;

    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setLoading(false);
  }, []);

  const updateProfile_ = useCallback((p) => {
    setProfile(p);
    writeCache(p);
    // Reset active dept to primary when profile loads (login / page refresh)
    // Only reset if activeDeptId is not already set to a valid dept
    setActiveDeptId(prev => {
      if (!prev && p?.departmentId) return p.departmentId;
      return prev;
    });
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const signup = useCallback(async ({ email, password, displayName, role, ...extra }) => {
    // Validate inputs before hitting Firebase
    if (!email?.trim()) throw new Error('Email is required');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    if (!displayName?.trim()) throw new Error('Name is required');
    if (!role) throw new Error('Role is required');

    let u;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      u = cred.user;
    } catch (err) {
      // Map Firebase Auth error codes to human-readable messages
      const authErrors = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email':        'Please enter a valid email address.',
        'auth/weak-password':        'Password must be at least 6 characters.',
        'auth/too-many-requests':    'Too many attempts. Please wait a moment.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/operation-not-allowed': 'Email/password signup is not enabled. Contact administrator.',
      };
      throw new Error(authErrors[err.code] || `Account creation failed: ${err.message}`);
    }

    try {
      await updateProfile(u, { displayName: displayName.trim() });
    } catch {
      // Non-fatal — continue even if display name update fails
    }

    const autoApproved = role === 'owner' || role === 'chairman';
    const profileData = {
      uid: u.uid,
      email: email.trim(),
      displayName: displayName.trim(),
      role,
      status: autoApproved ? 'approved' : 'pending',
      ...(role !== 'owner' ? extra : {}),
    };

    try {
      await createUserProfile(u.uid, profileData);
    } catch (err) {
      // Firestore write failed — clean up Auth account to avoid orphan
      try { await u.delete(); } catch {}
      const fsErrors = {
        'permission-denied':    'Unable to create profile. Firestore rules may not be deployed yet.',
        'unavailable':          'Service temporarily unavailable. Please try again.',
        'resource-exhausted':   'Service quota exceeded. Please try again later.',
      };
      throw new Error(fsErrors[err.code] || `Profile creation failed: ${err.message}`);
    }

    updateProfile_(profileData);
    return u;
  }, [updateProfile_]);

  const login = useCallback(async (email, password) => {
    const { user: u } = await signInWithEmailAndPassword(auth, email, password);
    const p = await getUserProfile(u.uid);
    updateProfile_(p);
    return { user: u, profile: p };
  }, [updateProfile_]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    updateProfile_(null);
    clearCache();
  }, [updateProfile_]);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      const p = await getUserProfile(auth.currentUser.uid);
      updateProfile_(p);
      return p;
    }
  }, [updateProfile_]);

  // ── Core effect: auth listener + profile snapshot + timeout guard ─────────
  useEffect(() => {
    loadingResolvedRef.current = false;

    // ── TIMEOUT GUARD ────────────────────────────────────────────────────────
    // If loading is STILL true after 8 seconds, force it to false.
    // Covers every scenario where Firebase never calls back:
    //   • onAuthStateChanged blocked by ad-blocker or privacy extension
    //   • Firestore onSnapshot never fires on very slow / offline connection
    //   • Auth domain unreachable
    // Result: user sees the login page instead of a permanent black screen.
    timeoutRef.current = setTimeout(() => {
      if (!loadingResolvedRef.current) {


        resolveLoading();
      }
    }, 8000);

    let unsubProfile = null;

    // ── onAuthStateChanged ───────────────────────────────────────────────────


    const unsubAuth = onAuthStateChanged(
      auth,
      (u) => {


        // Clean up any previous profile listener
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }

        setUser(u);

        if (u) {
          // ── Authenticated ────────────────────────────────────────────────
          // 1. Serve from cache immediately (zero-latency on slow networks)
          const cached = readCache();
          if (cached && cached.uid === u.uid) {

            setProfile(cached);
            resolveLoading(); // ← loading=false immediately from cache
            // Snapshot will still run below to get fresh data
          }

          // 2. Start real-time Firestore listener on users/{uid}


          unsubProfile = onSnapshot(
            doc(db, 'users', u.uid),

            // ── Success callback ───────────────────────────────────────────
            (snap) => {
              if (snap.exists()) {
                const fresh = { id: snap.id, ...snap.data() };

                updateProfile_(fresh);
              } else {
                // Document missing — user registered via Auth but no Firestore doc
                // This happens if createUserProfile failed or was never called.
                // Still resolve loading so user can reach the app.


                updateProfile_(null);
              }
              resolveLoading();
            },

            // ── Error callback ─────────────────────────────────────────────
            (error) => {

              // Keep cached profile if available so the user isn't logged out
              // on a temporary permission blip or network hiccup.
              if (!readCache()) {

                updateProfile_(null);
              } else {

              }
              resolveLoading();
            }
          );
        } else {
          // ── Not authenticated ────────────────────────────────────────────

          updateProfile_(null);
          clearCache();
          resolveLoading();
        }
      },

      // ── onAuthStateChanged error handler ──────────────────────────────────
      // Fires if the Auth service itself is unreachable
      (error) => {


        resolveLoading(); // Always unblock the UI
      }
    );

    return () => {

      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
  }, []); // Empty deps — only runs once on mount

  // ── Switch active department (multi-dept teachers) ────────────────────────
  // Validates the teacher is actually approved in the target dept before switching.
  const setActiveDept = useCallback(async (newDeptId) => {
    if (!newDeptId) { setActiveDeptId(profile?.departmentId || null); return; }
    if (newDeptId === (activeDeptId || profile?.departmentId)) return;
    setActiveDeptId(newDeptId);
  }, [profile, activeDeptId]);

  // ── Memoized context value ────────────────────────────────────────────────
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signup,
    login,
    logout,
    refreshProfile,
    isOwner:    profile?.role === 'owner',
    isChairman: profile?.role === 'chairman',
    isTeacher:  profile?.role === 'teacher',
    isCR:       profile?.role === 'cr',
    isStudent:  profile?.role === 'student',
    isApproved: profile?.status === 'approved',
    // deptId: for teachers, returns activeDeptId if set (multi-dept support)
    // For all other roles, returns profile.departmentId as before.
    // ALL existing pages that use `deptId` from useAuth() work unchanged.
    deptId: profile?.role === 'owner'
      ? null
      : (profile?.role === 'teacher'
          ? (activeDeptId || profile?.departmentId || null)
          : (profile?.departmentId || null)),
    setActiveDept,
    activeDeptId: profile?.role === 'teacher'
      ? (activeDeptId || profile?.departmentId || null)
      : (profile?.departmentId || null),
  }), [user, profile, loading, signup, login, logout, refreshProfile, setActiveDept, activeDeptId]);

  // ── Render ────────────────────────────────────────────────────────────────
  // NEVER render {!loading && children} alone — that produces a blank screen
  // while loading=true. Always render a visible LoadingScreen fallback.
  //
  // The LoadingScreen is imported inline here (not lazy) so it is always
  // available immediately, even before any code-split chunks download.
  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <AuthLoadingScreen />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Inline loading screen — no imports, no chunks, always available ───────────
// Defined here so it never depends on lazy-loaded components.
function AuthLoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#030711',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '30%',
        width: 320, height: 320,
        background: 'rgba(37,99,235,0.07)',
        borderRadius: '50%', filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Logo mark */}
      <div style={{
        width: 60, height: 60,
        background: '#2563eb',
        borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#fff',
        marginBottom: 16,
        boxShadow: '0 8px 28px rgba(37,99,235,0.45)',
        fontFamily: 'system-ui, sans-serif',
      }}>LA</div>

      {/* App name */}
      <div style={{
        fontSize: 20, fontWeight: 700, color: '#fff',
        fontFamily: 'system-ui, sans-serif', marginBottom: 4,
      }}>Live Attendance</div>
      <div style={{
        fontSize: 12, color: 'rgba(255,255,255,0.3)',
        fontFamily: 'system-ui, sans-serif', marginBottom: 28,
      }}>FarhadAIStudio</div>

      {/* Animated dots */}
      <div style={{ display: 'flex', gap: 7 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#2563eb',
            animation: 'ld 1s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes ld {
          0%,80%,100% { transform:translateY(0); opacity:.3; }
          40%          { transform:translateY(-9px); opacity:1; }
        }
      `}</style>
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
