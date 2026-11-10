import { Hono, type Context } from 'hono';
import { and, asc, count, desc, eq, inArray, like, or, sql, sum } from 'drizzle-orm';
import {
  admins,
  banners,
  categories,
  deliveryRates,
  ORDER_STATUSES,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  settings,
  type OrderStatus,
  type ProductSectionConfig,
  type ProductVariantConfig,
} from '../db/schema';
import { isImageKey } from '../imageKeys';
import type { AppEnv } from '../env';
import { hashPassword, requireAdmin, setAdminCookie, verifyPassword } from '../auth';
import { saveImage, imageResponse } from '../images';
import { notifyCustomerOfStatus, STATUS_LABELS } from '../telegram';
import { getSettings } from './store';

export const admin = new Hono<AppEnv>();
admin.use('*', requireAdmin);

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const wholeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 10_000_000 ? n : null;
};

admin.get('/me', (c) => c.json({ ok: true }));

admin.get('/stats', async (c) => {
  const db = c.get('db');
  const offset = Math.max(-840, Math.min(840, Number(c.req.query('tz')) || 0)) * 60;
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = Math.floor((now - offset) / 86400) * 86400 + offset;
  const weekAgo = startOfDay - 6 * 86400;

  const sales = (since: number) =>
    db
      .select({ n: count(), revenue: sum(orders.total) })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${since} and ${orders.status} not in ('cancelled', 'returned')`);

  const [byStatus, [today], [week], [catalog]] = await Promise.all([
    db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
    sales(startOfDay),
    sales(weekAgo),
    db.select({ total: count(), soldOut: sql<number>`sum(case when ${products.available} then 0 else 1 end)` }).from(products),
  ]);

  return c.json({
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row.n])),
    today: { orders: today.n, revenue: Number(today.revenue ?? 0) },
    week: { orders: week.n, revenue: Number(week.revenue ?? 0) },
    products: { total: catalog.total, soldOut: Number(catalog.soldOut ?? 0) },
  });
});

// ---------- Orders ----------

admin.get('/orders', async (c) => {
  const db = c.get('db');
  const status = c.req.query('status') as OrderStatus | undefined;
  const search = c.req.query('q')?.trim();
  const wilayaId = Number(c.req.query('wilayaId')) || undefined;
  const deliveryType = c.req.query('deliveryType') as 'home' | 'desk' | undefined;

  const conditions = [];

  if (status && ORDER_STATUSES.includes(status)) {
    conditions.push(eq(orders.status, status));
  }
  if (wilayaId && wilayaId >= 1 && wilayaId <= 69) {
    conditions.push(eq(orders.wilayaId, wilayaId));
  }
  if (deliveryType === 'home' || deliveryType === 'desk') {
    conditions.push(eq(orders.deliveryType, deliveryType));
  }
  if (search) {
    const s = `%${search}%`;
    const searchConditions = [
      like(orders.name, s),
      like(orders.phone, s),
      like(orders.wilayaName, s),
      like(orders.commune, s),
    ];
    if (Number.isInteger(Number(search))) {
      searchConditions.push(eq(orders.id, Number(search)));
    }
    conditions.push(or(...searchConditions));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const list = await db
    .select({
      id: orders.id,
      token: orders.token,
      status: orders.status,
      source: orders.source,
      name: orders.name,
      phone: orders.phone,
      phoneAlt: orders.phoneAlt,
      wilayaId: orders.wilayaId,
      wilayaName: orders.wilayaName,
      daira: orders.daira,
      commune: orders.commune,
      deliveryType: orders.deliveryType,
      total: orders.total,
      payment: orders.payment,
      createdAt: orders.createdAt,
      itemCount: sql<number>`(select coalesce(sum(qty), 0) from order_items where order_items.order_id = "orders"."id")`,
    })
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.id))
    .limit(300);

  return c.json({ orders: list });
});

admin.get('/orders/export-csv', async (c) => {
  const db = c.get('db');
  const allOrders = await db.select().from(orders).orderBy(desc(orders.id));
  const allItems = await db.select().from(orderItems);

  const itemsByOrder = new Map<number, string[]>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(`${item.name} (${item.variantDetails || 'عادي'}) × ${item.qty}`);
    itemsByOrder.set(item.orderId, list);
  }

  const headers = [
    'رقم الطلب',
    'التاريخ',
    'الحالة',
    'اسم العميل',
    'الهاتف الأساسي',
    'الهاتف الإضافي',
    'الولاية',
    'الدائرة',
    'البلدية',
    'الحي',
    'العنوان المفصل',
    'أقرب معلم',
    'نوع التوصيل',
    'المنتجات',
    'المجموع الفرعي',
    'مصاريف التوصيل',
    'الإجمالي',
    'طريقة الدفع',
    'ملاحظات',
  ];

  const rows = allOrders.map((o) => [
    o.id,
    new Date(o.createdAt * 1000).toLocaleString('ar-DZ'),
    STATUS_LABELS[o.status] || o.status,
    `"${(o.name || '').replace(/"/g, '""')}"`,
    `"${o.phone}"`,
    `"${o.phoneAlt || ''}"`,
    `"${o.wilayaName}"`,
    `"${o.daira || ''}"`,
    `"${o.commune || ''}"`,
    `"${o.district || ''}"`,
    `"${(o.address || '').replace(/"/g, '""')}"`,
    `"${(o.landmark || '').replace(/"/g, '""')}"`,
    o.deliveryType === 'desk' ? 'استلام من المكتب' : 'توصيل للمنزل',
    `"${(itemsByOrder.get(o.id)?.join(' + ') || '').replace(/"/g, '""')}"`,
    o.subtotal,
    o.deliveryFee,
    o.total,
    o.payment === 'cod' ? 'عند الاستلام' : 'تحويل',
    `"${(o.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

admin.get('/orders/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return c.json({ error: 'الطلب غير موجود' }, 404);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, id))
    .orderBy(desc(orderStatusHistory.id));
  return c.json({ order, items, history });
});

export async function changeOrderStatus(c: Context<AppEnv>, id: number, status: OrderStatus, note?: string) {
  const db = c.get('db');
  const [current] = await db.select().from(orders).where(eq(orders.id, id));
  if (!current) return null;

  const [order] = await db
    .update(orders)
    .set({ status, updatedAt: sql`(unixepoch())` })
    .where(eq(orders.id, id))
    .returning();

  await db.insert(orderStatusHistory).values({
    orderId: id,
    oldStatus: current.status,
    newStatus: status,
    note: note || `تعديل الحالة إلى ${STATUS_LABELS[status] || status}`,
  });

  if (order?.telegramChatId) {
    c.executionCtx.waitUntil(
      notifyCustomerOfStatus(c.env, new URL(c.req.url).origin, order.telegramChatId, order).catch((e) =>
        console.error(e),
      ),
    );
  }
  return order;
}

admin.patch('/orders/:id', async (c) => {
  const { status, note } = await c.req.json<{ status: OrderStatus; note?: string }>();
  if (!ORDER_STATUSES.includes(status)) return c.json({ error: 'حالة غير معروفة' }, 400);
  const order = await changeOrderStatus(c, Number(c.req.param('id')), status, note);
  if (!order) return c.json({ error: 'الطلب غير موجود' }, 404);
  return c.json({ order });
});

admin.post('/orders/bulk-status', async (c) => {
  const { ids, status, note } = await c.req.json<{ ids: number[]; status: OrderStatus; note?: string }>();
  if (!ORDER_STATUSES.includes(status)) return c.json({ error: 'حالة غير معروفة' }, 400);
  const validIds = (Array.isArray(ids) ? ids : []).filter(Number.isInteger);
  for (const id of validIds) {
    await changeOrderStatus(c, id, status, note || 'تعديل جماعي للحالة');
  }
  return c.json({ ok: true, count: validIds.length });
});

admin.get('/receipts/:key', async (c) => {
  const key = c.req.param('key');
  if (!key.startsWith('rcpt_')) return c.json({ error: 'غير موجود' }, 404);
  return imageResponse(c.env, key, 'private, max-age=3600');
});

// ---------- Delivery Rates ----------

admin.get('/delivery-rates', async (c) => {
  const rates = await c.get('db').select().from(deliveryRates).orderBy(asc(deliveryRates.wilayaId));
  return c.json({ rates });
});

admin.put('/delivery-rates', async (c) => {
  const body = await c.req.json<{
    wilayaId: number;
    wilayaName: string;
    homeFee: number;
    deskFee: number;
    isAvailable?: boolean;
  }>();

  const wilayaId = Number(body.wilayaId);
  if (!wilayaId || wilayaId < 1 || wilayaId > 69) return c.json({ error: 'رقم الولاية غير صحيح' }, 400);
  const homeFee = wholeNumber(body.homeFee);
  const deskFee = wholeNumber(body.deskFee);
  if (homeFee === null || deskFee === null) return c.json({ error: 'أسعار التوصيل يجب أن تكون أرقاماً صحيحة' }, 400);

  const db = c.get('db');
  const [rate] = await db
    .insert(deliveryRates)
    .values({
      wilayaId,
      wilayaName: text(body.wilayaName, 60),
      homeFee,
      deskFee,
      isAvailable: body.isAvailable !== false,
    })
    .onConflictDoUpdate({
      target: deliveryRates.wilayaId,
      set: {
        wilayaName: text(body.wilayaName, 60),
        homeFee,
        deskFee,
        isAvailable: body.isAvailable !== false,
      },
    })
    .returning();

  return c.json({ rate });
});

// ---------- Products ----------

admin.get('/products', async (c) => {
  const list = await c.get('db').select().from(products).orderBy(asc(products.sort), desc(products.id));
  return c.json({ products: list });
});

function readProduct(body: Record<string, unknown>) {
  const name = text(body.name, 120);
  const price = wholeNumber(body.price);
  if (name.length < 2) return { error: 'اكتب اسم المنتج' } as const;
  if (price === null) return { error: 'السعر يجب أن يكون رقماً صحيحاً' } as const;
  const oldPrice = body.oldPrice === null || body.oldPrice === '' || body.oldPrice === undefined ? null : wholeNumber(body.oldPrice);

  const images = Array.isArray(body.images)
    ? (body.images as unknown[]).filter((k): k is string => typeof k === 'string' && k.length > 0).slice(0, 10)
    : [];

  const videoUrl = text(body.videoUrl, 300);
  const variants = typeof body.variants === 'object' && body.variants !== null ? (body.variants as ProductVariantConfig) : {};
  const sections = Array.isArray(body.sections) ? (body.sections as ProductSectionConfig[]) : [];

  return {
    value: {
      name,
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
      description: text(body.description, 3000),
      categoryId: Number.isInteger(body.categoryId) ? (body.categoryId as number) : null,
      images,
      videoUrl,
      variants,
      sections,
      available: body.available !== false,
    },
  } as const;
}

admin.post('/products', async (c) => {
  const parsed = readProduct(await c.req.json());
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const [product] = await c.get('db').insert(products).values(parsed.value).returning();
  return c.json({ product });
});

admin.put('/products/:id', async (c) => {
  const parsed = readProduct(await c.req.json());
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const id = Number(c.req.param('id'));
  const db = c.get('db');
  const [product] = await db.update(products).set(parsed.value).where(eq(products.id, id)).returning();
  if (!product) return c.json({ error: 'المنتج غير موجود' }, 404);
  return c.json({ product });
});

admin.delete('/products/:id', async (c) => {
  const db = c.get('db');
  const [product] = await db.delete(products).where(eq(products.id, Number(c.req.param('id')))).returning();
  return c.json({ ok: Boolean(product) });
});

admin.post('/images', async (c) => {
  const file = (await c.req.formData()).get('file');
  if (!(file instanceof File)) return c.json({ error: 'اختر صورة' }, 400);
  const saved = await saveImage(c.env, file, 'img');
  if ('error' in saved) return c.json({ error: saved.error }, 400);
  return c.json(saved);
});

// ---------- Categories ----------

admin.post('/categories', async (c) => {
  const body = await c.req.json();
  const name = text(body.name, 60);
  if (name.length < 2) return c.json({ error: 'اكتب اسم القسم' }, 400);
  const db = c.get('db');
  const [{ n }] = await db.select({ n: count() }).from(categories);
  const imageKey = isImageKey(body.imageKey) ? body.imageKey : null;
  const [category] = await db.insert(categories).values({ name, imageKey, sort: n }).returning();
  return c.json({ category });
});

admin.put('/categories/:id', async (c) => {
  const body = await c.req.json();
  const name = text(body.name, 60);
  if (name.length < 2) return c.json({ error: 'اكتب اسم القسم' }, 400);
  const imageKey = isImageKey(body.imageKey) ? body.imageKey : null;
  const [category] = await c
    .get('db')
    .update(categories)
    .set({ name, imageKey })
    .where(eq(categories.id, Number(c.req.param('id'))))
    .returning();
  return c.json({ category });
});

admin.delete('/categories/:id', async (c) => {
  await c.get('db').delete(categories).where(eq(categories.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

admin.post('/categories/order', async (c) => {
  const { ids } = await c.req.json<{ ids: number[] }>();
  const db = c.get('db');
  const valid = (Array.isArray(ids) ? ids : []).filter(Number.isInteger);
  const existing = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, valid));
  if (existing.length) {
    await db.batch(
      valid.map((id, sort) => db.update(categories).set({ sort }).where(eq(categories.id, id))) as [any, ...any[]],
    );
  }
  return c.json({ ok: true });
});

// ---------- Banners ----------

function readBanner(body: Record<string, unknown>) {
  const hex = (v: unknown, fallback: string) => {
    const s = text(v, 7);
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
  };
  const hexOrEmpty = (v: unknown) => {
    const s = text(v, 7);
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '';
  };
  const borderW = (v: unknown) => {
    const n = wholeNumber(v);
    return n === null ? 0 : Math.min(10, Math.max(0, n));
  };
  const opac = (v: unknown) => {
    const n = wholeNumber(v);
    return n === null ? 100 : Math.min(100, Math.max(0, n));
  };
  const fontS = (v: unknown) => {
    const s = text(v, 10);
    return ['sm', 'base', 'lg', 'xl', '2xl'].includes(s) ? s : '';
  };
  const imageKey = text(body.imageKey, 200);
  if (!imageKey) return { error: 'اختر صورة البنر' } as const;
  const link = text(body.link, 100);
  return {
    value: {
      imageKey,
      title: text(body.title, 80),
      titleColor: hex(body.titleColor, '#ffffff'),
      titleBg: hexOrEmpty(body.titleBg),
      titleBgOpacity: opac(body.titleBgOpacity),
      titleBorderColor: hexOrEmpty(body.titleBorderColor),
      titleBorderWidth: borderW(body.titleBorderWidth),
      titleFontSize: fontS(body.titleFontSize),
      titleTextStrokeColor: hexOrEmpty(body.titleTextStrokeColor),
      titleTextStrokeWidth: borderW(body.titleTextStrokeWidth),
      subtitle: text(body.subtitle, 140),
      subtitleColor: hex(body.subtitleColor, '#ffffff'),
      subtitleBg: hexOrEmpty(body.subtitleBg),
      subtitleBgOpacity: opac(body.subtitleBgOpacity),
      subtitleBorderColor: hexOrEmpty(body.subtitleBorderColor),
      subtitleBorderWidth: borderW(body.subtitleBorderWidth),
      subtitleFontSize: fontS(body.subtitleFontSize),
      subtitleTextStrokeColor: hexOrEmpty(body.subtitleTextStrokeColor),
      subtitleTextStrokeWidth: borderW(body.subtitleTextStrokeWidth),
      buttonText: text(body.buttonText, 30),
      buttonBgColor: hex(body.buttonBgColor, '#ffffff'),
      buttonBgOpacity: opac(body.buttonBgOpacity),
      buttonTextColor: hex(body.buttonTextColor, '#1a1a1a'),
      buttonBorderColor: hexOrEmpty(body.buttonBorderColor),
      buttonBorderWidth: borderW(body.buttonBorderWidth),
      buttonRadius: text(body.buttonRadius, 10),
      buttonTextStrokeColor: hexOrEmpty(body.buttonTextStrokeColor),
      buttonTextStrokeWidth: borderW(body.buttonTextStrokeWidth),
      link: /^\/(c|p)\/\d+$/.test(link) ? link : '',
    },
  } as const;
}

admin.post('/banners', async (c) => {
  const parsed = readBanner(await c.req.json());
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const db = c.get('db');
  const [{ n }] = await db.select({ n: count() }).from(banners);
  const [banner] = await db.insert(banners).values({ ...parsed.value, sort: n }).returning();
  return c.json({ banner });
});

admin.put('/banners/:id', async (c) => {
  const parsed = readBanner(await c.req.json());
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const [banner] = await c
    .get('db')
    .update(banners)
    .set(parsed.value)
    .where(eq(banners.id, Number(c.req.param('id'))))
    .returning();
  return c.json({ banner });
});

admin.delete('/banners/:id', async (c) => {
  await c.get('db').delete(banners).where(eq(banners.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

// ---------- Settings ----------

admin.get('/settings', async (c) => c.json({ settings: await getSettings(c) }));

admin.put('/settings', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const name = text(body.name, 60);
  if (name.length < 2) return c.json({ error: 'اكتب اسم المتجر' }, 400);
  const color = typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#1b6b44';
  const defaultHomeDeliveryFee = wholeNumber(body.defaultHomeDeliveryFee) ?? wholeNumber(body.deliveryFee) ?? 600;
  const defaultDeskDeliveryFee = wholeNumber(body.defaultDeskDeliveryFee) ?? 350;
  const freeShippingOver = wholeNumber(body.freeShippingOver) ?? 0;
  const logoKey = text(body.logoKey, 200) || null;

  const [row] = await c
    .get('db')
    .update(settings)
    .set({
      name,
      tagline: text(body.tagline, 120),
      color,
      currency: text(body.currency, 10) || 'د.ج',
      defaultHomeDeliveryFee,
      defaultDeskDeliveryFee,
      freeShippingOver,
      announcement: text(body.announcement, 140),
      whatsapp: text(body.whatsapp, 20).replace(/[^\d+]/g, ''),
      transferInfo: text(body.transferInfo, 800),
      cloudinaryCloudName: text(body.cloudinaryCloudName, 100),
      cloudinaryUploadPreset: text(body.cloudinaryUploadPreset, 100),
      isOpen: body.isOpen !== false,
      logoKey,
    })
    .where(eq(settings.id, 1))
    .returning();
  return c.json({ settings: row });
});

// ---------- Security / Password Change ----------

admin.post('/change-password', async (c) => {
  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword?: string;
    newPassword?: string;
  }>();
  const session = c.get('session');
  const db = c.get('db');

  if (!newPassword || newPassword.length < 12) {
    return c.json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 12 حرفاً' }, 400);
  }

  let adminRecord = null;
  if (session?.adminId) {
    [adminRecord] = await db.select().from(admins).where(eq(admins.id, session.adminId));
  } else {
    // If logged in via Telegram recovery or dev login, pick the store admin record
    [adminRecord] = await db.select().from(admins).limit(1);
  }

  if (session?.adminId && adminRecord) {
    if (!currentPassword) {
      return c.json({ error: 'يرجى إدخال كلمة المرور الحالية' }, 400);
    }
    const isCurrentValid = await verifyPassword(currentPassword, adminRecord.passwordHash);
    if (!isCurrentValid) {
      return c.json({ error: 'كلمة المرور الحالية غير صحيحة' }, 400);
    }
  }

  if (!adminRecord) {
    return c.json({ error: 'لم يتم العثور على حساب المدير في قاعدة البيانات' }, 404);
  }

  const newHash = await hashPassword(newPassword);
  const nextTokenVersion = adminRecord.tokenVersion + 1;

  await db
    .update(admins)
    .set({
      passwordHash: newHash,
      tokenVersion: nextTokenVersion,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(admins.id, adminRecord.id));

  // Issue new session cookie with updated tokenVersion for the active session
  await setAdminCookie(c, {
    role: 'admin',
    adminId: adminRecord.id,
    tokenVersion: nextTokenVersion,
  });

  return c.json({ ok: true, message: 'تم تحديث كلمة المرور وإبطال كافة الجلسات السابقة بنجاح' });
});

// ---------- Backup / Export ----------

admin.get('/backup/export', async (c) => {
  const db = c.get('db');
  const [s, cats, bans, prods, ords, ordItems, rates] = await Promise.all([
    getSettings(c),
    db.select().from(categories),
    db.select().from(banners),
    db.select().from(products),
    db.select().from(orders),
    db.select().from(orderItems),
    db.select().from(deliveryRates),
  ]);

  return c.json({
    exportedAt: new Date().toISOString(),
    settings: s,
    categories: cats,
    banners: bans,
    products: prods,
    orders: ords,
    orderItems: ordItems,
    deliveryRates: rates,
  });
});
