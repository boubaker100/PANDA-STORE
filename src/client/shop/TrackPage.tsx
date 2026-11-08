import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useApp } from '../state';
import { Button, Field, Notice, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { dateTime, money, STATUS_LABELS, type OrderStatus } from '../lib/format';
import type { Order, OrderItem, OrderStatusHistory } from '../types';

export function TrackPage() {
  const { data } = useApp();
  const currency = data?.store.currency ?? 'د.ج';

  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    order: Partial<Order>;
    items: OrderItem[];
    history: OrderStatusHistory[];
  } | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!orderId || !phone) {
      return setError('يرجى إدخال رقم الطلب ورقم هاتفك المسجل');
    }

    setBusy(true);
    try {
      const res = await api<{
        order: Partial<Order>;
        items: OrderItem[];
        history: OrderStatusHistory[];
      }>('/orders/track', {
        json: { orderId: Number(orderId), phone: phone.trim() },
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">تتبع حالة طلبك</h1>
        <p className="text-sm text-muted mt-1">أدخل رقم طلبك ورقم هاتفك لمتابعة حالة الشحن والتوصيل بأمان</p>
      </div>

      <form onSubmit={handleSearch} className="rounded-2xl border border-line bg-card p-5 shadow-sm space-y-4">
        {error && <Notice tone="error">{error}</Notice>}

        <Field label="رقم الطلب (مثال: 12)">
          <input
            className="field"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="أدخل رقم طلبك"
            type="number"
            required
          />
        </Field>

        <Field label="رقم الهاتف المسجل في الطلب">
          <input
            className="field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05 / 06 / 07XXXXXXXX"
            type="tel"
            required
          />
        </Field>

        <Button type="submit" tone="brand" className="w-full py-3" disabled={busy}>
          {busy ? 'جاري البحث عن الطلب...' : 'تتبع الطلب الآن 🔍'}
        </Button>
      </form>

      {busy && (
        <div className="py-8 text-center">
          <Spinner />
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="text-xs text-muted block">طلب رقم</span>
              <span className="text-xl font-bold">#{result.order.id}</span>
            </div>
            <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">
              {STATUS_LABELS[result.order.status as OrderStatus] || result.order.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <span className="text-muted block">العميل:</span>
              <span className="font-semibold">{result.order.name}</span>
            </div>
            <div>
              <span className="text-muted block">الهاتف:</span>
              <span dir="ltr">{result.order.phone}</span>
            </div>
            <div>
              <span className="text-muted block">الولاية:</span>
              <span className="font-semibold">{result.order.wilayaName}</span>
            </div>
            <div>
              <span className="text-muted block">البلدية:</span>
              <span>{result.order.commune}</span>
            </div>
          </div>

          <div className="border-t border-line pt-3">
            <h3 className="font-semibold text-sm mb-2">عناصر الطلب:</h3>
            <ul className="divide-y divide-line/60 text-xs sm:text-sm">
              {result.items.map((item) => (
                <li key={item.id} className="py-2 flex justify-between">
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <span className="font-bold">{money(item.price * item.qty, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-bold text-base text-brand mt-3 pt-2 border-t border-line">
              <span>المبلغ المطلوب عند الاستلام:</span>
              <span>{money(result.order.total ?? 0, currency)}</span>
            </div>
          </div>

          {result.history && result.history.length > 0 && (
            <div className="border-t border-line pt-3">
              <h3 className="font-semibold text-sm mb-2">سجل التحديثات:</h3>
              <ul className="space-y-2">
                {result.history.map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-xs">
                    <span className="size-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold text-ink">{STATUS_LABELS[h.newStatus as OrderStatus] || h.newStatus}</span>
                      {h.note && <span className="text-muted block">{h.note}</span>}
                    </div>
                    <span className="text-muted">{dateTime(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.order.token && (
            <div className="text-center pt-2">
              <Link to={`/o/${result.order.token}`} className="text-xs text-brand font-semibold underline">
                عرض الصفحة الكاملة لهذا الطلب
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
