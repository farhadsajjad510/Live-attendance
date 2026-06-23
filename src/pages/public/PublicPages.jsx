// ════════════════════════════════════════════════════════════════════════════
// PUBLIC INFORMATION PAGES — About, Contact, Privacy Policy, Terms & Conditions
//
// SAFE ADDITIVE MODULE
//  • Does not import or touch any auth, firestore, attendance, QR, or dashboard code.
//  • Contact form is presentational only — no Firestore writes, no business logic.
//  • Reuses existing design tokens (bg-mesh, card, btn-*, page-title) for visual consistency.
// ════════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Mail, MapPin, Phone, Send, Target, Eye, GraduationCap,
  ShieldCheck, Database, Lock, Users, FileText, AlertCircle,
} from 'lucide-react';
import AppLogo from '../../components/ui/AppLogo';

// ─── Shared chrome (nav + footer) for all public pages ───────────────────────
const PUBLIC_LINKS = [
  { to: '/about',   label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms',   label: 'Terms & Conditions' },
];

function PublicShell({ children, eyebrow, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <div className="fixed inset-0 bg-mesh bg-grid pointer-events-none opacity-60" />

      {/* Navbar — matches LandingPage navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3">
          <AppLogo size={36} />
          <span className="text-lg font-bold" style={{ fontFamily: 'Syne,sans-serif' }}>Live Attendance</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost btn-sm text-sm">Sign In</Link>
          <Link to="/signup" className="btn-primary btn-sm text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Page header */}
      <header className="relative z-10 px-6 pt-10 pb-12 max-w-4xl mx-auto text-center page-in">
        <Link to="/" className="inline-flex items-center gap-1.5 text-white/35 hover:text-white/60 text-xs mb-6 transition-colors">
          <ArrowLeft size={13} /> Back to Home
        </Link>
        {eyebrow && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-semibold text-blue-300"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', fontFamily: 'Syne,sans-serif' }}>
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ fontFamily: 'Syne,sans-serif' }}>{title}</h1>
        {subtitle && <p className="text-white/40 max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
      </header>

      {/* Page body */}
      <main className="relative z-10 px-6 pb-20 max-w-4xl mx-auto">
        {children}
      </main>

      {/* Footer — shared across all public pages */}
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.05] py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
        <p className="text-white/20 text-sm">
          <span className="font-semibold text-white/30" style={{ fontFamily: 'Syne,sans-serif' }}>Live Attendance</span>
          {' '}· Powered by <span className="text-blue-400/60">FarhadAIStudio</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {PUBLIC_LINKS.map(l => (
            <Link key={l.to} to={l.to} className="text-white/30 hover:text-white/60 text-xs transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ABOUT US
// ════════════════════════════════════════════════════════════════════════════
export function AboutPage() {
  return (
    <PublicShell
      eyebrow="About Us"
      title="Built for modern educational institutions"
      subtitle="Live Attendance is a real-time attendance management platform purpose-built for schools, colleges, and universities."
    >
      <div className="space-y-5">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap size={18} className="text-blue-400" />
            <h2 className="section-title">What We Do</h2>
          </div>
          <p className="text-sm text-white/55 leading-relaxed">
            Live Attendance helps educational institutions replace manual roll-calls and paper registers with
            QR-based, GPS-verified attendance tracking. Chairmen set up departments, teachers run live attendance
            sessions, and students and class representatives mark attendance in seconds — all backed by real-time
            reports that everyone can trust.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="card p-6">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center mb-4">
              <Eye size={19} className="text-blue-400" />
            </div>
            <h3 className="font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Our Vision</h3>
            <p className="text-sm text-white/45 leading-relaxed">
              A world where every institution — regardless of size or budget — has access to accurate, transparent,
              and effortless attendance tracking that lets educators focus on teaching, not paperwork.
            </p>
          </div>
          <div className="card p-6">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center mb-4">
              <Target size={19} className="text-cyan-400" />
            </div>
            <h3 className="font-bold text-white mb-2" style={{ fontFamily: 'Syne,sans-serif' }}>Our Mission</h3>
            <p className="text-sm text-white/45 leading-relaxed">
              To give every department, teacher, and student a fast, reliable, and fair way to record and view
              attendance — with role-based access that keeps data accurate and accountable at every level.
            </p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title mb-3">Why Educational Institutions Choose Us</h2>
          <ul className="space-y-2.5 text-sm text-white/55">
            <li className="flex items-start gap-2.5"><span className="text-blue-400 mt-0.5">•</span>Live, GPS-verified QR attendance that's hard to fake</li>
            <li className="flex items-start gap-2.5"><span className="text-blue-400 mt-0.5">•</span>Dedicated dashboards for Owner, Chairman, Teacher, CR, and Student roles</li>
            <li className="flex items-start gap-2.5"><span className="text-blue-400 mt-0.5">•</span>Instant reports — daily, monthly, and subject-wise — exportable to PDF/Excel</li>
            <li className="flex items-start gap-2.5"><span className="text-blue-400 mt-0.5">•</span>Built to scale from a single classroom to an entire university</li>
          </ul>
        </div>
      </div>
    </PublicShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONTACT US
// Presentational only — no backend call, no Firestore write, no effect on
// existing system logic. Submitting simply confirms receipt to the user.
// ════════════════════════════════════════════════════════════════════════════
export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Please fill in your name, email, and message.');
      return;
    }
    setSending(true);
    // NOTE: presentational only by design — does not write to Firestore or
    // call any existing business logic. Wire this up to a support inbox /
    // backend endpoint later if needed.
    setTimeout(() => {
      setSending(false);
      toast.success("Message received — we'll get back to you soon.");
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 600);
  }

  return (
    <PublicShell
      eyebrow="Contact Us"
      title="We'd love to hear from you"
      subtitle="Questions, feedback, or support requests — reach out and our team will get back to you."
    >
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 lg:col-span-3 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" placeholder="How can we help?" value={form.subject} onChange={set('subject')} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input" rows={5} placeholder="Write your message…" value={form.message} onChange={set('message')} required />
          </div>
          <button type="submit" disabled={sending} className="btn-primary w-full sm:w-auto">
            <Send size={14} /> {sending ? 'Sending…' : 'Send Message'}
          </button>
        </form>

        {/* Contact info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <h3 className="font-bold text-white mb-4" style={{ fontFamily: 'Syne,sans-serif' }}>Get in Touch</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <Mail size={15} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-white/35 mb-0.5">Support Email</p>
                  <p className="text-sm text-white/70">sajjad.ali.9u5y@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center flex-shrink-0">
                  <Phone size={15} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-white/35 mb-0.5">Phone</p>
                  <p className="text-sm text-white/70">+92 3XX XXXXXXX</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center flex-shrink-0">
                  <MapPin size={15} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-white/35 mb-0.5">Location</p>
                  <p className="text-sm text-white/70">Pakistan</p>
                </div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <p className="text-xs text-white/35 leading-relaxed">
              For urgent account or attendance issues, please contact your department's Chairman or your
              institution's platform Owner directly — they can resolve most issues faster than email support.
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PRIVACY POLICY
// ════════════════════════════════════════════════════════════════════════════
export function PrivacyPolicyPage() {
  // NOTE: Tailwind classes are written out in full (not interpolated) below,
  // since Tailwind's JIT compiler cannot detect dynamically-built class names.
  const COLOR_STYLES = {
    blue:    { box: 'bg-blue-500/10 border-blue-500/15',       icon: 'text-blue-400' },
    cyan:    { box: 'bg-cyan-500/10 border-cyan-500/15',       icon: 'text-cyan-400' },
    emerald: { box: 'bg-emerald-500/10 border-emerald-500/15', icon: 'text-emerald-400' },
    purple:  { box: 'bg-purple-500/10 border-purple-500/15',   icon: 'text-purple-400' },
    amber:   { box: 'bg-amber-500/10 border-amber-500/15',     icon: 'text-amber-400' },
  };

  const sections = [
    {
      icon: Database, color: 'blue', title: '1. Information We Collect',
      body: `We collect the information you provide directly — name, email address, role (Owner, Chairman, Teacher, CR, or
      Student), and department affiliation. When you mark or take attendance, we also collect a timestamp and, where
      required for verification, your device's GPS location at the moment attendance is recorded.`,
    },
    {
      icon: Lock, color: 'cyan', title: '2. How We Store Your Data',
      body: `All data is stored securely using Firebase Authentication and Cloud Firestore. Access to data is
      restricted by role-based security rules — meaning a student can only see their own records, while a Chairman
      can see their department's records, and platform-level data is restricted to the Owner account.`,
    },
    {
      icon: ShieldCheck, color: 'emerald', title: '3. Our Privacy Commitments',
      body: `We do not sell, rent, or share your personal data with third parties for advertising purposes. Data is
      used solely to operate attendance tracking, generate reports for your institution, and maintain the security
      and integrity of the platform.`,
    },
    {
      icon: Users, color: 'purple', title: '4. Attendance Data Handling',
      body: `Attendance records (including timestamps and location data used for verification) are visible only to
      authorized roles within your own department — your Teacher, CR, and Chairman — and to the platform Owner for
      administrative and audit purposes. Students can view their own attendance history at any time from their
      dashboard.`,
    },
    {
      icon: AlertCircle, color: 'amber', title: '5. Data Retention & Deletion',
      body: `Your data is retained for as long as your account remains active within your institution's department.
      You may request account or data deletion at any time through the in-app account deletion request feature,
      which is reviewed by your department or platform administrators.`,
    },
  ];

  return (
    <PublicShell
      eyebrow="Privacy Policy"
      title="Your privacy matters to us"
      subtitle="This policy explains what information we collect, how it's stored, and how it's used across the platform."
    >
      <div className="space-y-4">
        <p className="text-xs text-white/30 text-center -mt-2 mb-2">Last updated: June 2026</p>
        {sections.map(({ icon: Icon, color, title, body }) => (
          <div key={title} className="card p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${COLOR_STYLES[color].box}`}>
                <Icon size={16} className={COLOR_STYLES[color].icon} />
              </div>
              <h2 className="section-title">{title}</h2>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">{body}</p>
          </div>
        ))}
        <div className="card p-5" style={{ background: 'rgba(59,130,246,0.05)' }}>
          <p className="text-xs text-white/40 leading-relaxed">
            Questions about this policy? Reach out via our <Link to="/contact" className="text-blue-400 hover:text-blue-300">Contact Us</Link> page.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TERMS & CONDITIONS
// ════════════════════════════════════════════════════════════════════════════
export function TermsPage() {
  const sections = [
    {
      title: '1. User Responsibilities',
      body: `Each user is responsible for keeping their login credentials confidential and for all activity that
      occurs under their account. You agree to provide accurate information when creating or updating your profile.`,
    },
    {
      title: '2. Account Usage Rules',
      body: `Accounts are role-specific (Owner, Chairman, Teacher, CR, or Student) and must only be used for their
      intended purpose within your institution's department. Creating duplicate accounts, impersonating another
      user, or attempting to access another department's data without authorization is strictly prohibited.`,
    },
    {
      title: '3. Attendance Policy',
      body: `Attendance marked through the platform — whether via QR scan or manual entry by an authorized role — is
      treated as the official record for your department. Attempting to falsify attendance, share QR codes to mark
      attendance on another student's behalf, or spoof GPS location is a violation of these terms and may result in
      account suspension.`,
    },
    {
      title: '4. Platform Usage Guidelines',
      body: `The platform must be used lawfully and in good faith. Institutions and their administrators (Chairman,
      Owner) are responsible for managing their own department's users, approvals, and data within the roles and
      permissions provided by the platform.`,
    },
    {
      title: '5. Changes to These Terms',
      body: `We may update these Terms & Conditions from time to time to reflect platform changes. Continued use of
      the platform after updates constitutes acceptance of the revised terms.`,
    },
  ];

  return (
    <PublicShell
      eyebrow="Terms & Conditions"
      title="Terms of using Live Attendance"
      subtitle="Please read these terms carefully before using the platform."
    >
      <div className="space-y-4">
        <p className="text-xs text-white/30 text-center -mt-2 mb-2">Last updated: June 2026</p>
        {sections.map(({ title, body }) => (
          <div key={title} className="card p-6">
            <div className="flex items-center gap-2 mb-2.5">
              <FileText size={15} className="text-blue-400 flex-shrink-0" />
              <h2 className="section-title">{title}</h2>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">{body}</p>
          </div>
        ))}
        <div className="card p-5" style={{ background: 'rgba(59,130,246,0.05)' }}>
          <p className="text-xs text-white/40 leading-relaxed">
            Questions about these terms? Reach out via our <Link to="/contact" className="text-blue-400 hover:text-blue-300">Contact Us</Link> page.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
