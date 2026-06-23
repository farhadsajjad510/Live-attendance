import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/ui/index.jsx';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page is code-split into its own chunk.
// Users on slow networks only download the chunk for the page they visit.

// Auth (always needed — keep in initial bundle via Suspense fallback)
const LoginPage      = lazy(() => import('./pages/auth/AuthPages').then(m => ({ default: m.LoginPage })));
const SignupPage     = lazy(() => import('./pages/auth/AuthPages').then(m => ({ default: m.SignupPage })));
const PendingPage    = lazy(() => import('./pages/auth/AuthPages').then(m => ({ default: m.PendingPage })));
const OwnerLoginPage = lazy(() => import('./pages/auth/AuthPages').then(m => ({ default: m.OwnerLoginPage })));

// Public
const LandingPage       = lazy(() => import('./pages/LandingPage'));
const NotFoundPage      = lazy(() => import('./pages/shared/SharedPages').then(m => ({ default: m.NotFoundPage })));
const JoinDepartmentPage= lazy(() => import('./pages/shared/JoinDepartmentPage'));
const AccountDeletionPage = lazy(() => import('./pages/shared/AccountDeletionPage'));
const OwnerDeletionPage   = lazy(() => import('./pages/owner/OwnerDeletionPage'));
const SettingsPage      = lazy(() => import('./pages/shared/SettingsPage'));

