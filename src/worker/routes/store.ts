import { Hono, type Context } from "hono";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import {
  admins,
  banners,
  categories,
  customers,
  deliveryRates,
  loginAttempts,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  settings,
  type OrderStatus,
} from "../db/schema";
import type { AppEnv } from "../env";
import {
  clearAdminCookie,
  createSession,
  DUMMY_HASH,
  getClientIp,
  isAdminId,
  setAdminCookie,
  verifyInitData,
  verifyPassword,
} from "../auth";
import { notifyAdminsOfOrder } from "../telegram";
import { saveImage } from "../images";

export const store = new Hono<AppEnv>();

export async function getSettings(c: Context<AppEnv>) {
  const [row] = await c
    .get("db")
    .select()
    .from(settings)
    .where(eq(settings.id, 1));
  if (!row) throw new Error("settings row missing: run the seed");
  return row;
}

/** Everything the storefront needs in one request: settings, categories, products and delivery rates. */
store.get("/store", async (c) => {
  const db = c.get("db");
  const [s, cats, items, slides, sold, rates] = await Promise.all([
    getSettings(c),
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.sort), asc(categories.id)),
    db.select().from(products).orderBy(asc(products.sort), desc(products.id)),
    db.select().from(banners).orderBy(asc(banners.sort), asc(banners.id)),
    // Best sellers: most units in orders that weren't cancelled.
    db
      .select({
        id: orderItems.productId,
        n: sql<number>`sum(${orderItems.qty})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(ne(orders.status, "cancelled"), isNotNull(orderItems.productId)),
      )
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`2`))
      .limit(12),
    db.select().from(deliveryRates),
  ]);

  return c.json({
    store: {
      name: s.name,
      tagline: s.tagline,
      logo: s.logoKey,
      color: s.color,
      currency: s.currency,
      defaultHomeDeliveryFee: s.defaultHomeDeliveryFee,
      defaultDeskDeliveryFee: s.defaultDeskDeliveryFee,
      deliveryFee: s.defaultHomeDeliveryFee,
      freeShippingOver: s.freeShippingOver,
      announcement: s.announcement,
      whatsapp: s.whatsapp,
      transferInfo: s.transferInfo,
      cloudinaryCloudName: s.cloudinaryCloudName,
      cloudinaryUploadPreset: s.cloudinaryUploadPreset,
      isOpen: s.isOpen,
      botUsername: c.env.BOT_USERNAME || null,
    },
    categories: cats,
    banners: slides,
    bestSellers: sold.map((row) => row.id!),
    products: items.map(({ createdAt, sort, ...p }) => ({ ...p, createdAt })),
    deliveryRates: rates,
  });
});

/** Inside Telegram: trade the signed initData for a session, creating the customer on first visit. */
store.post("/auth/telegram", async (c) => {
  const { initData } = await c.req.json<{ initData?: string }>();
  if (!c.env.BOT_TOKEN)
    return c.json({ error: "البوت غير مضبوط بعد (BOT_TOKEN)" }, 500);
  const user = initData
    ? await verifyInitData(initData, c.env.BOT_TOKEN)
    : null;
  if (!user) return c.json({ error: "تعذّر التحقق من حساب تيليجرام" }, 401);

  const db = c.get("db");
  const telegramId = String(user.id);
  const [customer] = await db
    .insert(customers)
    .values({
      telegramId,
      firstName: user.first_name,
      username: user.username ?? null,
    })
    .onConflictDoUpdate({
      target: customers.telegramId,
      set: { firstName: user.first_name, username: user.username ?? null },
    })
    .returning();

  const isAdmin = isAdminId(c.env, telegramId);
  const token = await createSession(c.env, {
    role: isAdmin ? "admin" : "customer",
    tg: telegramId,
    cid: customer.id,
  });
  return c.json({
    token,
    user: { name: user.first_name, isAdmin },
    customer: { phone: customer.phone, address: customer.address },
  });
});

/** Admin login with email & password, strictly rate-limited and session-versioned */
store.post("/auth/login", async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  const db = c.get("db");
  const now = Math.floor(Date.now() / 1000);
  const clientIp = getClientIp(c);
  const normEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const cleanPassword = typeof password === "string" ? password : "";

  // 1. IP-level rate limiting check
  const [ipRecord] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.ip, clientIp));

  if (ipRecord && ipRecord.lockedUntil && ipRecord.lockedUntil > now) {
    const remainingMinutes = Math.ceil((ipRecord.lockedUntil - now) / 60);
    return c.json(
      { error: `تم حظر محاولات الدخول مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار ${remainingMinutes} دقيقة.` },
      429,
    );
  }

  // 2. Fetch admin by email
  const [admin] = normEmail
    ? await db.select().from(admins).where(eq(admins.email, normEmail))
    : [null];

  // 3. Admin account rate limiting check
  if (admin && admin.lockedUntil && admin.lockedUntil > now) {
    const remainingMinutes = Math.ceil((admin.lockedUntil - now) / 60);
    return c.json(
      { error: `تم قفل الحساب مؤقتاً لأسباب أمنية. يرجى الانتظار ${remainingMinutes} دقيقة.` },
      429,
    );
  }

  // 4. Verify password (or execute dummy comparison against timing attacks)
  let isValid = false;
  if (admin && cleanPassword) {
    isValid = await verifyPassword(cleanPassword, admin.passwordHash);
  } else {
    await verifyPassword(cleanPassword || "dummy", DUMMY_HASH);
  }

  // 5. Handle failure: generic error message to prevent user enumeration
  if (!isValid) {
    const LOCK_DURATION = 15 * 60; // 15 minutes lockout
    const MAX_ATTEMPTS = 15;

    const nextIpAttempts = (ipRecord?.attempts ?? 0) + 1;
    const ipLockUntil = nextIpAttempts >= MAX_ATTEMPTS ? now + LOCK_DURATION : null;

    await db
      .insert(loginAttempts)
      .values({
        ip: clientIp,
        attempts: nextIpAttempts,
        lockedUntil: ipLockUntil,
        lastAttemptAt: now,
      })
      .onConflictDoUpdate({
        target: loginAttempts.ip,
        set: {
          attempts: nextIpAttempts,
          lockedUntil: ipLockUntil,
          lastAttemptAt: now,
        },
      });

    if (admin) {
      const nextAdminAttempts = admin.failedAttempts + 1;
      const adminLockUntil = nextAdminAttempts >= MAX_ATTEMPTS ? now + LOCK_DURATION : null;
      await db
        .update(admins)
        .set({
          failedAttempts: nextAdminAttempts,
          lockedUntil: adminLockUntil,
          lastFailedAt: now,
          updatedAt: now,
        })
        .where(eq(admins.id, admin.id));
    }

    return c.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, 401);
  }

  // 6. Handle success: reset failed attempts
  if (ipRecord && (ipRecord.attempts > 0 || ipRecord.lockedUntil)) {
    await db
      .update(loginAttempts)
      .set({ attempts: 0, lockedUntil: null, lastAttemptAt: now })
      .where(eq(loginAttempts.ip, clientIp));
  }

  await db
    .update(admins)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: now })
    .where(eq(admins.id, admin!.id));

  // Set secure HttpOnly cookie with tokenVersion for session invalidation
  await setAdminCookie(c, {
    role: "admin",
    adminId: admin!.id,
    tokenVersion: admin!.tokenVersion,
  });

  return c.json({ ok: true });
});

/** One-click admin login, only on localhost and only when .dev.vars sets DEV_LOGIN=1. */
store.post("/auth/dev-login", async (c) => {
  const host = new URL(c.req.url).hostname;
  if (c.env.DEV_LOGIN !== "1" || !["localhost", "127.0.0.1"].includes(host))
    return c.json({ error: "غير متاح" }, 404);
  await setAdminCookie(c, { role: "admin" });
  return c.json({ ok: true });
});

store.get("/auth/dev-login", (c) => {
  const host = new URL(c.req.url).hostname;
  return c.json({
    available:
      c.env.DEV_LOGIN === "1" && ["localhost", "127.0.0.1"].includes(host),
  });
});

store.post("/auth/logout", (c) => {
  clearAdminCookie(c);
  return c.json({ ok: true });
});

interface OrderInputItem {
  id: number;
  qty: number;
  variantDetails?: string;
}

interface OrderInput {
  items: OrderInputItem[];
  name: string;
  phone: string;
  phoneAlt?: string;
  wilayaId?: number;
  wilayaName?: string;
  daira?: string;
  commune?: string;
  district?: string;
  address: string;
  landmark?: string;
  deliveryType?: "home" | "desk";
  notes?: string;
  payment: "cod" | "transfer";
  honeypot?: string; // Bot trap
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Normalizes Algerian phone for server storage. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+/, "");
  if (/^213[567]\d{8}$/.test(bare)) return `+${bare}`;
  if (/^0[567]\d{8}$/.test(bare)) return `+213${bare.slice(1)}`;
  if (/^[567]\d{8}$/.test(bare)) return `+213${bare}`;
  return digits;
}

/**
 * Places an order (multipart: `data` = JSON, optional `receipt` = transfer screenshot).
 * Prices and delivery fees are always recomputed here from the database.
 */
store.post("/orders", async (c) => {
  const db = c.get("db");
  const session = c.get("session");
  const form = await c.req.formData();
  let input: OrderInput;
  try {
    input = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return c.json({ error: "بيانات الطلب غير صالحة" }, 400);
  }

  // Honeypot check: automated spam bots fill hidden inputs
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return c.json({ error: "تم رفض الطلب" }, 400);
  }

  const s = await getSettings(c);
  if (!s.isOpen) return c.json({ error: "المتجر لا يستقبل طلبات الآن" }, 400);

  const name = clean(input.name, 60);
  const rawPhone = clean(input.phone, 20).replace(/[\s-]/g, "");
  const phone = normalizePhone(rawPhone);
  const phoneAlt = input.phoneAlt
    ? normalizePhone(clean(input.phoneAlt, 20).replace(/[\s-]/g, ""))
    : "";
  const wilayaId = Number(input.wilayaId) || 16;
  const wilayaName = clean(input.wilayaName, 60) || "الجزائر";
  const daira = clean(input.daira, 60);
  const commune = clean(input.commune, 60);
  const district = clean(input.district, 60);
  const address = clean(input.address, 300);
  const landmark = clean(input.landmark, 100);
  const deliveryType = input.deliveryType === "desk" ? "desk" : "home";
  const notes = clean(input.notes, 300);

  if (name.length < 2) return c.json({ error: "يرجى كتابة الاسم واللقب" }, 400);
  if (!/^\+?213[567]\d{8}$/.test(phone) && !/^0[567]\d{8}$/.test(rawPhone)) {
    return c.json(
      { error: "رقم الهاتف الجزائري غير صحيح (يجب أن يبدأ بـ 05 أو 06 أو 07)" },
      400,
    );
  }
  if (
    phoneAlt &&
    !/^\+?213[567]\d{8}$/.test(phoneAlt) &&
    !/^0[567]\d{8}$/.test(phoneAlt)
  ) {
    return c.json({ error: "رقم الهاتف البديل غير صحيح" }, 400);
  }

  if (input.payment !== "cod" && input.payment !== "transfer")
    return c.json({ error: "اختر طريقة الدفع" }, 400);
  if (input.payment === "transfer" && !s.transferInfo)
    return c.json({ error: "التحويل غير متاح" }, 400);

  const wanted = new Map<number, { qty: number; variantDetails: string }>();
  for (const item of Array.isArray(input.items) ? input.items : []) {
    const qty = Math.floor(Number(item?.qty));
    if (Number.isInteger(item?.id) && qty >= 1 && qty <= 50) {
      wanted.set(item.id, {
        qty: (wanted.get(item.id)?.qty ?? 0) + qty,
        variantDetails: clean(item.variantDetails, 100),
      });
    }
  }
  if (wanted.size === 0 || wanted.size > 50)
    return c.json({ error: "السلة فارغة" }, 400);

  const found = await db
    .select()
    .from(products)
    .where(
      and(
        inArray(products.id, [...wanted.keys()]),
        eq(products.available, true),
      ),
    );
  if (found.length !== wanted.size)
    return c.json({ error: "بعض المنتجات لم تعد متاحة. حدّث السلة." }, 409);

  let receiptKey: string | null = null;
  const receipt = form.get("receipt");
  if (input.payment === "transfer") {
    if (!(receipt instanceof File))
      return c.json({ error: "يرجى إرفاق صورة وصل التحويل" }, 400);
    const saved = await saveImage(c.env, receipt, "rcpt");
    if ("error" in saved) return c.json({ error: saved.error }, 400);
    receiptKey = saved.key;
  }

  const lines = found.map((p) => {
    const w = wanted.get(p.id)!;
    return {
      productId: p.id,
      name: p.name,
      price: p.price,
      qty: w.qty,
      variantDetails: w.variantDetails,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  // Compute delivery fee
  let deliveryFee =
    deliveryType === "desk"
      ? s.defaultDeskDeliveryFee
      : s.defaultHomeDeliveryFee;
  if (s.freeShippingOver > 0 && subtotal >= s.freeShippingOver) {
    deliveryFee = 0;
  } else {
    const [customRate] = await db
      .select()
      .from(deliveryRates)
      .where(eq(deliveryRates.wilayaId, wilayaId));
    if (customRate) {
      if (!customRate.isAvailable)
        return c.json({ error: "التوصيل غير متاح حالياً لهذه الولاية" }, 400);
      deliveryFee =
        deliveryType === "desk" ? customRate.deskFee : customRate.homeFee;
    }
  }

  const total = subtotal + deliveryFee;
  const token = randomToken();
  const fromTelegram = Boolean(session?.tg);

  const [order] = await db
    .insert(orders)
    .values({
      token,
      source: fromTelegram ? "telegram" : "web",
      customerId: session?.cid ?? null,
      telegramChatId: session?.tg ?? null,
      name,
      phone,
      phoneAlt,
      wilayaId,
      wilayaName,
      daira,
      commune,
      district,
      address,
      landmark,
      deliveryType,
      notes,
      payment: input.payment,
      receiptKey,
      subtotal,
      deliveryFee,
      total,
    })
    .returning();

  await db.insert(orderItems).values(
    lines.map((line) => ({
      orderId: order.id,
      productId: line.productId,
      name: line.name,
      price: line.price,
      qty: line.qty,
      variantDetails: line.variantDetails,
    })),
  );

  // Status history record
  await db.insert(orderStatusHistory).values({
    orderId: order.id,
    oldStatus: "",
    newStatus: "new",
    note: "إنشاء الطلب من المتجر",
  });

  // Remember phone and address for telegram customer
  if (session?.cid) {
    await db
      .update(customers)
      .set({ phone, address })
      .where(eq(customers.id, session.cid));
  }

  const origin = new URL(c.req.url).origin;
  c.executionCtx.waitUntil(
    notifyAdminsOfOrder(
      c.env,
      origin,
      { ...order, items: lines },
      s.currency,
    ).catch((e) => console.error(e)),
  );

  return c.json({ token, id: order.id });
});

/** A customer's own order page via secret unguessable token. */
store.get("/orders/:token", async (c) => {
  const db = c.get("db");
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.token, c.req.param("token")));
  if (!order) return c.json({ error: "لم نجد هذا الطلب" }, 404);
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(asc(orderStatusHistory.id));

  const { receiptKey, customerId, telegramChatId, ...visible } = order;
  return c.json({
    order: { ...visible, followsOnTelegram: Boolean(telegramChatId) },
    items,
    history,
  });
});

/** Public tracking lookup by Order ID + Phone Number (with masked privacy protection). */
store.post("/orders/track", async (c) => {
  const { orderId, phone } = await c.req.json<{
    orderId?: number | string;
    phone?: string;
  }>();
  const id = Number(orderId);
  const cleanPhone = clean(phone, 20).replace(/[\s-]/g, "");
  if (!id || !cleanPhone)
    return c.json({ error: "يرجى إدخال رقم الطلب ورقم الهاتف المسجل" }, 400);

  const db = c.get("db");
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return c.json({ error: "لم يتم العثور على طلب بهذا الرقم" }, 404);

  // Compare phone numbers (compare normalized or last 8 digits)
  const normInput = normalizePhone(cleanPhone).slice(-8);
  const normOrder = order.phone.slice(-8);
  if (normInput !== normOrder) {
    return c.json({ error: "رقم الهاتف غير مطابق لبيانات هذا الطلب" }, 400);
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(asc(orderStatusHistory.id));

  // Mask customer phone for privacy
  const maskedPhone = order.phone.replace(/(\d{3})\d{4}(\d{2,4})/, "$1****$2");

  return c.json({
    order: {
      id: order.id,
      token: order.token,
      status: order.status,
      name: order.name,
      phone: maskedPhone,
      wilayaName: order.wilayaName,
      commune: order.commune,
      deliveryType: order.deliveryType,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    items,
    history,
  });
});

/** "My orders" for shoppers inside Telegram. */
store.get("/my/orders", async (c) => {
  const cid = c.get("session")?.cid;
  if (!cid) return c.json({ orders: [] });
  const list = await c
    .get("db")
    .select({
      id: orders.id,
      token: orders.token,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, cid))
    .orderBy(desc(orders.id))
    .limit(30);
  return c.json({ orders: list });
});

export function randomToken(bytes = 18) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
