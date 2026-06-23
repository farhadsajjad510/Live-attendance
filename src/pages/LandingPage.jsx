import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Shield, BarChart3, Users, Building2, CheckCircle, ArrowRight, GraduationCap, BookOpen, Download } from 'lucide-react';

// PWA install button — shows only when Android Chrome fires beforeinstallprompt
function InstallButton() {
  const [ready, setReady] = useState(!!window.__pwaInstallPrompt);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    const onInstalled = () => { setReady(false); setInstalled(true); };
    window.addEventListener('pwaInstallReady', onReady);
    window.addEventListener('pwaInstalled', onInstalled);
    return () => {
      window.removeEventListener('pwaInstallReady', onReady);
      window.removeEventListener('pwaInstalled', onInstalled);
    };
  }, []);

  if (installed) return (
    <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
      <CheckCircle size={16}/> Installed!
    </div>
  );

  if (!ready) return null;

  async function handleInstall() {
    const prompt = window.__pwaInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') window.__pwaInstallPrompt = null;
  }

  return (
    <button onClick={handleInstall}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
      style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)', color: '#93c5fd' }}>
      <Download size={15}/> Install App
    </button>
  );
}

const FEATURES = [
  { icon: Building2,    title: 'Department System',    desc: 'Any institution creates departments with unique QR codes and invite links.' },
  { icon: QrCode,       title: 'Live QR Attendance',   desc: 'Two modes: students scan teacher QR, or teacher scans student QR. GPS-verified.' },
  { icon: Shield,       title: 'Role-Based Access',    desc: '5 roles: Owner, Chairman, Teacher, CR, and Student — each with their own dashboard.' },
  { icon: BarChart3,    title: 'Reports & Analytics',  desc: 'Daily, monthly, subject-wise reports. Export to PDF and Excel instantly.' },
  { icon: Users,        title: 'Student Management',   desc: 'Manage enrollments, programs, semesters, and auto-track attendance percentages.' },
  { icon: BookOpen,     title: 'Subject Management',   desc: 'Chairman creates subjects per program/semester. Teachers select from assigned list.' },
];

const ROLES = [
  { role:'Chairman', color:'text-cyan-400',   desc:'Create dept, manage teachers & students, approve requests, view all reports.' },
  { role:'Teacher',  color:'text-blue-400',   desc:'Take attendance with live QR sessions, view assigned classes and reports.' },
  { role:'CR',       color:'text-amber-400',  desc:'Assist attendance scanning, view announcements and class schedules.' },
  { role:'Student',  color:'text-emerald-400',desc:'View own attendance history, percentages, and class announcements.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030711] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 bg-mesh bg-grid pointer-events-none opacity-60" />
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/4 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
            <span className="text-sm font-bold" style={{fontFamily:'Syne,sans-serif'}}>LA</span>
          </div>
          <span className="text-lg font-bold" style={{fontFamily:'Syne,sans-serif'}}>Live Attendance</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost btn-sm text-sm">Sign In</Link>
          <Link to="/signup" className="btn-primary btn-sm text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold text-blue-300"
          style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',fontFamily:'Syne,sans-serif'}}>
          <div className="dot-live" />
          Real-time Attendance · GPS Verified · Role-Based
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6" style={{fontFamily:'Syne,sans-serif'}}>
          Smart Attendance{' '}
          <span className="text-transparent bg-clip-text" style={{backgroundImage:'linear-gradient(135deg,#3b82f6,#06b6d4)'}}>
            for Education
          </span>
        </h1>
        <p className="text-lg text-white/45 mb-10 max-w-2xl mx-auto leading-relaxed">
          A complete education management platform for universities, colleges, schools and academies.
          Live QR attendance, multi-role dashboards, and real-time analytics.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup" className="btn-primary px-8 py-3.5 text-base flex items-center gap-2 justify-center">
            Create Department Free <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn-secondary px-8 py-3.5 text-base">
            Sign In
          </Link>
          <InstallButton />
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 pt-10 border-t border-white/[0.06]">
          {[['5 Roles','Owner to Student'],['2 Scan Modes','QR Flexibility'],['GPS Verify','Location Security'],['Real-time','Live Sync']].map(([v,l])=>(
            <div key={v} className="text-center">
              <div className="text-2xl font-bold text-white num" style={{fontFamily:'Syne,sans-serif'}}>{v}</div>
              <div className="text-xs text-white/35 mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3" style={{fontFamily:'Syne,sans-serif'}}>Everything You Need</h2>
          <p className="text-white/40 max-w-xl mx-auto">Built for educational institutions of all sizes — from single classrooms to entire universities.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6 group hover:border-blue-500/25 transition-all">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center mb-4 group-hover:border-blue-500/30 transition-colors">
                <Icon size={20} className="text-blue-400" />
              </div>
              <h3 className="font-bold text-white mb-2" style={{fontFamily:'Syne,sans-serif'}}>{title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles section */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3" style={{fontFamily:'Syne,sans-serif'}}>5-Role System</h2>
          <p className="text-white/40">Every person gets exactly the access they need — nothing more, nothing less.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map(({ role, color, desc }) => (
            <div key={role} className="card p-5">
              <div className={`text-lg font-bold mb-2 ${color}`} style={{fontFamily:'Syne,sans-serif'}}>{role}</div>
              <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3" style={{fontFamily:'Syne,sans-serif'}}>How Attendance Works</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            {
              mode:'Mode 1 — Student Scans',
              steps:['Teacher starts live session','QR code generated on screen','Students scan QR with phone','GPS + time verified instantly'],
              color:'border-blue-500/20', iconBg:'bg-blue-500/10', icon:'text-blue-400',
            },
            {
              mode:'Mode 2 — Teacher Scans',
              steps:['Teacher starts live session','Each student shows their QR','Teacher/CR scans student QR','Attendance marked in real-time'],
              color:'border-cyan-500/20', iconBg:'bg-cyan-500/10', icon:'text-cyan-400',
            },
          ].map(({ mode, steps, color, iconBg, icon }) => (
            <div key={mode} className={`card border ${color} p-6`}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold mb-4 ${iconBg} ${icon}`}
                style={{fontFamily:'Syne,sans-serif'}}>
                <QrCode size={12} />{mode}
              </div>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${iconBg} ${icon}`}
                      style={{fontFamily:'Syne,sans-serif'}}>{i+1}</div>
                    <span className="text-sm text-white/60">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto card p-12 border-blue-500/15" style={{background:'rgba(59,130,246,0.05)'}}>
          <h2 className="text-3xl font-bold mb-4" style={{fontFamily:'Syne,sans-serif'}}>Ready to get started?</h2>
          <p className="text-white/40 mb-8">Create your department in minutes. Free to use.</p>
          <Link to="/signup" className="btn-primary px-10 py-3.5 text-base inline-flex items-center gap-2">
            Create Your Department <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <p className="text-white/20 text-sm">
            <span className="font-semibold text-white/30" style={{fontFamily:'Syne,sans-serif'}}>Live Attendance</span>
            {' '}· Powered by <span className="text-blue-400/60">FarhadAIStudio</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link to="/about" className="text-white/30 hover:text-white/60 text-xs transition-colors">About Us</Link>
            <Link to="/contact" className="text-white/30 hover:text-white/60 text-xs transition-colors">Contact Us</Link>
            <Link to="/privacy" className="text-white/30 hover:text-white/60 text-xs transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-white/30 hover:text-white/60 text-xs transition-colors">Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
