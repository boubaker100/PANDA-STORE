import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApp } from '../state';
import { Button, Notice, Spinner } from '../components/ui';
import { TelegramIcon } from '../components/icons';
import { api } from '../lib/api';
import { dateTime, money, STATUS_LABELS, type OrderStatus } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { useStats } from './stats';
import type { Order, OrderItem, OrderStatusHistory } from '../types';

const STATUS_OPTIONS: OrderStatus[] = [
  'new',
  'pending_confirmation',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
];

export function OrderDetail() {
  const { id } = useParams();
  const { data } = useApp();
  const { refreshStats } = useStats();
  const currency = data!.store.currency;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    api<{ order: Order; items: OrderItem[]; history?: OrderStatusHistory[] }>(`/admin/orders/${id}`).then(
      (res) => {
        setOrder(res.order);
        setItems(res.items);
        setHistory(res.history ?? []);
      },
      (e) => setError(e.message),
    );
  }, [id]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!order) return <Spinner />;

  async function updateStatus(next: OrderStatus) {
    if (!order) return;
    setChanging(true);
    try {
      const res = await api<{ order: Order }>(`/admin/orders/${order.id}`, {
        patch: { status: next, note: statusNote.trim() || undefined },
      });
      setOrder(res.order);
      setStatusNote('');
      refreshStats();
      // Reload history
      const updated = await api<{ history?: OrderStatusHistory[] }>(`/admin/orders/${order.id}`);
      if (updated.history) setHistory(updated.history);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <Link to="/admin/orders" className="text-xs font-semibold text-brand hover:underline">
            ← العودة لقائمة الطلبات
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
            <span>طلب #{order.id}</span>
            {order.source === 'telegram' && (
              <span className="flex items-center gap-1 rounded-md bg-[#229ED9]/10 px-2 py-0.5 text-xs font-bold text-[#229ED9]">
                <TelegramIcon width={14} height={14} /> تيليجرام
              </span>
            )}
          </h1>
          <span className="text-xs text-muted">{dateTime(order.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Status control card */}
      <div className="rounded-2xl border border-line bg-card p-4 space-y-3 shadow-sm">
        <h2 className="text-sm font-bold text-ink">تعديل حالة الطلب:</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="field text-xs sm:text-sm"
            placeholder="أضف ملاحظة لتغيير الحالة (اختياري، مثلاً: تم الاتصال، أو رقم تتبع الشحن)..."
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                disabled={changing || order.status === st}
                onClick={() => updateStatus(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-40 ${
                  order.status === st
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'border border-line bg-paper text-ink hover:bg-card hover:border-brand'
                }`}
              >
                {STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer & Algerian Delivery Address Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4 space-y-2.5 text-sm">
          <h2 className="font-bold text-base border-b border-line pb-2 flex items-center gap-2">
            <span>👤</span>
            <span>بيانات العميل</span>
          </h2>
          <div>
            <span className="text-xs text-muted block">الاسم واللقب:</span>
            <span className="font-bold text-ink text-base">{order.name}</span>
          </div>
          <div>
            <span className="text-xs text-muted block">رقم الهاتف الأساسي:</span>
            <a href={`tel:${order.phone}`} className="font-bold text-brand hover:underline inline-block" dir="ltr">
              📞 {order.phone}
            </a>
          </div>
          {order.phoneAlt && (
            <div>
              <span className="text-xs text-muted block">رقم هاتف بديل:</span>
              <a href={`tel:${order.phoneAlt}`} className="text-muted hover:underline inline-block" dir="ltr">
                📞 {order.phoneAlt}
              </a>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-4 space-y-2.5 text-sm">
          <h2 className="font-bold text-base border-b border-line pb-2 flex items-center gap-2">
            <span>📍</span>
            <span>عنوان التوصيل (الجزائر)</span>
          </h2>
          <div>
            <span className="text-xs text-muted block">الولاية والدائرة والبلدية:</span>
            <span className="font-bold text-ink">
              {order.wilayaName} • {order.daira ? `دائرة ${order.daira}` : ''} • {order.commune ? `بلدية ${order.commune}` : ''}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted block">طريقة التوصيل:</span>
            <span className="inline-block rounded-md bg-paper px-2.5 py-1 text-xs font-bold border border-line">
              {order.deliveryType === 'desk' ? '🏢 استلام من المكتب (Stop-desk)' : '🚚 توصيل حتى باب المنزل'}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted block">العنوان المفصل:</span>
            <span className="text-ink font-medium">{order.address} {order.district ? `(حي ${order.district})` : ''}</span>
          </div>
          {order.landmark && (
            <div>
              <span className="text-xs text-muted block">أقرب معلم:</span>
              <span className="text-muted">{order.landmark}</span>
            </div>
          )}
          {order.notes && (
            <div className="rounded-lg bg-paper p-2 text-xs border border-line">
              <span className="font-bold block text-ink">ملاحظات العميل:</span>
              <span>{order.notes}</span>
            </div>
          )}
        </section>
      </div>

      {/* Ordered Products Breakdown */}
      <section className="rounded-2xl border border-line bg-card p-5 space-y-3">
        <h2 className="font-bold text-base border-b border-line pb-2 flex items-center gap-2">
          <span>🛍️</span>
          <span>المنتجات المطلوبة ({items.length})</span>
        </h2>
        <div className="divide-y divide-line/60">
          {items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="font-bold text-ink">{item.name}</span>
                {item.variantDetails && (
                  <span className="block text-xs text-brand font-medium">({item.variantDetails})</span>
                )}
                <span className="text-xs text-muted block">الكمية: {item.qty} × {money(item.price, currency)}</span>
              </div>
              <span className="font-bold text-ink">{money(item.price * item.qty, currency)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-line pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>المجموع الفرعي:</span>
            <span>{money(order.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>مصاريف التوصيل:</span>
            <span>{order.deliveryFee === 0 ? 'مجاني' : money(order.deliveryFee, currency)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-brand border-t border-line pt-2">
            <span>المجموع الإجمالي:</span>
            <span>{money(order.total, currency)}</span>
          </div>
        </div>
      </section>

      {/* Transfer Receipt (if BaridiMob / transfer) */}
      {order.payment === 'transfer' && (
        <section className="rounded-2xl border border-line bg-card p-4 space-y-2">
          <h2 className="font-bold text-base">إيصال التحويل (بريدي موب / CCP)</h2>
          {order.receiptKey ? (
            <a href={`/api/admin/receipts/${order.receiptKey}`} target="_blank" rel="noopener">
              <img
                src={`/api/admin/receipts/${order.receiptKey}`}
                alt="إيصال التحويل"
                className="max-h-80 rounded-xl border border-line object-contain"
              />
            </a>
          ) : (
            <p className="text-sm text-muted">لم يرفق العميل صورة الوصل.</p>
          )}
        </section>
      )}

      {/* Status History (Audit Trail) */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-5 space-y-3">
          <h2 className="font-bold text-base border-b border-line pb-2">سجل التغييرات وتاريخ الحالات</h2>
          <ul className="space-y-3 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-xs sm:text-sm">
                <span className="size-2 rounded-full bg-brand mt-1.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-bold text-ink">{STATUS_LABELS[h.newStatus as OrderStatus] || h.newStatus}</span>
                  {h.note && <span className="text-muted block text-xs mt-0.5">{h.note}</span>}
                </div>
                <span className="text-xs text-muted shrink-0">{dateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
