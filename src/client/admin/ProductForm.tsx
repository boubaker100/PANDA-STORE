import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '../state';
import { Button, Field, Notice, Spinner } from '../components/ui';
import { ImageIcon, TrashIcon } from '../components/icons';
import { api } from '../lib/api';
import { imageUrl } from '../lib/format';
import { shrinkImage } from '../lib/image';
import { confirmAction, haptic } from '../lib/telegram';
import { Toggle } from './Toggle';
import type { Product, ProductSectionConfig, ProductVariantConfig } from '../types';

interface FormState {
  name: string;
  price: string;
  oldPrice: string;
  description: string;
  categoryId: string;
  images: string[];
  videoUrl: string;
  variants: ProductVariantConfig;
  sections: ProductSectionConfig[];
  available: boolean;
}

const DEFAULT_SECTIONS: ProductSectionConfig[] = [
  {
    id: 'sec_feat',
    type: 'features',
    title: 'أهم المميزات',
    enabled: true,
    content: { items: ['ميزة المنتج الأولى', 'ميزة المنتج الثانية'] },
  },
  {
    id: 'sec_specs',
    type: 'specs',
    title: 'المواصفات الفنية',
    enabled: true,
    content: {
      items: [
        { label: 'الضمان', value: 'سنة كاملة' },
        { label: 'بلد المنشأ', value: 'أصلي' },
      ],
    },
  },
  {
    id: 'sec_faq',
    type: 'faq',
    title: 'الأسئلة الشائعة',
    enabled: false,
    content: {
      items: [
        { q: 'كم مدة التوصيل؟', a: 'خلال 24 إلى 48 ساعة لكافة الولايات.' },
        { q: 'هل يمكنني معاينة المنتج قبل الدفع؟', a: 'نعم، الدفع عند الاستلام بعد المعاينة.' },
      ],
    },
  },
];

const EMPTY_FORM: FormState = {
  name: '',
  price: '',
  oldPrice: '',
  description: '',
  categoryId: '',
  images: [],
  videoUrl: '',
  variants: { colors: [], sizes: [] },
  sections: DEFAULT_SECTIONS,
  available: true,
};

