import { useState, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../state';
import { Button, Field, Notice } from './ui';
import { BankIcon, CashIcon, CheckIcon, ImageIcon } from './icons';
import { calcDeliveryFee, isValidAlgerianPhone, money, normalizeAlgerianPhone } from '../lib/format';
import { api } from '../lib/api';
import { haptic } from '../lib/telegram';
import { shrinkImage } from '../lib/image';
import { rememberOrder } from '../lib/myOrders';
import { getCommunes, getDairas, getWilayas, type Wilaya } from '../../shared/algeria';
import type { Product } from '../types';

interface OrderItemSpec {
  product: Product;
  qty: number;
  selectedColor?: string;
  selectedSize?: string;
}

interface AlgeriaOrderFormProps {
  product?: Product;
  initialItems?: OrderItemSpec[];
  onSuccess?: (token: string, orderId: number) => void;
  className?: string;
}

export function AlgeriaOrderForm({ product, initialItems, onSuccess, className = '' }: AlgeriaOrderFormProps) {
  const { data, session, cartLines, clearCart } = useApp();
  const navigate = useNavigate();
  const store = data!.store;
  const deliveryRates = data?.deliveryRates ?? [];
  const wilayas = useMemo(() => getWilayas(), []);

  // Variant selections if single product mode
  const [selectedColor, setSelectedColor] = useState<string>(
    product?.variants?.colors?.[0]?.name ?? '',
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    product?.variants?.sizes?.[0] ?? '',
  );
  const [qty, setQty] = useState<number>(1);

  // Customer & Address state
  const [name, setName] = useState(session.user?.name ?? '');
  const [phone, setPhone] = useState(session.customer?.phone?.replace(/^\+213/, '0') ?? '');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [wilayaId, setWilayaId] = useState<number>(16); // Default 16 - Alger
  const [daira, setDaira] = useState<string>('');
  const [commune, setCommune] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'home' | 'desk'>('home');
  const [notes, setNotes] = useState<string>('');
  const [payment, setPayment] = useState<'cod' | 'transfer'>('cod');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // Bot honeypot trap
  const [honeypot, setHoneypot] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Available Dairas & Communes based on selected Wilaya
  const availableDairas = useMemo(() => getDairas(wilayaId), [wilayaId]);
  const availableCommunes = useMemo(() => {
    if (!daira) return [];
    return getCommunes(wilayaId, daira);
  }, [wilayaId, daira]);

  // When Wilaya changes, reset Daira and Commune
  function handleWilayaChange(newWilayaId: number) {
    setWilayaId(newWilayaId);
    const newDairas = getDairas(newWilayaId);
    if (newDairas.length > 0) {
      setDaira(newDairas[0].name);
      setCommune(newDairas[0].communes[0] ?? '');
    } else {
      setDaira('');
      setCommune('');
    }
  }

 
 {/* اختبار التحديث المباشر */ }
  {/* اختبار التحديث المباشر */ }
  // When Daira changes, reset Commune
  function handleDairaChange(newDaira: string) {
    setDaira(newDaira);
    const newCommunes = getCommunes(wilayaId, newDaira);
    setCommune(newCommunes[0] ?? '');
  }

  // Calculate pricing
  const subtotal = useMemo(() => {
    if (product) {
      return product.price * qty;
    }
    if (initialItems && initialItems.length > 0) {
      return initialItems.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    }
    return cartLines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  }, [product, qty, initialItems, cartLines]);

  const deliveryFee = useMemo(() => {
    return calcDeliveryFee(subtotal, wilayaId, deliveryType, deliveryRates, store);
  }, [subtotal, wilayaId, deliveryType, deliveryRates, store]);

  const total = subtotal + deliveryFee;

  const currentWilaya = useMemo(() => {
    return wilayas.find((w) => w.id === wilayaId);
  }, [wilayas, wilayaId]);

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    try {
      const small = await shrinkImage(file, 1800);
      setReceipt(small);
      setReceiptPreview(URL.createObjectURL(small));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      return setError('يرجى إدخال الاسم واللقب كاملاً');
    }
    if (!isValidAlgerianPhone(phone)) {
      return setError('رقم الهاتف غير صحيح. يرجى إدخال 10 أرقام تبدأ بـ 05 أو 06 أو 07');
    }
    if (phoneAlt && !isValidAlgerianPhone(phoneAlt)) {
      return setError('رقم الهاتف البديل غير صحيح');
    }
    if (!daira || !commune) {
      return setError('يرجى اختيار الدائرة والبلدية');
    }

    if (payment === 'transfer' && !receipt) {
      return setError('يرجى إرفاق صورة وصل التحويل عبر بريدي موب');
    }

    // Prepare items list
    let itemsToOrder: { id: number; qty: number; variantDetails?: string }[] = [];
    if (product) {
      const variantParts = [];
      if (selectedColor) variantParts.push(`اللون: ${selectedColor}`);
      if (selectedSize) variantParts.push(`المقاس: ${selectedSize}`);
      itemsToOrder = [
        {
          id: product.id,
          qty,
          variantDetails: variantParts.join(' / '),
        },
      ];
    } else if (initialItems && initialItems.length > 0) {
      itemsToOrder = initialItems.map((item) => {
        const parts = [];
        if (item.selectedColor) parts.push(`اللون: ${item.selectedColor}`);
        if (item.selectedSize) parts.push(`المقاس: ${item.selectedSize}`);
        return {
          id: item.product.id,
          qty: item.qty,
          variantDetails: parts.join(' / '),
        };
      });
    } else {
      itemsToOrder = cartLines.map((line) => ({
        id: line.product.id,
        qty: line.qty,
      }));
    }

    if (itemsToOrder.length === 0) {
      return setError('السلة فارغة. يرجى اختيار منتج لطلبه');
    }

    setBusy(true);
    const form = new FormData();
    form.set(
      'data',
      JSON.stringify({
        items: itemsToOrder,
        name: name.trim(),
        phone: normalizeAlgerianPhone(phone),
        phoneAlt: phoneAlt ? normalizeAlgerianPhone(phoneAlt) : '',
        wilayaId,
        wilayaName: currentWilaya ? `${currentWilaya.code} - ${currentWilaya.nameAr}` : 'الجزائر',
        daira,
        commune,
        district: district.trim(),
        address: address.trim(),
        landmark: landmark.trim(),
        deliveryType,
        notes: notes.trim(),
        payment,
        honeypot, // trap field
      }),
    );

    if (payment === 'transfer' && receipt) {
      form.set('receipt', receipt);
    }

    try {
      const { token, id } = await api<{ token: string; id: number }>('/orders', { form });
      haptic('success');
      rememberOrder({ id, token, total, createdAt: Math.floor(Date.now() / 1000) });
      if (!product) clearCart();

      if (onSuccess) {
        onSuccess(token, id);
      } else {
        navigate(`/o/${token}?new=1`, { replace: true });
      }
    } catch (err) {
      haptic('error');
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-sm ${className}`}>
      {/* Honeypot hidden input */}
      <input
        type="text"
        name="company_website_url"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <div className="border-b border-line pb-4 mb-5 min-w-0">
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🇩🇿</span>
          <span className="break-words">استمارة تأكيد الطلب والتوصيل</span>
        </h2>
        <p className="text-sm text-muted mt-1">املأ بياناتك وسيتم التوصيل حتى باب منزلك مع الدفع عند الاستلام</p>
      </div>

      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      {/* Product variant options (if single product mode) */}
      {product && (
        <div className="mb-6 rounded-xl bg-paper p-4 border border-line/60 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink min-w-0 break-words">{product.name}</span>
            <span className="text-base sm:text-lg font-bold text-brand shrink-0">{money(product.price, store.currency)}</span>
          </div>

          {product.variants?.colors && product.variants.colors.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted mb-2">اختر اللون:</label>
              <div className="flex flex-wrap gap-2">
                {product.variants.colors.map((c) => {
                  const active = selectedColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all ${active
                        ? 'border-brand bg-brand/10 font-bold text-brand ring-2 ring-brand/20'
                        : 'border-line bg-card text-ink hover:border-brand/50'
                        }`}
                    >
                      {c.hex && (
                        <span
                          className="size-4 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                      )}
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product.variants?.sizes && product.variants.sizes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted mb-2">اختر المقاس:</label>
              <div className="flex flex-wrap gap-2">
                {product.variants.sizes.map((s) => {
                  const active = selectedSize === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`min-w-10 rounded-lg border px-3 py-1.5 text-center text-sm transition-all ${active
                        ? 'border-brand bg-brand text-on-brand font-bold shadow-sm'
                        : 'border-line bg-card text-ink hover:border-brand/50'
                        }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-line/40">
            <span className="text-sm font-medium">الكمية المطلوبة:</span>
            <div className="flex items-center rounded-lg border border-line bg-card">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-1 text-lg font-bold text-muted hover:text-ink disabled:opacity-30"
                disabled={qty <= 1}
              >
                -
              </button>
              <span className="w-10 text-center font-bold text-ink">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                className="px-3 py-1 text-lg font-bold text-muted hover:text-ink"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">1. معلومات الاتصال</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم واللقب *">
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: محمد بن عيسى"
              required
              autoComplete="name"
            />
          </Field>

          <Field label="رقم الهاتف الأساسي *">
            <div className="flex" dir="ltr">
              <input
                className="field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05 / 06 / 07XXXXXXXX"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field label="رقم هاتف إضافي (اختياري)">
              <div className="flex" dir="ltr">
                <input
                  className="field"
                  value={phoneAlt}
                  onChange={(e) => setPhoneAlt(e.target.value)}
                  placeholder="رقم بديل في حال تعذر الاتصال بالرقم الأول"
                  type="tel"
                  inputMode="tel"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Shipping address in Algeria */}
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted pt-3">2. عنوان التوصيل (الجزائر)</h3>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="الولاية (69 ولاية) *">
            <select
              className="field cursor-pointer"
              value={wilayaId}
              onChange={(e) => handleWilayaChange(Number(e.target.value))}
              required
            >
              {wilayas.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.nameAr}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الدائرة *">
            <select
              className="field cursor-pointer"
              value={daira}
              onChange={(e) => handleDairaChange(e.target.value)}
              required
              disabled={availableDairas.length === 0}
            >
              <option value="">اختر الدائرة</option>
              {availableDairas.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="البلدية *">
            <select
              className="field cursor-pointer"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              required
              disabled={availableCommunes.length === 0}
            >
              <option value="">اختر البلدية</option>
              {availableCommunes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Delivery Type Option: Home vs Stop-Desk */}
        <div>
          <label className="block text-xs font-medium text-muted mb-2">مكان الاستلام:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType('home')}
              className={`rounded-xl border p-3 text-start transition-all min-w-0 ${deliveryType === 'home'
                ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                : 'border-line bg-paper hover:border-brand/40'
                }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-bold text-sm truncate">🚚 توصيل للمنزل</span>
                {deliveryType === 'home' && <span className="text-brand shrink-0"><CheckIcon /></span>}
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">يصلك الموزع حتى باب المنزل أو العمل</p>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryType('desk')}
              className={`rounded-xl border p-3 text-start transition-all min-w-0 ${deliveryType === 'desk'
                ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                : 'border-line bg-paper hover:border-brand/40'
                }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-bold text-sm truncate">🏢 استلام من المكتب (Stop-Desk)</span>
                {deliveryType === 'desk' && <span className="text-brand shrink-0"><CheckIcon /></span>}
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">تستلم بنفسك من مكتب التوصيل في ولايتك</p>
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الحي أو المنطقة">
            <input
              className="field"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="مثلاً: حي النخيل أو حي 500 مسكن"
            />
          </Field>

          <Field label="أقرب معلم (اختياري)">
            <input
              className="field"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="مثلاً: بجانب المسجد، مقابل الثانوية..."
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="العنوان المفصل (الشارع / رقم المنزل أو العمارة) (اختياري)">
              <input
                className="field"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الشارع، رقم العمارة، الطابق أو الشقة..."

              />
            </Field>
          </div>
        </div>

        <Field label="ملاحظات للموزع (اختياري)">
          <input
            className="field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: يرجى الاتصال قبل الوصول بنصف ساعة"
          />
        </Field>

        {/* Payment Method */}
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted pt-3">3. طريقة الدفع</h3>
        <div className="space-y-2">
          <label
            onClick={() => setPayment('cod')}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${payment === 'cod' ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-line bg-paper'
              }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-brand"><CashIcon /></span>
              <div>
                <div className="font-bold text-sm">الدفع عند الاستلام (يداً بيد)</div>
                <div className="text-xs text-muted">تدفع للموزع نقداً بعد معاينة طلبك</div>
              </div>
            </div>
            {payment === 'cod' && <span className="text-brand"><CheckIcon /></span>}
          </label>

          {store.transferInfo && (
            <label
              onClick={() => setPayment('transfer')}
              className={`flex cursor-pointer flex-col rounded-xl border p-3 transition-all ${payment === 'transfer' ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-line bg-paper'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-brand"><BankIcon /></span>
                  <div>
                    <div className="font-bold text-sm">تحويل عبر بريدي موب (BaridiMob) / CCP</div>
                    <div className="text-xs text-muted">تحويل فوري وإرفاق صورة الوصل</div>
                  </div>
                </div>
                {payment === 'transfer' && <span className="text-brand"><CheckIcon /></span>}
              </div>

              {payment === 'transfer' && (
                <div className="mt-3 border-t border-line/50 pt-3">
                  <p className="whitespace-pre-line rounded-lg bg-card p-3 text-xs leading-relaxed border border-line">
                    {store.transferInfo}
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-card p-3 hover:border-brand">
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="صورة الإيصال" className="size-16 rounded-lg object-cover" />
                    ) : (
                      <span className="grid size-16 place-items-center rounded-lg bg-paper text-muted">
                        <ImageIcon />
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-semibold">إرفاق صورة الوصل *</div>
                      <div className="text-xs text-muted">انقر لرفع لقطة شاشة لوصل التحويل</div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => pickReceipt(e.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </label>
          )}
        </div>
      </div>

      {/* Cost summary card */}
      <div className="mt-6 rounded-xl border border-line bg-paper p-4 space-y-2 text-sm">
        <div className="flex justify-between items-center gap-2 text-muted">
          <span>المجموع الفرعي:</span>
          <span className="font-semibold text-ink shrink-0">{money(subtotal, store.currency)}</span>
        </div>
        <div className="flex justify-between items-center gap-2 text-muted">
          <span className="min-w-0 truncate">
            مصاريف التوصيل ({currentWilaya?.nameAr} - {deliveryType === 'desk' ? 'المكتب' : 'المنزل'}):
          </span>
          <span className="font-semibold text-ink shrink-0">
            {deliveryFee === 0 ? 'شحن مجاني 🎉' : money(deliveryFee, store.currency)}
          </span>
        </div>
        <div className="border-t border-line pt-2 flex justify-between items-center gap-2 text-base sm:text-lg font-bold text-brand">
          <span>المبلغ الإجمالي للدفع:</span>
          <span className="shrink-0">{money(total, store.currency)}</span>
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit" tone="brand" size="lg" className=" w-full text-base cursor-pointer py-3.5" disabled={busy}>
          {busy ? 'جاري تأكيد طلبك...' : `تأكيد الطلب الآن (${money(total, store.currency)})`}
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          🔒 بياناتك الشخصية محمية ومشفرة ولن تُستخدم إلا لأغراض توصيل هذا الطلب
        </p>
      </div>
    </form>
  );
}