// Public information pages (v1.9.5 — safe additive update)
const AboutPage         = lazy(() => import('./pages/public/PublicPages').then(m => ({ default: m.AboutPage })));
const ContactPage       = lazy(() => import('./pages/public/PublicPages').then(m => ({ default: m.ContactPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/public/PublicPages').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage         = lazy(() => import('./pages/public/PublicPages').then(m => ({ default: m.TermsPage })));

// Owner
const OwnerDashboard    = lazy(() => import('./pages/owner/OwnerDashboard'));
const OwnerUsersPage    = lazy(() => import('./pages/owner/OwnerSubPages').then(m => ({ default: m.OwnerUsersPage })));
const OwnerAnalyticsPage= lazy(() => import('./pages/owner/OwnerSubPages').then(m => ({ default: m.OwnerAnalyticsPage })));
const OwnerAuditPage    = lazy(() => import('./pages/owner/OwnerAuditPage'));

// Chairman
const ChairmanDashboard    = lazy(() => import('./pages/chairman/ChairmanDashboard'));
const CreateDepartmentPage = lazy(() => import('./pages/chairman/CreateDepartmentPage'));
const TeachersPage         = lazy(() => import('./pages/chairman/TeachersPage'));
const StudentsPageChairman = lazy(() => import('./pages/chairman/StudentsPage'));
const ProgramsPage         = lazy(() => import('./pages/chairman/ProgramsPage'));
const SubjectsPage         = lazy(() => import('./pages/chairman/SubjectsPage'));
const AssignmentsPage      = lazy(() => import('./pages/chairman/AssignmentsPage'));
const AttendanceMonitorPage= lazy(() => import('./pages/chairman/AttendanceMonitorPage'));
const ReportsPageChairman  = lazy(() => import('./pages/chairman/ReportsPage'));
const ClassesPage          = lazy(() => import('./pages/chairman/ClassesPage'));
const AcademicHierarchyPage= lazy(() => import('./pages/chairman/AcademicHierarchyPage'));
const PromotionDefaultersPage = lazy(() => import('./pages/chairman/PromotionDefaultersPage'));
const ActivityLogPage = lazy(() => import('./pages/chairman/ActivityLogPage'));

// Teacher
const TeacherDashboard          = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherMyDepartmentsPage = lazy(() => import('./pages/teacher/TeacherMyDepartmentsPage'));
const TeacherAttendancePage= lazy(() => import('./pages/teacher/AttendancePage'));
const TeacherClassesPage   = lazy(() => import('./pages/teacher/TeacherSubPages').then(m => ({ default: m.TeacherClassesPage })));
const TeacherReportsPage   = lazy(() => import('./pages/teacher/TeacherSubPages').then(m => ({ default: m.TeacherReportsPage })));

// CR
const CRDashboard = lazy(() => import('./pages/cr/CRDashboard'));

// Student
const StudentDashboard        = lazy(() => import('./pages/student/StudentDashboard'));
const ScanPage                = lazy(() => import('./pages/student/ScanPage'));
const StudentAttendancePage   = lazy(() => import('./pages/student/StudentAttendancePage'));
const StudentClassesPage      = lazy(() => import('./pages/student/StudentSubPages').then(m => ({ default: m.StudentClassesPage })));
const StudentAnnouncementsPage= lazy(() => import('./pages/student/StudentSubPages').then(m => ({ default: m.StudentAnnouncementsPage })));

// ─── Suspense fallback — shows during chunk download ─────────────────────────
function PageLoader() {
  return <LoadingScreen />;
}

// ─── Per-route error boundary — catches lazy-load failures with specific message ─
class RouteErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#030711', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#f0f4ff',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Page failed to load</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>
            This could be a network issue or the page is temporarily unavailable.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Route Guards ─────────────────────────────────────────────────────────────
function PrivateRoute({ children, roles }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;

  if (profile?.role === 'owner') {
    if (roles && !roles.includes('owner')) return <Navigate to="/owner" replace />;
    return children;
  }

  if (profile?.role === 'chairman') {
    if (roles && !roles.includes('chairman')) return <Navigate to="/chairman" replace />;
    return children;
  }

  const path = window.location.pathname;
  if (
    profile?.status === 'pending' &&
    !path.startsWith('/join') &&
    !path.startsWith('/pending')
  ) {
    return <Navigate to="/pending" replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    const dash = { owner:'/owner', chairman:'/chairman', teacher:'/teacher', cr:'/cr', student:'/student' };
    return <Navigate to={dash[profile.role] || '/student'} replace />;
  }

  return children;
}

function RoleRouter() {
  const { profile } = useAuth();
  const routes = { owner:'/owner', chairman:'/chairman', teacher:'/teacher', cr:'/cr', student:'/student' };
  return <Navigate to={routes[profile?.role] || '/login'} replace />;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();

  return (
    <RouteErrorBoundary><Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"            element={user ? <RoleRouter /> : <LandingPage />} />
        <Route path="/login"       element={user ? <RoleRouter /> : <LoginPage />} />
        <Route path="/signup"      element={user ? <RoleRouter /> : <SignupPage />} />
        <Route path="/owner-login" element={<OwnerLoginPage />} />
        <Route path="/pending"     element={<PendingPage />} />
        <Route path="/dashboard"   element={<PrivateRoute><RoleRouter /></PrivateRoute>} />

        {/* Public information pages — v1.9.5 */}
        <Route path="/about"   element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms"   element={<TermsPage />} />

        <Route path="/join" element={
          <PrivateRoute roles={['teacher','cr','student']}>
            <JoinDepartmentPage />
          </PrivateRoute>
        } />

        {/* V1.9 Settings — one route per role */}
        <Route path="/owner/settings"    element={<PrivateRoute roles={['owner']}><SettingsPage /></PrivateRoute>} />
        <Route path="/chairman/settings" element={<PrivateRoute roles={['chairman']}><SettingsPage /></PrivateRoute>} />
        <Route path="/teacher/settings"  element={<PrivateRoute roles={['teacher']}><SettingsPage /></PrivateRoute>} />
        <Route path="/cr/settings"       element={<PrivateRoute roles={['cr']}><SettingsPage /></PrivateRoute>} />
        <Route path="/student/settings"  element={<PrivateRoute roles={['student']}><SettingsPage /></PrivateRoute>} />

      {/* Phase 5 — Account deletion request (all non-owner roles) */}
      <Route path="/chairman/delete-account" element={<PrivateRoute roles={['chairman']}><AccountDeletionPage /></PrivateRoute>} />
      <Route path="/teacher/delete-account"  element={<PrivateRoute roles={['teacher']}><AccountDeletionPage /></PrivateRoute>} />
      <Route path="/cr/delete-account"       element={<PrivateRoute roles={['cr']}><AccountDeletionPage /></PrivateRoute>} />
      <Route path="/student/delete-account"  element={<PrivateRoute roles={['student']}><AccountDeletionPage /></PrivateRoute>} />

        {/* OWNER */}
        <Route path="/owner"             element={<PrivateRoute roles={['owner']}><OwnerDashboard /></PrivateRoute>} />
        <Route path="/owner/users"       element={<PrivateRoute roles={['owner']}><OwnerUsersPage /></PrivateRoute>} />
        <Route path="/owner/analytics"   element={<PrivateRoute roles={['owner']}><OwnerAnalyticsPage /></PrivateRoute>} />
        <Route path="/owner/audit"       element={<PrivateRoute roles={['owner']}><OwnerAuditPage /></PrivateRoute>} />
        <Route path="/owner/deletions"   element={<PrivateRoute roles={['owner']}><OwnerDeletionPage /></PrivateRoute>} />
        <Route path="/owner/departments" element={<PrivateRoute roles={['owner']}><OwnerDashboard /></PrivateRoute>} />

        {/* CHAIRMAN */}
        <Route path="/chairman"               element={<PrivateRoute roles={['chairman']}><ChairmanDashboard /></PrivateRoute>} />
        <Route path="/chairman/create-dept"   element={<PrivateRoute roles={['chairman']}><CreateDepartmentPage /></PrivateRoute>} />
        <Route path="/chairman/teachers"      element={<PrivateRoute roles={['chairman']}><TeachersPage /></PrivateRoute>} />
        <Route path="/chairman/students"      element={<PrivateRoute roles={['chairman']}><StudentsPageChairman /></PrivateRoute>} />
        <Route path="/chairman/programs"      element={<PrivateRoute roles={['chairman']}><ProgramsPage /></PrivateRoute>} />
        <Route path="/chairman/subjects"      element={<PrivateRoute roles={['chairman']}><SubjectsPage /></PrivateRoute>} />
        <Route path="/chairman/classes"       element={<PrivateRoute roles={['chairman']}><ClassesPage /></PrivateRoute>} />
        <Route path="/chairman/academic"      element={<PrivateRoute roles={['chairman']}><AcademicHierarchyPage /></PrivateRoute>} />
        <Route path="/chairman/promotions"    element={<PrivateRoute roles={['chairman']}><PromotionDefaultersPage /></PrivateRoute>} />
        <Route path="/chairman/activity"      element={<PrivateRoute roles={['chairman']}><ActivityLogPage /></PrivateRoute>} />
        <Route path="/chairman/assignments"   element={<PrivateRoute roles={['chairman']}><AssignmentsPage /></PrivateRoute>} />
        <Route path="/chairman/attendance"    element={<PrivateRoute roles={['chairman']}><AttendanceMonitorPage /></PrivateRoute>} />
        <Route path="/chairman/reports"       element={<PrivateRoute roles={['chairman']}><ReportsPageChairman /></PrivateRoute>} />
        <Route path="/chairman/announcements" element={<PrivateRoute roles={['chairman']}><ChairmanDashboard /></PrivateRoute>} />

        {/* TEACHER */}
        <Route path="/teacher"            element={<PrivateRoute roles={['teacher']}><TeacherDashboard /></PrivateRoute>} />
        <Route path="/teacher/departments" element={<PrivateRoute roles={['teacher']}><TeacherMyDepartmentsPage /></PrivateRoute>} />
        <Route path="/teacher/classes"    element={<PrivateRoute roles={['teacher']}><TeacherClassesPage /></PrivateRoute>} />
        <Route path="/teacher/attendance" element={<PrivateRoute roles={['teacher']}><TeacherAttendancePage /></PrivateRoute>} />
        <Route path="/teacher/reports"    element={<PrivateRoute roles={['teacher']}><TeacherReportsPage /></PrivateRoute>} />

        {/* CR */}
        <Route path="/cr"               element={<PrivateRoute roles={['cr']}><CRDashboard /></PrivateRoute>} />
        <Route path="/cr/attendance"    element={<PrivateRoute roles={['cr']}><TeacherAttendancePage /></PrivateRoute>} />
        <Route path="/cr/announcements" element={<PrivateRoute roles={['cr']}><CRDashboard /></PrivateRoute>} />
        {/* CR attends class like a student — reuse existing student pages */}
        <Route path="/cr/scan"           element={<PrivateRoute roles={['cr']}><ScanPage /></PrivateRoute>} />
        <Route path="/cr/my-attendance"  element={<PrivateRoute roles={['cr']}><StudentAttendancePage /></PrivateRoute>} />

        {/* STUDENT */}
        <Route path="/student"               element={<PrivateRoute roles={['student']}><StudentDashboard /></PrivateRoute>} />
        <Route path="/student/attendance"    element={<PrivateRoute roles={['student']}><StudentAttendancePage /></PrivateRoute>} />
        <Route path="/student/classes"       element={<PrivateRoute roles={['student']}><StudentClassesPage /></PrivateRoute>} />
        <Route path="/student/announcements" element={<PrivateRoute roles={['student']}><StudentAnnouncementsPage /></PrivateRoute>} />
        <Route path="/student/scan"          element={<PrivateRoute roles={['student']}><ScanPage /></PrivateRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense></RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0a1225',
              color: '#e2e8f0',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '12px',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#030711' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#030711' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
