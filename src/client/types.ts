export const ORDER_STATUSES = [
  'new',
  'pending_confirmation',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ProductVariantConfig {
  colors?: { name: string; hex?: string }[];
  sizes?: string[];
}

export interface ProductSectionConfig {
  id: string;
  type: 'features' | 'specs' | 'faq' | 'video' | 'html';
  title?: string;
  enabled: boolean;
  content: any;
}

export interface StoreInfo {
  name: string;
  tagline: string;
  logo: string | null;
  color: string;
  currency: string;
  defaultHomeDeliveryFee: number;
  defaultDeskDeliveryFee: number;
  deliveryFee: number; // fallback/compat
  freeShippingOver: number;
  announcement: string;
  whatsapp: string;
  transferInfo: string;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  isOpen: boolean;
  botUsername: string | null;
}

export interface Category {
  id: number;
  name: string;
  imageKey: string | null;
  sort: number;
}

export interface Banner {
  id: number;
  imageKey: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  sort: number;
}

export interface Product {
  id: number;
  categoryId: number | null;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  images: string[];
  videoUrl?: string;
  variants?: ProductVariantConfig;
  sections?: ProductSectionConfig[];
  available: boolean;
  createdAt: number;
}

export interface DeliveryRate {
  id: number;
  wilayaId: number;
  wilayaName: string;
  homeFee: number;
  deskFee: number;
  isAvailable: boolean;
}

export interface StoreData {
  store: StoreInfo;
  categories: Category[];
  banners: Banner[];
  bestSellers: number[];
  products: Product[];
  deliveryRates?: DeliveryRate[];
}

export interface OrderItem {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  qty: number;
  variantDetails?: string;
}

export interface OrderStatusHistory {
  id: number;
  orderId: number;
  oldStatus: string;
  newStatus: string;
  note: string;
  createdAt: number;
}

export interface Order {
  id: number;
  token: string;
  status: OrderStatus;
  source: 'web' | 'telegram';
  name: string;
  phone: string;
  phoneAlt?: string;
  wilayaId: number;
  wilayaName: string;
  daira: string;
  commune: string;
  district?: string;
  address: string;
  landmark?: string;
  deliveryType: 'home' | 'desk';
  notes: string;
  payment: 'cod' | 'transfer';
  receiptKey?: string | null;
  telegramChatId?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: number;
  updatedAt: number;
  items?: OrderItem[];
  history?: OrderStatusHistory[];
}