export function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const { data, reload } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // External image URL input
  const [externalImageUrl, setExternalImageUrl] = useState('');

  // Variant input temps
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#111827');
  const [newSize, setNewSize] = useState('');

  useEffect(() => {
    if (isNew) return;
    api<{ products: Product[] }>('/admin/products').then(({ products }) => {
      const p = products.find((x) => x.id === Number(id));
      if (!p) return setError('المنتج غير موجود');
      setForm({
        name: p.name,
        price: String(p.price),
        oldPrice: p.oldPrice ? String(p.oldPrice) : '',
        description: p.description,
        categoryId: p.categoryId ? String(p.categoryId) : '',
        images: p.images ?? [],
        videoUrl: p.videoUrl ?? '',
        variants: p.variants ?? { colors: [], sizes: [] },
        sections: p.sections && p.sections.length > 0 ? p.sections : DEFAULT_SECTIONS,
        available: p.available,
      });
      setLoading(false);
    });
  }, [id, isNew]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of [...files].slice(0, 10 - form.images.length)) {
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.set('file', await shrinkImage(file));
        const { key } = await api<{ key: string }>('/admin/images', { form: body });
        setForm((f) => ({ ...f, images: [...f.images, key] }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function addExternalImage() {
    if (!externalImageUrl.trim()) return;
    setForm((f) => ({ ...f, images: [...f.images, externalImageUrl.trim()] }));
    setExternalImageUrl('');
  }

  function removeImage(index: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  }

  function addColor() {
    if (!newColorName.trim()) return;
    setForm((f) => ({
      ...f,
      variants: {
        ...f.variants,
        colors: [...(f.variants.colors ?? []), { name: newColorName.trim(), hex: newColorHex }],
      },
    }));
    setNewColorName('');
  }

  function removeColor(name: string) {
    setForm((f) => ({
      ...f,
      variants: {
        ...f.variants,
        colors: (f.variants.colors ?? []).filter((c) => c.name !== name),
      },
    }));
  }

  function addSize() {
    if (!newSize.trim()) return;
    setForm((f) => ({
      ...f,
      variants: {
        ...f.variants,
        sizes: [...(f.variants.sizes ?? []), newSize.trim()],
      },
    }));
    setNewSize('');
  }

  function removeSize(s: string) {
    setForm((f) => ({
      ...f,
      variants: {
        ...f.variants,
        sizes: (f.variants.sizes ?? []).filter((x) => x !== s),
      },
    }));
  }

  // Section helpers
  function toggleSection(secId: string) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => (s.id === secId ? { ...s, enabled: !s.enabled } : s)),
    }));
  }

  function updateSectionTitle(secId: string, title: string) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => (s.id === secId ? { ...s, title } : s)),
    }));
  }

  function addFeatureItem(secId: string) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => {
        if (s.id === secId) {
          const items = Array.isArray(s.content?.items) ? [...s.content.items, 'ميزة جديدة'] : ['ميزة جديدة'];
          return { ...s, content: { ...s.content, items } };
        }
        return s;
      }),
    }));
  }

  function removeFeatureItem(secId: string, idx: number) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => {
        if (s.id === secId) {
          const items = (s.content?.items ?? []).filter((_: unknown, i: number) => i !== idx);
          return { ...s, content: { ...s.content, items } };
        }
        return s;
      }),
    }));
  }

  function addSpecItem(secId: string) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => {
        if (s.id === secId) {
          const items = Array.isArray(s.content?.items)
            ? [...s.content.items, { label: 'الخاصية', value: 'القيمة' }]
            : [{ label: 'الخاصية', value: 'القيمة' }];
          return { ...s, content: { ...s.content, items } };
        }
        return s;
      }),
    }));
  }

  function removeSpecItem(secId: string, idx: number) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => {
        if (s.id === secId) {
          const items = (s.content?.items ?? []).filter((_: unknown, i: number) => i !== idx);
          return { ...s, content: { ...s.content, items } };
        }
        return s;
      }),
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
      description: form.description.trim(),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      images: form.images,
      videoUrl: form.videoUrl.trim(),
      variants: form.variants,
      sections: form.sections,
      available: form.available,
    };

    try {
      await api(isNew ? '/admin/products' : `/admin/products/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        json: payload,
      });
      haptic('success');
      reload();
      navigate('/admin/products');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirmAction('حذف هذا المنتج نهائياً؟ ستبقى الطلبات السابقة كما هي.'))) return;
    await api(`/admin/products/${id}`, { method: 'DELETE' });
    reload();
    navigate('/admin/products');
  }

  if (loading) return error ? <Notice tone="error">{error}</Notice> : <Spinner />;

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-xl font-bold">{isNew ? 'إضافة منتج جديد' : 'تعديل صفحة المنتج'}</h1>
        {!isNew && (
          <button
            type="button"
            onClick={remove}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200"
          >
            <TrashIcon /> حذف المنتج
          </button>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {/* Main product info */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">1. البيانات الأساسية</h2>
        <Field label="اسم المنتج *">
          <input
            className="field font-semibold"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="مثال: ساعة ذكية الترا مقاومة للماء"
            required
            maxLength={120}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="السعر الحالي (د.ج) *">
            <input
              type="number"
              className="field font-bold text-brand"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="مثال: 4500"
              required
              min={1}
            />
          </Field>

          <Field label="السعر القديم المشطوب (د.ج)">
            <input
              type="number"
              className="field"
              value={form.oldPrice}
              onChange={(e) => setForm((f) => ({ ...f, oldPrice: e.target.value }))}
              placeholder="مثال: 5900 (اختياري)"
              min={1}
            />
          </Field>

          <Field label="القسم">
            <select
              className="field"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">بدون قسم</option>
              {data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="الوصف التوضيحي للمنتج">
          <textarea
            className="field min-h-24 resize-y leading-relaxed"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="اكتب وصفاً جذاباً وشاملاً للمنتج..."
            rows={4}
          />
        </Field>

        <div className="flex items-center justify-between border-t border-line/60 pt-3">
          <div>
            <span className="font-semibold text-sm">حالة التوفر</span>
            <span className="text-xs text-muted block">إذا تم التعطيل سيظهر للمتسوق "نفدت الكمية"</span>
          </div>
          <Toggle label="حالة التوفر" checked={form.available} onChange={(v) => setForm((f) => ({ ...f, available: v }))} />
        </div>
      </div>

      {/* Media & Images Management */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">2. الصور وملفات GIF والفيديو</h2>

        <div>
          <label className="block text-xs font-semibold text-muted mb-2">صور المنتج (الصورة الأولى هي الغلاف):</label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {form.images.map((img, idx) => (
              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-line bg-paper">
                <img src={imageUrl(img)} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 end-1 size-6 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="حذف"
                >
                  ×
                </button>
              </div>
            ))}

            {form.images.length < 10 && (
              <label className="flex flex-col items-center justify-center aspect-square rounded-xl border border-dashed border-line hover:border-brand cursor-pointer bg-paper text-muted hover:text-brand transition-colors">
                <ImageIcon width={24} height={24} />
                <span className="text-[11px] mt-1 font-semibold">رفع صورة</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => addPhotos(e.target.files)}
                  className="hidden"
                  disabled={uploading > 0}
                />
              </label>
            )}
          </div>
          {uploading > 0 && <p className="text-xs text-brand mt-2">جاري رفع {uploading} صورة وتصغيرها...</p>}
        </div>

        {/* External image URL (e.g. Cloudinary or direct image/GIF link) */}
        <div className="border-t border-line/60 pt-3">
          <label className="block text-xs font-semibold text-muted mb-1.5">أو أضف رابط صورة أو GIF مباشر (Cloudinary / خارجي):</label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://res.cloudinary.com/... أو رابط مباشر للصورة"
              value={externalImageUrl}
              onChange={(e) => setExternalImageUrl(e.target.value)}
              className="field text-xs sm:text-sm flex-1"
            />
            <Button type="button" size="sm" onClick={addExternalImage}>
              + إضافة
            </Button>
          </div>
        </div>

        {/* Video URL */}
        <div className="border-t border-line/60 pt-3">
          <Field label="رابط فيديو يوتيوب (غير مدرج) أو رابط MP4 مباشر">
            <input
              type="url"
              className="field text-xs sm:text-sm"
              placeholder="https://www.youtube.com/watch?v=... أو https://example.com/video.mp4"
              value={form.videoUrl}
              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
            />
            <span className="text-xs text-muted mt-1 block">
              💡 يُعرض بمشغل خفيف وسريع ولا يُحمّل إلا عندما يضغط العميل على زر التشغيل.
            </span>
          </Field>
        </div>
      </div>

      {/* Variants (Colors & Sizes) */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">3. الخيارات والمتغيرات (الألوان والمقاسات)</h2>

        {/* Colors */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-2">الألوان المتوفرة:</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(form.variants.colors ?? []).map((c) => (
              <span
                key={c.name}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-semibold"
              >
                {c.hex && <span className="size-3.5 rounded-full border border-black/20" style={{ backgroundColor: c.hex }} />}
                <span>{c.name}</span>
                <button
                  type="button"
                  onClick={() => removeColor(c.name)}
                  className="text-muted hover:text-rose-600 ms-1 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-md">
            <input
              type="text"
              placeholder="اسم اللون (مثلاً: أسود ملكي)"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              className="field text-xs sm:text-sm flex-1"
            />
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              className="size-9 rounded-lg border border-line p-0.5 cursor-pointer"
              title="اختر درجة اللون"
            />
            <Button type="button" size="sm" onClick={addColor}>
              + إضافة لون
            </Button>
          </div>
        </div>

        {/* Sizes */}
        <div className="border-t border-line/60 pt-3">
          <label className="block text-xs font-semibold text-muted mb-2">المقاسات المتوفرة:</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(form.variants.sizes ?? []).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-bold"
              >
                <span>{s}</span>
                <button
                  type="button"
                  onClick={() => removeSize(s)}
                  className="text-muted hover:text-rose-600 ms-1 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              placeholder="المقاس (مثلاً: S أو 42 أو 128GB)"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className="field text-xs sm:text-sm flex-1"
            />
            <Button type="button" size="sm" onClick={addSize}>
              + إضافة مقاس
            </Button>
          </div>
        </div>
      </div>

      {/* Landing Page Content Sections Builder */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-muted uppercase">4. منشئ أقسام صفحة الهبوط (Sections Builder)</h2>
        <p className="text-xs text-muted">
          تحكم في الأقسام التي تظهر في صفحة هذا المنتج ورتب محتواها لتخصيص صفحة هبوط مقنعة للعميل.
        </p>

        <div className="space-y-4 divide-y divide-line/60">
          {form.sections.map((sec) => (
            <div key={sec.id} className="pt-4 first:pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sec.enabled}
                    onChange={() => toggleSection(sec.id)}
                    className="rounded border-line"
                    id={`toggle_${sec.id}`}
                  />
                  <label htmlFor={`toggle_${sec.id}`} className="font-bold text-sm cursor-pointer">
                    {sec.type === 'features' ? '✨ قسم المميزات (Features List)' : ''}
                    {sec.type === 'specs' ? '📋 قسم المواصفات الفنية (Specs Table)' : ''}
                    {sec.type === 'faq' ? '❓ قسم الأسئلة الشائعة (FAQ)' : ''}
                  </label>
                </div>
                <span className={`text-xs font-semibold ${sec.enabled ? 'text-brand' : 'text-muted'}`}>
                  {sec.enabled ? 'مفعّل' : 'معطّل'}
                </span>
              </div>

              {sec.enabled && (
                <div className="ms-6 space-y-3 rounded-xl bg-paper p-3 border border-line/60">
                  <Field label="عنوان القسم:">
                    <input
                      className="field text-xs sm:text-sm"
                      value={sec.title || ''}
                      onChange={(e) => updateSectionTitle(sec.id, e.target.value)}
                    />
                  </Field>

                  {/* Features list editor */}
                  {sec.type === 'features' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-muted">نقاط المميزات:</label>
                      {(sec.content?.items ?? []).map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className="field text-xs sm:text-sm flex-1"
                            value={item}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((f) => ({
                                ...f,
                                sections: f.sections.map((s) => {
                                  if (s.id === sec.id) {
                                    const next = [...s.content.items];
                                    next[idx] = val;
                                    return { ...s, content: { ...s.content, items: next } };
                                  }
                                  return s;
                                }),
                              }));
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeFeatureItem(sec.id, idx)}
                            className="text-rose-600 font-bold px-2"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <Button type="button" size="sm" onClick={() => addFeatureItem(sec.id)}>
                        + إضافة ميزة
                      </Button>
                    </div>
                  )}

                  {/* Specs table editor */}
                  {sec.type === 'specs' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-muted">جدول المواصفات (الخاصية / القيمة):</label>
                      {(sec.content?.items ?? []).map((row: { label: string; value: string }, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className="field text-xs sm:text-sm w-1/3"
                            placeholder="الخاصية"
                            value={row.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((f) => ({
                                ...f,
                                sections: f.sections.map((s) => {
                                  if (s.id === sec.id) {
                                    const next = [...s.content.items];
                                    next[idx] = { ...next[idx], label: val };
                                    return { ...s, content: { ...s.content, items: next } };
                                  }
                                  return s;
                                }),
                              }));
                            }}
                          />
                          <input
                            className="field text-xs sm:text-sm flex-1"
                            placeholder="القيمة"
                            value={row.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((f) => ({
                                ...f,
                                sections: f.sections.map((s) => {
                                  if (s.id === sec.id) {
                                    const next = [...s.content.items];
                                    next[idx] = { ...next[idx], value: val };
                                    return { ...s, content: { ...s.content, items: next } };
                                  }
                                  return s;
                                }),
                              }));
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeSpecItem(sec.id, idx)}
                            className="text-rose-600 font-bold px-2"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <Button type="button" size="sm" onClick={() => addSpecItem(sec.id)}>
                        + إضافة خاصية
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="plain"
          onClick={() => navigate('/admin/products')}
        >
          إلغاء
        </Button>
        <Button type="submit" tone="brand" size="lg" disabled={saving}>
          {saving ? 'جاري الحفظ...' : isNew ? 'إنشاء المنتج وعرض الصفحة' : 'حفظ التعديلات'}
        </Button>
      </div>
    </form>
  );
}
