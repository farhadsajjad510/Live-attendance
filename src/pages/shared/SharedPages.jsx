import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#030711] bg-mesh flex items-center justify-center p-6">
      <div className="text-center page-in">
        <div className="w-20 h-20 rounded-2xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-amber-400" />
        </div>
        <h1 className="text-6xl font-bold text-white neon mb-2" style={{fontFamily:'Syne,sans-serif'}}>404</h1>
        <h2 className="text-xl font-semibold text-white/60 mb-2" style={{fontFamily:'Syne,sans-serif'}}>Page Not Found</h2>
        <p className="text-white/35 text-sm mb-8 max-w-xs mx-auto">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <Home size={15} /> Back to Home
        </Link>
        <p className="text-white/15 text-xs mt-8">Powered by FarhadAIStudio</p>
      </div>
    </div>
  );
}
