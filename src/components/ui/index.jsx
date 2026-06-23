// ─── Shared UI Primitives ─────────────────────────────────────────────────────
import { useEffect } from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

/* ── Modal ─────────────────────────────────────── */
export function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  const w = { sm:'max-w-md', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        style={{ isolation: 'isolate', transform: 'translateZ(0)', willChange: 'transform' }}
        onClick={onClose}
      />
      <div className={`relative w-full ${w} glass-dark border border-white/10 shadow-2xl page-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="section-title">{title}</h2>
          <button onClick={onClose} className="btn-icon"><X size={15} className="text-white/50" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ────────────────────────────── */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${danger ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            <AlertTriangle size={18} className={danger ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <p className="text-sm text-white/65 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button
            className={`${danger ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={() => { onConfirm(); onClose(); }}
          >Confirm</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Empty State ───────────────────────────────── */
export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center mb-4">
          <Icon size={24} className="text-blue-400/50" />
        </div>
      )}
      <p className="text-base font-semibold text-white/60 mb-1" style={{fontFamily:'Syne,sans-serif'}}>{title}</p>
      {desc && <p className="text-sm text-white/35 mb-5 max-w-xs">{desc}</p>}
      {action}
    </div>
  );
}

/* ── Stats Card ────────────────────────────────── */
export function StatsCard({ icon: Icon, label, value, sub, color = 'blue', trend }) {
  const c = {
    blue:   { bg:'bg-blue-500/10',   border:'border-blue-500/20',   icon:'text-blue-400',   val:'text-blue-300'   },
    green:  { bg:'bg-emerald-500/10',border:'border-emerald-500/20',icon:'text-emerald-400',val:'text-emerald-300' },
    amber:  { bg:'bg-amber-500/10',  border:'border-amber-500/20',  icon:'text-amber-400',  val:'text-amber-300'  },
    red:    { bg:'bg-red-500/10',    border:'border-red-500/20',    icon:'text-red-400',    val:'text-red-300'    },
    purple: { bg:'bg-purple-500/10', border:'border-purple-500/20', icon:'text-purple-400', val:'text-purple-300' },
    cyan:   { bg:'bg-cyan-500/10',   border:'border-cyan-500/20',   icon:'text-cyan-400',   val:'text-cyan-300'   },
  }[color] || {};
  return (
    <div className={`stat-card border ${c.border}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl ${c.bg} border ${c.border}`}>
          <Icon size={18} className={c.icon} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className={`text-2xl font-bold num ${c.val}`} style={{fontFamily:'Syne,sans-serif'}}>{value}</div>
        <div className="text-xs text-white/40">{label}</div>
        {sub && <div className="text-[11px] text-white/25 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Page Header ───────────────────────────────── */
export function PageHeader({ title, sub, breadcrumb, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        {breadcrumb && <p className="text-[10px] text-white/25 uppercase tracking-widest mb-0.5">{breadcrumb}</p>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ── Loading Screen ────────────────────────────── */
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#030711] bg-mesh bg-grid flex flex-col items-center justify-center z-50">
      <div className="absolute w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse top-1/4 left-1/4" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-300 neon" style={{fontFamily:'Syne,sans-serif'}}>LA</span>
          </div>
          <div className="absolute inset-0 rounded-2xl border border-blue-400/20 animate-ping" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white" style={{fontFamily:'Syne,sans-serif'}}>Live Attendance</h1>
          <p className="text-white/30 text-xs mt-0.5">Education Management Platform</p>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400"
              style={{animation:`bounce 1.1s ease-in-out ${i*0.18}s infinite`}} />
          ))}
        </div>
      </div>
      <p className="absolute bottom-6 text-white/15 text-xs">Powered by FarhadAIStudio</p>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:0.4}40%{transform:translateY(-8px);opacity:1}}`}</style>
    </div>
  );
}

/* ── Avatar ────────────────────────────────────── */
export function Avatar({ name = '', size = 8, bg }) {
  const ini = (name || '').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
  const palette = ['#0e7dff','#a855f7','#10d97e','#f59e0b','#ef4444','#06b6d4'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i)+((h<<5)-h);
  const color = bg || palette[Math.abs(h)%palette.length];
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold`}
      style={{backgroundColor: color, fontSize: size <= 7 ? '11px' : '13px', fontFamily:'Syne,sans-serif'}}>
      {ini}
    </div>
  );
}

/* ── Skeleton Loader ───────────────────────────── */
export function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}
