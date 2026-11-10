import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { Button, Field, Notice } from '../components/ui';
import { ImageIcon, PlusIcon, TrashIcon } from '../components/icons';
import { api } from '../lib/api';
import { imageUrl } from '../lib/format';
import { shrinkImage } from '../lib/image';
import { confirmAction, haptic } from '../lib/telegram';
import type { Banner } from '../types';
import { titleSizeClass, subtitleSizeClass, buttonRadiusClass, titleStyle, subtitleStyle, buttonStyle } from '../shop/Home';

type Draft = Omit<Banner, 'id' | 'sort'> & { id?: number };
const EMPTY: Draft = {
  imageKey: '',
  title: '', titleColor: '#ffffff', titleBg: '', titleBgOpacity: 100, titleBorderColor: '', titleBorderWidth: 0, titleFontSize: '', titleTextStrokeColor: '', titleTextStrokeWidth: 0,
  subtitle: '', subtitleColor: '#ffffff', subtitleBg: '', subtitleBgOpacity: 100, subtitleBorderColor: '', subtitleBorderWidth: 0, subtitleFontSize: '', subtitleTextStrokeColor: '', subtitleTextStrokeWidth: 0,
  buttonText: '', buttonBgColor: '#ffffff', buttonBgOpacity: 100, buttonTextColor: '#1a1a1a', buttonBorderColor: '', buttonBorderWidth: 0, buttonRadius: '', buttonTextStrokeColor: '', buttonTextStrokeWidth: 0,
  link: '',
};

