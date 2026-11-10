import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) =>
  integer(name)
    .notNull()
    .default(sql`(unixepoch())`);

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

/** One row (id = 1): store global settings editable from dashboard. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().default('متجر الجزائر'),
  tagline: text('tagline').notNull().default('تسوق أونلاين في 69 ولاية'),
  logoKey: text('logo_key'),
  color: text('color').notNull().default('#1b6b44'),
  currency: text('currency').notNull().default('د.ج'),
  defaultHomeDeliveryFee: integer('default_home_delivery_fee').notNull().default(600),
  defaultDeskDeliveryFee: integer('default_desk_delivery_fee').notNull().default(350),
  freeShippingOver: integer('free_shipping_over').notNull().default(0),
  announcement: text('announcement').notNull().default('التوصيل متوفر لجميع الولايات الـ 69 والدفع عند الاستلام'),
  whatsapp: text('whatsapp').notNull().default(''),
  transferInfo: text('transfer_info').notNull().default(''),
  cloudinaryCloudName: text('cloudinary_cloud_name').notNull().default(''),
  cloudinaryUploadPreset: text('cloudinary_upload_preset').notNull().default(''),
  isOpen: integer('is_open', { mode: 'boolean' }).notNull().default(true),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  imageKey: text('image_key'),
  sort: integer('sort').notNull().default(0),
});

export const banners = sqliteTable('banners', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageKey: text('image_key').notNull(),
  title: text('title').notNull().default(''),
  titleColor: text('title_color').notNull().default('#ffffff'),
  titleBg: text('title_bg').notNull().default(''),
  titleBgOpacity: integer('title_bg_opacity').notNull().default(100),
  titleBorderColor: text('title_border_color').notNull().default(''),
  titleBorderWidth: integer('title_border_width').notNull().default(0),
  titleFontSize: text('title_font_size').notNull().default(''),
  subtitle: text('subtitle').notNull().default(''),
  subtitleColor: text('subtitle_color').notNull().default('#ffffff'),
  subtitleBg: text('subtitle_bg').notNull().default(''),
  subtitleBgOpacity: integer('subtitle_bg_opacity').notNull().default(100),
  subtitleBorderColor: text('subtitle_border_color').notNull().default(''),
  subtitleBorderWidth: integer('subtitle_border_width').notNull().default(0),
  subtitleFontSize: text('subtitle_font_size').notNull().default(''),
  buttonText: text('button_text').notNull().default(''),
  buttonBgColor: text('button_bg_color').notNull().default('#ffffff'),
  buttonBgOpacity: integer('button_bg_opacity').notNull().default(100),
  buttonTextColor: text('button_text_color').notNull().default('#1a1a1a'),
  buttonBorderColor: text('button_border_color').notNull().default(''),
  buttonBorderWidth: integer('button_border_width').notNull().default(0),
  buttonRadius: text('button_radius').notNull().default(''),
  link: text('link').notNull().default(''),
  sort: integer('sort').notNull().default(0),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    price: integer('price').notNull(),
    oldPrice: integer('old_price'),
    images: text('images', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    videoUrl: text('video_url').notNull().default(''),
    variants: text('variants', { mode: 'json' }).$type<ProductVariantConfig>().notNull().default(sql`'{}'`),
    sections: text('sections', { mode: 'json' }).$type<ProductSectionConfig[]>().notNull().default(sql`'[]'`),
    available: integer('available', { mode: 'boolean' }).notNull().default(true),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('products_category_idx').on(t.categoryId)],
);

export const deliveryRates = sqliteTable('delivery_rates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wilayaId: integer('wilaya_id').notNull().unique(),
  wilayaName: text('wilaya_name').notNull(),
  homeFee: integer('home_fee').notNull(),
  deskFee: integer('desk_fee').notNull(),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
});

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: text('telegram_id').notNull().unique(),
  firstName: text('first_name').notNull().default(''),
  username: text('username'),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  createdAt: timestamp('created_at'),
});

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

export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    token: text('token').notNull().unique(),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('new'),
    source: text('source', { enum: ['web', 'telegram'] }).notNull(),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    telegramChatId: text('telegram_chat_id'),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    phoneAlt: text('phone_alt').notNull().default(''),
    wilayaId: integer('wilaya_id').notNull().default(16),
    wilayaName: text('wilaya_name').notNull().default('الجزائر'),
    daira: text('daira').notNull().default(''),
    commune: text('commune').notNull().default(''),
    district: text('district').notNull().default(''),
    address: text('address').notNull(),
    landmark: text('landmark').notNull().default(''),
    deliveryType: text('delivery_type', { enum: ['home', 'desk'] }).notNull().default('home'),
    notes: text('notes').notNull().default(''),
    payment: text('payment', { enum: ['cod', 'transfer'] }).notNull().default('cod'),
    receiptKey: text('receipt_key'),
    subtotal: integer('subtotal').notNull(),
    deliveryFee: integer('delivery_fee').notNull(),
    total: integer('total').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('orders_status_idx').on(t.status), index('orders_customer_idx').on(t.customerId)],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    qty: integer('qty').notNull(),
    variantDetails: text('variant_details').notNull().default(''),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const orderStatusHistory = sqliteTable(
  'order_status_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    oldStatus: text('old_status').notNull(),
    newStatus: text('new_status').notNull(),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('history_order_idx').on(t.orderId)],
);

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  tokenVersion: integer('token_version').notNull().default(1),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: integer('locked_until'),
  lastFailedAt: integer('last_failed_at'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    ip: text('ip').primaryKey(),
    attempts: integer('attempts').notNull().default(0),
    lockedUntil: integer('locked_until'),
    lastAttemptAt: integer('last_attempt_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('login_attempts_ip_idx').on(t.ip)],
);

