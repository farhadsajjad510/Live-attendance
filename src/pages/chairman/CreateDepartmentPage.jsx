import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { createDepartment, updateUserProfile } from '../../firebase/firestore';
import { generateCode } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Building2, Loader2, QrCode } from 'lucide-react';

export default function CreateDepartmentPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', institution: '', description: '', city: '', country: 'Pakistan',
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.institution.trim()) {
      toast.error('Department name and institution are required');
      return;
    }
    setSaving(true);
    try {
      const inviteCode = generateCode(6);
      const qrCode = generateCode(12);
      const deptId = await createDepartment({
        ...form,
        inviteCode,
        qrCode,
        chairmanName: profile.displayName,
        chairmanEmail: profile.email,
      }, profile.uid);

      // Update chairman's profile with deptId
      await updateUserProfile(profile.uid, {
        departmentId: deptId,
        departmentName: form.name,
        departmentRole: 'chairman',
        status: 'approved',
      });

      await refreshProfile();
      toast.success('Department created successfully!');
      navigate('/chairman');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="page-in max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-cyan-500/12 border border-cyan-500/20">
            <Building2 size={22} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="page-title">Create Department</h1>
            <p className="page-sub">Set up your institution's department</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="label">Department Name *</label>
            <input className="input" placeholder="e.g. Physics Department, Computer Science Dept"
              value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="label">Institution Name *</label>
            <input className="input" placeholder="e.g. University of Punjab, KIPS College"
              value={form.institution} onChange={set('institution')} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3}
              placeholder="Brief description of this department..."
              value={form.description} onChange={set('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="e.g. Lahore" value={form.city} onChange={set('city')} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country} onChange={set('country')} />
            </div>
          </div>

          {/* What will be generated */}
          <div className="p-4 rounded-xl space-y-2" style={{background:'rgba(6,182,212,0.07)',border:'1px solid rgba(6,182,212,0.15)'}}>
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Auto-Generated on Create</p>
            <div className="flex gap-4 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><QrCode size={11}/> Department QR Code</span>
              <span className="flex items-center gap-1.5">🔑 Unique Invite Code</span>
              <span className="flex items-center gap-1.5">🆔 Department ID</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => navigate('/chairman')}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Creating…' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
