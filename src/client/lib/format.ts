export const money = (amount: number, currency: string = 'د.ج') => `${amount.toLocaleString('en-US')} ${currency}`;

const relative = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

/** "منذ 5 دقائق" style time for unix seconds. */
export function timeAgo(unixSeconds: number) {
  const diff = unixSeconds - Date.now() / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ];
  let value = diff;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return relative.format(Math.round(value), 'year');
}

export const dateTime = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleString('ar-DZ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Handles uploaded photos (Cloudinary, KV, or external http links) and demo files.
 */
export const imageUrl = (key?: string | null) => {
  if (!key) return '/demo/bag-brazil.svg';
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return key;
  return `/img/${key}`;
};

/**
 * Normalizes Algerian phone number to international format: +213XXXXXXXXX
 */
export function normalizeAlgerianPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  const bare = digits.replace(/^\+/, '');
  if (/^213[567]\d{8}$/.test(bare)) return `+${bare}`;
  if (/^0[567]\d{8}$/.test(bare)) return `+213${bare.slice(1)}`;
  if (/^[567]\d{8}$/.test(bare)) return `+213${bare}`;
  return digits;
}

export function isValidAlgerianPhone(raw: string): boolean {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return /^(0|\+213)?[567]\d{8}$/.test(cleaned);
}

export function displayAlgerianPhone(phone: string): string {
  if (phone.startsWith('+213')) return `0${phone.slice(4)}`;
  return phone;
}

/**
 * Calculates delivery fee based on wilaya, home vs desk, and store free shipping threshold.
 */
export function calcDeliveryFee(
  subtotal: number,
  wilayaId: number = 16,
  deliveryType: 'home' | 'desk' = 'home',
  rates: { wilayaId: number; homeFee: number; deskFee: number; isAvailable: boolean }[] = [],
  store: { defaultHomeDeliveryFee?: number; defaultDeskDeliveryFee?: number; freeShippingOver?: number } = {},
): number {
  if (store.freeShippingOver && store.freeShippingOver > 0 && subtotal >= store.freeShippingOver) {
    return 0;
  }
  const custom = rates.find((r) => r.wilayaId === wilayaId);
  if (custom) {
    return deliveryType === 'desk' ? custom.deskFee : custom.homeFee;
  }
  return deliveryType === 'desk'
    ? (store.defaultDeskDeliveryFee ?? 350)
    : (store.defaultHomeDeliveryFee ?? 600);
}

/** Compatibility fallback for store.deliveryFee */
export const deliveryFor = (
  subtotal: number,
  store: { deliveryFee?: number; defaultHomeDeliveryFee?: number; freeShippingOver: number },
) => (store.freeShippingOver > 0 && subtotal >= store.freeShippingOver ? 0 : store.defaultHomeDeliveryFee ?? store.deliveryFee ?? 600);

export const discountPercent = (price: number, oldPrice: number | null) =>
  oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

/** Arabic counting: 1 طلب، 2 طلبان، 3–10 طلبات، 11+ طلباً. */
export function count(n: number, [one, two, few, many]: [string, string, string, string]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const ORDERS_WORDS: [string, string, string, string] = ['طلب واحد', 'طلبان', 'طلبات', 'طلباً'];
export const ITEMS_WORDS: [string, string, string, string] = ['منتج واحد', 'منتجان', 'منتجات', 'منتجاً'];

export const STATUS_LABELS = {
  new: 'جديد',
  pending_confirmation: 'قيد التأكيد',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
  returned: 'مرتجع',
} as const;

export type OrderStatus = keyof typeof STATUS_LABELS;

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_confirmation: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  preparing: 'bg-purple-50 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  returned: 'bg-gray-100 text-gray-700 border-gray-300',
};
