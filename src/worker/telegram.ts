import type { Env } from './env';
import type { OrderStatus } from './db/schema';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جديد',
  pending_confirmation: 'قيد التأكيد',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
  returned: 'مرتجع',
};

type Button =
  | { text: string; web_app: { url: string } }
  | { text: string; url: string }
  | { text: string; callback_data: string };

/** Calls the Bot API. Without BOT_TOKEN (local dev) it only logs. */
export async function botApi(env: Env, method: string, body: Record<string, unknown>) {
  if (!env.BOT_TOKEN) {
    console.log(`[bot disabled] ${method}`, JSON.stringify(body).slice(0, 300));
    return null;
  }
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!result.ok) console.warn(`Bot API ${method} failed:`, result.description);
  return result;
}

export function sendMessage(env: Env, chatId: string | number, text: string, buttons: Button[][] = []) {
  return botApi(env, 'sendMessage', {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function adminIds(env: Env): string[] {
  return (env.ADMIN_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean);
}

export interface OrderSummary {
  id: number;
  token: string;
  name: string;
  phone: string;
  phoneAlt?: string;
  wilayaName: string;
  commune: string;
  deliveryType: 'home' | 'desk';
  address: string;
  landmark?: string;
  notes: string;
  payment: 'cod' | 'transfer';
  subtotal: number;
  deliveryFee: number;
  total: number;
  source: 'web' | 'telegram';
  items: { name: string; qty: number; price: number; variantDetails?: string }[];
}

export function orderText(order: OrderSummary, currency: string) {
  const deliveryTypeStr = order.deliveryType === 'desk' ? 'استلام من المكتب (Stop-desk)' : 'توصيل للمنزل';
  const lines = order.items.map(
    (item) => `• ${item.name}${item.variantDetails ? ` (${item.variantDetails})` : ''} × ${item.qty} = ${item.price * item.qty} ${currency}`,
  );
  return [
    `🛍️ طلب جديد #${order.id} (${order.source === 'telegram' ? 'من تيليجرام' : 'من الموقع'})`,
    '',
    ...lines,
    '',
    `المجموع الفرعي: ${order.subtotal} ${currency}`,
    `مصاريف التوصيل: ${order.deliveryFee} ${currency} (${deliveryTypeStr})`,
    `الإجمالي النهائي: ${order.total} ${currency}`,
    `طريقة الدفع: ${order.payment === 'cod' ? 'الدفع عند الاستلام' : 'تحويل عبر بريدي موب'}`,
    '',
    `👤 العميل: ${order.name}`,
    `📞 الهاتف: ${order.phone}${order.phoneAlt ? ` | هاتف إضافي: ${order.phoneAlt}` : ''}`,
    `📍 الولاية والبلدية: ${order.wilayaName} - ${order.commune}`,
    `🏠 العنوان: ${order.address}`,
    ...(order.landmark ? [`🏢 أقرب معلم: ${order.landmark}`] : []),
    ...(order.notes ? [`📝 ملاحظات: ${order.notes}`] : []),
  ].join('\n');
}


export function adminOrderButtons(origin: string, orderId: number): Button[][] {
  const orderUrl = `${origin}/admin/orders/${orderId}`;
  const isHttps = origin.startsWith("https://");

  return [
    [
      { text: '✅ تأكيد الطلب', callback_data: `st:${orderId}:confirmed` },
      { text: '⏳ قيد التأكيد', callback_data: `st:${orderId}:pending_confirmation` },
    ],
    [
      { text: '📦 قيد التحضير', callback_data: `st:${orderId}:preparing` },
      { text: '🚚 خرج للتوصيل', callback_data: `st:${orderId}:out_for_delivery` },
    ],
    [
      { text: '❌ إلغاء', callback_data: `st:${orderId}:cancelled` },
      isHttps
        ? { text: 'عرض في لوحة التحكم', web_app: { url: orderUrl } }
        : { text: 'عرض في لوحة التحكم', callback_data: `view:${orderId}` },
    ],
  ];
}


export async function notifyAdminsOfOrder(env: Env, origin: string, order: OrderSummary, currency: string) {
  const text = orderText(order, currency);
  await Promise.all(adminIds(env).map((id) => sendMessage(env, id, text, adminOrderButtons(origin, order.id))));
}

export function notifyCustomerOfStatus(
  env: Env,
  origin: string,
  chatId: string,
  order: { id: number; token: string; status: OrderStatus },
) {
  const icons: Record<OrderStatus, string> = {
    new: '🕒',
    pending_confirmation: '⏳',
    confirmed: '✅',
    preparing: '📦',
    out_for_delivery: '🚚',
    delivered: '🎉',
    cancelled: '❌',
    returned: '🔄',
  };
  return sendMessage(env, chatId, `${icons[order.status]} طلبك #${order.id}: ${STATUS_LABELS[order.status]}`, [
    [{ text: 'تفاصيل ومتابعة الطلب', web_app: { url: `${origin}/o/${order.token}` } }],
  ]);
}
