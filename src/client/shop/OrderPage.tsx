import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../state';
import { Notice, Spinner } from '../components/ui';
import { CheckIcon, TelegramIcon, WhatsAppIcon } from '../components/icons';
import { api } from '../lib/api';
import { dateTime, money, STATUS_LABELS, type OrderStatus } from '../lib/format';
import { inTelegram, openTelegramLink } from '../lib/telegram';
import type { Order, OrderItem, OrderStatusHistory } from '../types';

type PublicOrder = Omit<Order, 'receiptKey' | 'telegramChatId'> & {
  followsOnTelegram: boolean;
  history?: OrderStatusHistory[];
};

const MAIN_STEPS: OrderStatus[] = ['new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export function OrderPage() {
  const { token } = useParams();
  const [search] = useSearchParams();
  const { data } = useApp();
  const [result, setResult] = useState<{ order: PublicOrder; items: OrderItem[]; history?: OrderStatusHistory[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ order: PublicOrder; items: OrderItem[]; history?: OrderStatusHistory[] }>(`/orders/${token}`).then(
      setResult,
      (e) => setError(e.message),
    );
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Notice tone="error">{error}</Notice>
        <Link to="/" className="mt-4 block text-center font-semibold text-brand">
          العودة للمتجر
        </Link>
      </main>
    );
  }

  if (!result) return <Spinner />;

  const { order, items, history = [] } = result;
  const { currency, botUsername, whatsapp } = data!.store;
  const stepIndex = MAIN_STEPS.indexOf(order.status);
  const isSpecialStatus = order.status === 'cancelled' || order.status === 'returned';

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {search.get('new') && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-700 px-4 py-4 text-white shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20">
            <CheckIcon />
          </span>
          <div>
            <p className="font-bold text-base">تم استلام طلبك بنجاح 🎉</p>
            <p className="text-sm opacity-90">سنتصل بك لتأكيد الطلب وشحنه إلى ولايتك في أسرع وقت.</p>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
        <div>
          <span className="text-xs font-semibold text-muted">رقم الطلب</span>
          <h1 className="text-2xl font-bold text-ink">#{order.id}</h1>
        </div>
        <span className="text-sm text-muted">{dateTime(order.createdAt)}</span>
      </div>

      {/* Status Progress Timeline */}
      <div className="mt-6 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-muted">حالة الطلب:</span>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>

        {isSpecialStatus ? (
          <Notice tone="error">
            {order.status === 'cancelled'
              ? 'تم إلغاء هذا الطلب. للاستفسار يرجى التواصل مع خدمة العملاء.'
              : 'تم تسجيل هذا الطلب كمرتجع.'}
          </Notice>
        ) : (
          <ol className="grid grid-cols-5 gap-1 text-center" aria-label="مراحل الطلب">
            {MAIN_STEPS.map((step, i) => {
              const done = i <= stepIndex;
              const current = i === stepIndex;
              return (
                <li key={step} className="flex flex-col items-center">
                  <span
                    className={`size-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done ? 'bg-brand text-on-brand' : 'bg-line text-muted'
                    } ${current ? 'ring-4 ring-brand/20' : ''}`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span
                    className={`mt-2 text-[11px] leading-tight sm:text-xs ${
                      current ? 'font-bold text-brand' : done ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Telegram & WhatsApp buttons */}
      <div className="mt-5 flex flex-col gap-2">
        {botUsername && !order.followsOnTelegram && !inTelegram && (
          <button
            onClick={() => openTelegramLink(`https://t.me/${botUsername}?start=o_${order.token}`)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-5 font-bold text-white shadow-sm hover:opacity-95"
          >
            <TelegramIcon /> متابعة تحديثات الطلب على تيليجرام
          </button>
        )}
        {order.followsOnTelegram && (
          <p className="text-center text-xs text-muted">
            🔔 تم ربط هذا الطلب بحسابك في تيليجرام وستصلك إشعارات الشحن فوراً.
          </p>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`السلام عليكم، استفسار بخصوص طلبي #${order.id}`)}`}
            target="_blank"
            rel="noopener"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-card px-5 font-semibold ring-1 ring-line hover:bg-paper"
          >
            <WhatsAppIcon className="text-[#1FA855]" /> تواصل معنا عبر واتساب
          </a>
        )}
      </div>

      {/* Order Items Breakdown */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-bold text-base border-b border-line pb-3">المنتجات المطلوبة</h2>
        <ul className="mt-3 divide-y divide-line/60 text-sm">
          {items.map((item) => (
            <li key={item.id} className="py-2.5 flex justify-between items-center gap-3">
              <div>
                <span className="font-semibold text-ink">{item.name}</span>
                {item.variantDetails && (
                  <span className="block text-xs text-muted">({item.variantDetails})</span>
                )}
                <span className="text-xs text-muted">الكمية: {item.qty}</span>
              </div>
              <span className="font-bold text-ink shrink-0">{money(item.price * item.qty, currency)}</span>
            </li>
          ))}
          <li className="py-2.5 flex justify-between text-muted">
            <span>المجموع الفرعي:</span>
            <span>{money(order.subtotal, currency)}</span>
          </li>
          <li className="py-2.5 flex justify-between text-muted">
            <span>مصاريف التوصيل ({order.deliveryType === 'desk' ? 'استلام من المكتب' : 'توصيل للمنزل'}):</span>
            <span className="font-semibold text-ink">{order.deliveryFee === 0 ? 'مجاني' : money(order.deliveryFee, currency)}</span>
          </li>
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-lg font-bold text-brand">
          <span>المبلغ الإجمالي للدفع:</span>
          <span>{money(order.total, currency)}</span>
        </div>
      </section>

      {/* Delivery and Customer Details */}
      <section className="mt-4 rounded-2xl border border-line bg-card p-5 text-sm space-y-2">
        <h2 className="font-bold text-base border-b border-line pb-2 mb-3">بيانات التوصيل</h2>
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
          <div>
            <span className="text-muted block">اسم العميل:</span>
            <span className="font-semibold">{order.name}</span>
          </div>
          <div>
            <span className="text-muted block">الهاتف الأساسي:</span>
            <span dir="ltr" className="font-semibold">{order.phone}</span>
          </div>
          {order.phoneAlt && (
            <div>
              <span className="text-muted block">الهاتف الإضافي:</span>
              <span dir="ltr">{order.phoneAlt}</span>
            </div>
          )}
          <div>
            <span className="text-muted block">الولاية والبلدية:</span>
            <span className="font-semibold">{order.wilayaName} - {order.commune}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted block">طريقة الاستلام:</span>
            <span className="font-semibold">
              {order.deliveryType === 'desk' ? '🏢 استلام من المكتب (Stop-desk)' : '🚚 توصيل للمنزل'}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-muted block">العنوان المفصل:</span>
            <span>{order.address} {order.district ? `(${order.district})` : ''}</span>
          </div>
          {order.landmark && (
            <div className="col-span-2">
              <span className="text-muted block">أقرب معلم:</span>
              <span>{order.landmark}</span>
            </div>
          )}
          <div className="col-span-2 pt-2 border-t border-line">
            <span className="text-muted">طريقة الدفع: </span>
            <span className="font-bold">
              {order.payment === 'cod' ? 'الدفع نقداً عند الاستلام' : 'تحويل عبر بريدي موب / CCP'}
            </span>
          </div>
        </div>
      </section>

      {/* Status History (Audit Trail) */}
      {history.length > 0 && (
        <section className="mt-4 rounded-2xl border border-line bg-card p-5 text-sm">
          <h2 className="font-bold text-base border-b border-line pb-2 mb-3">سجل حالات الطلب</h2>
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-xs sm:text-sm">
                <span className="size-2 rounded-full bg-brand mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-ink">{STATUS_LABELS[h.newStatus as OrderStatus] || h.newStatus}</div>
                  {h.note && <div className="text-muted text-xs">{h.note}</div>}
                </div>
                <span className="text-xs text-muted shrink-0">{dateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="inline-block rounded-xl bg-paper px-6 py-2.5 font-bold text-brand border border-line hover:bg-card">
          ← العودة لتصفح المزيد من المنتجات
        </Link>
      </div>
    </main>
  );
}
