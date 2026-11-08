import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { Button, Field, Notice, Spinner } from '../components/ui';
import { ImageIcon } from '../components/icons';
import { api } from '../lib/api';
import { imageUrl } from '../lib/format';
import { shrinkImage } from '../lib/image';
import { haptic } from '../lib/telegram';
import { Toggle } from './Toggle';

interface Settings {
  name: string;
  tagline: string;
  logoKey: string | null;
  color: string;
  currency: string;
  defaultHomeDeliveryFee: number;
  defaultDeskDeliveryFee: number;
  freeShippingOver: number;
  announcement: string;
  whatsapp: string;
  transferInfo: string;
  cloudinaryCloudName: string;
  cloudinaryUploadPreset: string;
  isOpen: boolean;
}

const COLORS = ['#1b6b44', '#0f5c4d', '#1f4fa3', '#8a5233', '#6b3fa0', '#a3202b', '#1d1f24'];

export function SettingsPage() {
  const { reload } = useApp();
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api<{ settings: Settings }>('/admin/settings').then((r) => setForm(r.settings));
  }, []);

  if (!form) return <Spinner />;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm({ ...form, [key]: value });

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set('file', await shrinkImage(file, 512));
      const { key } = await api<{ key: string }>('/admin/images', { form: body });
      setForm((f) => f && { ...f, logoKey: key });
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api('/admin/settings', { method: 'PUT', json: form });
      haptic('success');
      reload();
      setMessage({ tone: 'success', text: 'تم حفظ الإعدادات بنجاح ✅' });
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-xl font-bold">إعدادات المتجر</h1>
        <a
          href="/api/admin/backup/export"
          download={`backup-store-${new Date().toISOString().slice(0, 10)}.json`}
          className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold hover:bg-paper shadow-sm"
        >
          💾 تصدير نسخة احتياطية كاملة (JSON)
        </a>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="flex items-center justify-between card px-4 py-3">
        <span>
          <span className="block font-semibold">استقبال الطلبات</span>
          <span className="text-sm text-muted">أوقفه وقت الإجازات أو عند اكتمال سعة الشحن</span>
        </span>
        <Toggle checked={form.isOpen} onChange={(v) => set('isOpen', v)} label={form.isOpen ? 'مفتوح' : 'مغلق'} />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-4 card p-4">
        <label className="grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border-[1.5px] border-dashed border-line bg-paper text-muted hover:border-brand">
          {uploading ? (
            <span className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : form.logoKey ? (
            <img src={imageUrl(form.logoKey)} alt="الشعار" className="size-full object-contain p-1" />
          ) : (
            <ImageIcon />
          )}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </label>
        <div className="text-sm">
          <p className="font-semibold">شعار المتجر (Logo)</p>
          <p className="text-xs text-muted">صورة مربعة تظهر في الترويسة وأعلى صفحات الهبوط.</p>
          {form.logoKey && (
            <button type="button" className="mt-1 text-xs font-semibold text-rose-600 hover:underline" onClick={() => set('logoKey', null)}>
              إزالة الشعار
            </button>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">هوية المتجر</h2>
        <Field label="اسم المتجر *">
          <input className="field font-semibold" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>

        <Field label="الوصف التعريفي المختصر">
          <input className="field" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </Field>

        <Field label="رمز العملة">
          <input className="field" value={form.currency} onChange={(e) => set('currency', e.target.value)} placeholder="د.ج" />
        </Field>

        <div>
          <label className="block text-xs font-semibold text-muted mb-2">اللون الأساسي للهوية:</label>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={`size-8 rounded-full border-2 transition-transform ${form.color === c ? 'scale-110 border-ink ring-2 ring-brand/30' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
              className="ms-2 size-8 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <Field label="شريط الإعلانات أعلى الموقع">
          <input className="field" value={form.announcement} onChange={(e) => set('announcement', e.target.value)} />
        </Field>
      </div>

      {/* Delivery defaults */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">أسعار التوصيل الافتراضية</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="توصيل للمنزل الافتراضي (د.ج)">
            <input
              type="number"
              className="field font-bold"
              value={form.defaultHomeDeliveryFee ?? ''}
              onChange={(e) => set('defaultHomeDeliveryFee', Number(e.target.value))}
              required
            />
          </Field>

          <Field label="استلام من المكتب الافتراضي (د.ج)">
            <input
              type="number"
              className="field font-bold"
              value={form.defaultDeskDeliveryFee ?? ''}
              onChange={(e) => set('defaultDeskDeliveryFee', Number(e.target.value))}
              required
            />
          </Field>

          <Field label="شحن مجاني للطلبات فوق (0 = معطل)">
            <input
              type="number"
              className="field"
              value={form.freeShippingOver}
              onChange={(e) => set('freeShippingOver', Number(e.target.value))}
            />
          </Field>
        </div>
      </div>

      {/* Cloudinary Integration */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">إعدادات Cloudinary (تخزين الصور المجاني)</h2>
        <p className="text-xs text-muted">
          إذا كان لديك حساب مجاني في Cloudinary، يمكنك وضع بياناته هنا لرفع الصور مباشرة:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cloud Name">
            <input
              className="field"
              placeholder="مثال: my-dz-store"
              value={form.cloudinaryCloudName || ''}
              onChange={(e) => set('cloudinaryCloudName', e.target.value)}
            />
          </Field>
          <Field label="Upload Preset (Unsigned)">
            <input
              className="field"
              placeholder="مثال: store_preset"
              value={form.cloudinaryUploadPreset || ''}
              onChange={(e) => set('cloudinaryUploadPreset', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Contact & BaridiMob */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">معلومات الدفع والتواصل</h2>
        <Field label="رقم الواتساب للتواصل (بدون + أو مسافات)">
          <input className="field" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="0669883179" />
        </Field>

        <Field label="بيانات التحويل عبر بريدي موب (BaridiMob) / CCP">
          <textarea
            className="field min-h-24 resize-y leading-relaxed text-xs sm:text-sm"
            value={form.transferInfo}
            onChange={(e) => set('transferInfo', e.target.value)}
            placeholder="اكتب رقم الحساب البريدي الجاري CCP أو RIP لتطبيق بريدي موب..."
            rows={4}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" tone="brand" size="lg" disabled={saving}>
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </div>
    </form>
  );
}
