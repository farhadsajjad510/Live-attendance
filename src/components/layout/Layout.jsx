import { useState, memo, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/index.jsx';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Building2, Users, BookOpen, QrCode,
  BarChart3, Settings, LogOut, Menu, X, Bell, GraduationCap,
  UserCheck, ChevronDown, Shield, Megaphone, ClipboardList,
  BookMarked, UserCog, Layers, Trash2,
} from 'lucide-react';

// Role-based nav configs
const NAV = {
  owner: [
    { to: '/owner',             icon: LayoutDashboard, label: 'Overview' },
    { to: '/owner/departments', icon: Building2,        label: 'Departments' },
    { to: '/owner/users',       icon: Users,            label: 'All Users' },
    { to: '/owner/analytics',   icon: BarChart3,        label: 'Analytics'   },
    { to: '/owner/audit',       icon: Shield,           label: 'Audit Logs'  },
  ],
  chairman: [
    { to: '/chairman',              icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/chairman/teachers',     icon: UserCheck,       label: 'Teachers' },
    { to: '/chairman/students',     icon: GraduationCap,   label: 'Students' },
    // V1.9 stabilization (Phase 3/Bug 4): the old Programs/Subjects/Classes
    // pages were a disconnected, parallel academic system that duplicated and
    // conflicted with Academic Structure (Department→Level→Class→Semester→Subject).
    // Academic Structure is now the single, central hierarchy management page.
    // The old routes still exist (for any historical data) but are no longer
    // linked from the sidebar to avoid duplicate/cluttered navigation.
    { to: '/chairman/academic',      icon: Layers,          label: 'Academic Structure' },
    { to: '/chairman/promotions',    icon: GraduationCap,   label: 'Promotions & Alerts' },
    { to: '/chairman/activity',      icon: ClipboardList,   label: 'Activity Log' },
    { to: '/chairman/assignments',  icon: UserCog,         label: 'Assignments' },
    { to: '/chairman/attendance',   icon: QrCode,          label: 'Attendance' },
    { to: '/chairman/reports',      icon: BarChart3,       label: 'Reports' },
    { to: '/chairman/announcements',icon: Megaphone,       label: 'Announcements' },
  ],
  teacher: [
    { to: '/teacher',             icon: LayoutDashboard, label: 'Dashboard'      },
    { to: '/teacher/departments', icon: Building2,       label: 'My Departments' },
    { to: '/teacher/classes',     icon: BookOpen,        label: 'My Classes' },
    { to: '/teacher/attendance',  icon: QrCode,          label: 'Take Attendance' },
    { to: '/teacher/reports',     icon: BarChart3,       label: 'Reports' },
  ],
  cr: [
    { to: '/cr',              icon: LayoutDashboard, label: 'Dashboard'       },
    { to: '/cr/scan',         icon: QrCode,          label: 'Scan QR'         },
    { to: '/cr/my-attendance',icon: ClipboardList,   label: 'My Attendance'   },
    { to: '/cr/attendance',   icon: Users,           label: 'Take Attendance' },
    { to: '/cr/announcements',icon: Megaphone,       label: 'Announcements'   },
  ],
  student: [
    { to: '/student',             icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/attendance',  icon: ClipboardList,   label: 'My Attendance' },
    { to: '/student/classes',     icon: BookOpen,        label: 'My Classes' },
    { to: '/student/announcements',icon: Megaphone,      label: 'Announcements' },
  ],
};

const ROLE_COLORS = {
  owner:    { badge:'badge-purple', dot:'bg-purple-400' },
  chairman: { badge:'badge-cyan',   dot:'bg-cyan-400'   },
  teacher:  { badge:'badge-blue',   dot:'bg-blue-400'   },
  cr:       { badge:'badge-amber',  dot:'bg-amber-400'  },
  student:  { badge:'badge-green',  dot:'bg-emerald-400'},
};

const ROLE_LABELS = {
  owner:'Platform Owner', chairman:'Chairman', teacher:'Teacher', cr:'Class Rep', student:'Student',
};

// Memoized nav item — prevents all nav links re-rendering when route changes
const NavItem = memo(function NavItem({ item, role, onClose }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      end={item.to === `/${role}`}
      className={({ isActive }) =>
        `nav-link ${isActive ? 'nav-link-active' : ''}`
      }
      style={{ '--hover-bg': 'rgba(59,130,246,0.08)' }}
    >
      <item.icon size={15} />
      <span>{item.label}</span>
    </NavLink>
  );
});

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role || 'student';
  const navItems = NAV[role] || NAV.student;
  const rc = ROLE_COLORS[role] || ROLE_COLORS.student;

  async function handleLogout() {
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'#030711'}}>
      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          style={{ isolation: 'isolate', transform: 'translateZ(0)', willChange: 'transform' }}
          onClick={()=>setOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────── */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-64 flex flex-col
        sidebar-bg transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
              <span className="text-xs font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>LA</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none" style={{fontFamily:'Syne,sans-serif'}}>Live Attendance</div>
              <div className="text-[10px] text-white/25 mt-0.5">FarhadAIStudio</div>
            </div>
          </div>
          <button onClick={()=>setOpen(false)} className="lg:hidden btn-icon p-1.5">
            <X size={13} className="text-white/40" />
          </button>
        </div>

        {/* User info */}
        <div className="px-3 py-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <Avatar name={profile?.displayName || ''} size={8} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate" style={{fontFamily:'Syne,sans-serif'}}>
                {profile?.displayName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                <span className="text-[10px] text-white/40">{ROLE_LABELS[role]}</span>
              </div>
            </div>
          </div>
          {/* Dept name for non-owners */}
          {profile?.departmentName && (
            <div className="mt-2 px-3 py-1.5 rounded-lg text-[10px] text-white/35" style={{background:'rgba(255,255,255,0.03)'}}>
              <Building2 size={9} className="inline mr-1 opacity-50" />
              {profile.departmentName}
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to.split('/').length <= 2}
              onClick={()=>setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={15} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2.5 border-t border-white/[0.05] space-y-0.5">
          <NavLink to={`/${role}/settings`} onClick={()=>setOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={15} /><span>Settings</span>
          </NavLink>
          <button onClick={handleLogout} className="nav-link w-full text-red-400/60 hover:text-red-400" style={{'--hover-bg':'rgba(239,68,68,0.08)'}}>
            <LogOut size={15} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center px-4 gap-3 border-b border-white/[0.05] flex-shrink-0"
          style={{
            background: 'rgba(3,7,17,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            // Force this blurred element onto its own isolated GPU compositing
            // layer. Without this, Chrome on Android can share a compositing
            // tile between this backdrop-filter layer and the adjacent
            // scrolling <main> content below it — on some Android GPU/driver
            // combinations that shared-tile recompositing corrupts during
            // scroll, producing the horizontal noise/garbage bands seen in
            // the screenshots. Isolating the layer prevents that bleed.
            isolation: 'isolate',
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}>
          <button onClick={()=>setOpen(true)} className="lg:hidden btn-icon p-2">
            <Menu size={17} className="text-white/50" />
          </button>
          <div className="flex-1" />
          {/* Approval status warning */}
          {profile?.status === 'pending' && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg text-xs text-amber-400"
              style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)'}}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Pending approval
            </div>
          )}
          <button className="btn-icon p-2 relative">
            <Bell size={15} className="text-white/40" />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