export function BannersPage() {
  const { data, reload } = useApp();
  const banners = data!.banners;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const move = (index: number, by: -1 | 1) => {
    const ids = banners.map((b) => b.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    run(() => api('/admin/banners/order', { json: { ids } }));
  };

  if (draft) return <BannerForm draft={draft} onDone={() => (setDraft(null), reload())} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">البنرات</h1>
          <p className="text-sm text-muted">الصور المتحركة أعلى الصفحة الرئيسية.</p>
        </div>
        <button onClick={() => setDraft(EMPTY)} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 font-semibold text-on-brand">
          <PlusIcon width={18} height={18} /> بنر جديد
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {banners.length === 0 ? (
        <p className="py-16 text-center text-muted">لا توجد بنرات. أضف بنراً لعرض عروضك في أعلى المتجر.</p>
      ) : (
        <ul className="space-y-3">
          {banners.map((banner, i) => (
            <li key={banner.id} className="card flex items-center gap-3 p-2.5">
              <button onClick={() => setDraft(banner)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <img src={imageUrl(banner.imageKey)} alt="" className="aspect-[3/1] w-36 shrink-0 rounded-lg object-cover object-left sm:w-48" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{banner.title || 'بدون عنوان'}</span>
                  <span className="block truncate text-sm text-muted">{banner.subtitle}</span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col sm:flex-row">
                <IconButton label="تحريك لأعلى" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </IconButton>
                <IconButton label="تحريك لأسفل" disabled={i === banners.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </IconButton>
                <IconButton
                  label="حذف البنر"
                  danger
                  onClick={async () => {
                    if (await confirmAction('حذف هذا البنر؟')) run(() => api(`/admin/banners/${banner.id}`, { method: 'DELETE' }));
                  }}
                >
                  <TrashIcon width={18} height={18} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconButton({ label, danger, disabled, onClick, children }: { label: string; danger?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-lg disabled:opacity-30 ${danger ? 'text-danger hover:bg-danger/10' : 'hover:bg-ink/5'}`}
    >
      {children}
    </button>
  );
}

function BannerForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const { data } = useApp();
  const [form, setForm] = useState(draft);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', await shrinkImage(file, 1800));
      const { key } = await api<{ key: string }>('/admin/images', { form: body });
      set('imageKey', key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(form.id ? `/admin/banners/${form.id}` : '/admin/banners', { method: form.id ? 'PUT' : 'POST', json: form });
      haptic('success');
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold">{form.id ? 'تعديل البنر' : 'بنر جديد'}</h1>
      <label className="relative block aspect-[3/1] cursor-pointer overflow-hidden rounded-2xl border border-dashed border-line bg-card hover:border-brand">
        {form.imageKey ? (
          <>
            <img src={imageUrl(form.imageKey)} alt="" className="absolute inset-0 size-full object-cover object-left" />
            {(form.title || form.subtitle || form.buttonText) && (
              <div className="pointer-events-none absolute inset-y-0 start-0 flex w-[55%] flex-col justify-center gap-2 ps-5 md:w-1/2 md:gap-3 md:ps-14">
                {form.title && (
                  <p className={`${titleSizeClass(form.titleFontSize)} font-bold leading-tight drop-shadow`} style={titleStyle(form)}>
                    {form.title}
                  </p>
                )}
                {form.subtitle && (
                  <p className={`${subtitleSizeClass(form.subtitleFontSize)} leading-relaxed`} style={subtitleStyle(form)}>
                    {form.subtitle}
                  </p>
                )}
                {form.buttonText && (
                  <span className={`mt-1 inline-flex w-fit px-3.5 py-2 text-[13px] font-semibold md:px-5 md:py-2.5 md:text-base ${buttonRadiusClass(form.buttonRadius)}`} style={buttonStyle(form)}>
                    {form.buttonText}
                  </span>
                )}
              </div>
            )}
            <span className="absolute end-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
              👁️ معاينة حية · اضغط لتغيير الصورة
            </span>
          </>
        ) : (
          <span className="grid size-full place-items-center text-muted">
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImageIcon width={32} height={32} /> اختر صورة البنر (يفضّل مقاس 1500×500)
            </span>
          </span>
        )}
        {uploading && <span className="absolute inset-0 grid place-items-center bg-white/70">جارٍ الرفع…</span>}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      <p className="-mt-3 text-xs text-muted">يظهر النص على الجانب الأيمن، ويقص الجوال أطراف الصورة. ضع العنصر المهم في الثلث الأيسر واترك اليمين هادئاً.</p>
      {/* Title */}
      <div className="space-y-2 rounded-xl border border-line bg-card p-3">
        <p className="text-xs font-bold text-muted">✏️ العنوان</p>
        <div className="flex gap-2">
          <input className="field flex-1" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={80} placeholder="مثلاً: خصم 20% على القهوة المختصة" />
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-2.5" title="لون النص">
            <input type="color" className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" value={form.titleColor || '#ffffff'} onChange={(e) => set('titleColor', e.target.value)} />
            <span className="text-xs font-medium text-muted">نص</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
          <ColorField label="خلفية" value={form.titleBg} onChange={(v) => set('titleBg', v)} />
          <OpacityField label="شفافية" value={form.titleBgOpacity} onChange={(v) => set('titleBgOpacity', v)} />
          <ColorField label="بوردر المربع" value={form.titleBorderColor} onChange={(v) => set('titleBorderColor', v)} />
          <NumberField label="سماكة المربع" value={form.titleBorderWidth} onChange={(v) => set('titleBorderWidth', v)} />
          <SizeField label="حجم" value={form.titleFontSize} onChange={(v) => set('titleFontSize', v)} />
          <ColorField label="إطار الحرف" value={form.titleTextStrokeColor} onChange={(v) => set('titleTextStrokeColor', v)} />
          <StrokeField label="سماكة الحرف" value={form.titleTextStrokeWidth} onChange={(v) => set('titleTextStrokeWidth', v)} />
        </div>
      </div>

      {/* Subtitle */}
      <div className="space-y-2 rounded-xl border border-line bg-card p-3">
        <p className="text-xs font-bold text-muted">📝 الوصف القصير</p>
        <div className="flex gap-2">
          <input className="field flex-1" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={140} />
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-2.5" title="لون النص">
            <input type="color" className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" value={form.subtitleColor || '#ffffff'} onChange={(e) => set('subtitleColor', e.target.value)} />
            <span className="text-xs font-medium text-muted">نص</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
          <ColorField label="خلفية" value={form.subtitleBg} onChange={(v) => set('subtitleBg', v)} />
          <OpacityField label="شفافية" value={form.subtitleBgOpacity} onChange={(v) => set('subtitleBgOpacity', v)} />
          <ColorField label="بوردر المربع" value={form.subtitleBorderColor} onChange={(v) => set('subtitleBorderColor', v)} />
          <NumberField label="سماكة المربع" value={form.subtitleBorderWidth} onChange={(v) => set('subtitleBorderWidth', v)} />
          <SizeField label="حجم" value={form.subtitleFontSize} onChange={(v) => set('subtitleFontSize', v)} />
          <ColorField label="إطار الحرف" value={form.subtitleTextStrokeColor} onChange={(v) => set('subtitleTextStrokeColor', v)} />
          <StrokeField label="سماكة الحرف" value={form.subtitleTextStrokeWidth} onChange={(v) => set('subtitleTextStrokeWidth', v)} />
        </div>
      </div>

      {/* Button */}
      <div className="space-y-2 rounded-xl border border-line bg-card p-3">
        <p className="text-xs font-bold text-muted">🔘 الزر (اختياري)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field" value={form.buttonText} onChange={(e) => set('buttonText', e.target.value)} maxLength={30} placeholder="تسوّق الآن" />
          <select className="field" value={form.link} onChange={(e) => set('link', e.target.value)}>
            <option value="">عند الضغط: لا شيء</option>
            <optgroup label="قسم">
              {data!.categories.map((c) => (<option key={c.id} value={`/c/${c.id}`}>{c.name}</option>))}
            </optgroup>
            <optgroup label="منتج">
              {data!.products.map((p) => (<option key={p.id} value={`/p/${p.id}`}>{p.name}</option>))}
            </optgroup>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-8">
          <ColorField label="خلفية" value={form.buttonBgColor} onChange={(v) => set('buttonBgColor', v)} />
          <OpacityField label="شفافية" value={form.buttonBgOpacity} onChange={(v) => set('buttonBgOpacity', v)} />
          <ColorField label="نص" value={form.buttonTextColor} onChange={(v) => set('buttonTextColor', v)} />
          <ColorField label="بوردر المربع" value={form.buttonBorderColor} onChange={(v) => set('buttonBorderColor', v)} />
          <NumberField label="سماكة المربع" value={form.buttonBorderWidth} onChange={(v) => set('buttonBorderWidth', v)} />
          <RadiusField label="زوايا" value={form.buttonRadius} onChange={(v) => set('buttonRadius', v)} />
          <ColorField label="إطار الحرف" value={form.buttonTextStrokeColor} onChange={(v) => set('buttonTextStrokeColor', v)} />
          <StrokeField label="سماكة الحرف" value={form.buttonTextStrokeWidth} onChange={(v) => set('buttonTextStrokeWidth', v)} />
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" busy={saving} disabled={uploading || !form.imageKey} className="flex-1">
          {form.id ? 'حفظ التعديلات' : 'إضافة البنر'}
        </Button>
        <Button type="button" variant="plain" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] text-muted">
      <span>{label}</span>
      <input type="color" className="h-8 w-full cursor-pointer rounded border border-line bg-card p-0.5" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function StrokeField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
  }, [value]);
  return (
    <label className="flex flex-col gap-1 text-[10px] text-muted">
      <span>{label}</span>
      <input
        type="number" className="field px-2 py-1 text-xs"
        min={0} max={3} step={0.1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(Math.min(3, Math.max(0, n)));
        }}
        inputMode="decimal"
      />
    </label>
  );
}

function OpacityField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
  }, [value]);
  return (
    <label className="flex flex-col gap-1 text-[10px] text-muted">
      <span>{label} <b className="text-ink">{value.toFixed(1)}%</b></span>
      <div className="flex items-center gap-1">
        <input
          type="range" min={0} max={100} step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 flex-1 cursor-pointer accent-brand"
        />
        <input
          type="number" min={0} max={100} step={0.1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onChange(Math.min(100, Math.max(0, n)));
          }}
          className="field w-14 px-1 py-0.5 text-[10px]"
          inputMode="decimal"
        />
      </div>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
  }, [value]);
  return (
    <label className="flex flex-col gap-1 text-[10px] text-muted">
      <span>{label}</span>
      <input
        type="number" className="field px-2 py-1 text-xs"
        min={0} max={10} step={0.1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(Math.min(10, Math.max(0, n)));
        }}
        inputMode="decimal"
      />
    </label>
  );
}

function SizeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] text-muted">
      <span>{label}</span>
      <select className="field px-2 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">افتراضي</option>
        <option value="sm">صغير</option>
        <option value="base">عادي</option>
        <option value="lg">كبير</option>
        <option value="xl">أكبر</option>
        <option value="2xl">ضخم</option>
      </select>
    </label>
  );
}

function RadiusField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] text-muted">
      <span>{label}</span>
      <select className="field px-2 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">افتراضي</option>
        <option value="none">حاد</option>
        <option value="sm">صغير</option>
        <option value="md">متوسط</option>
        <option value="lg">كبير</option>
        <option value="full">دائري</option>
      </select>
    </label>
  );
}
