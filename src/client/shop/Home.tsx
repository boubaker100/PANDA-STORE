import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { useApp } from '../state';
import { BankIcon, CashIcon, ShieldIcon, TruckIcon } from '../components/icons';
import { imageUrl, money } from '../lib/format';
import { ProductRail } from './ProductCard';
import { InstallBanner } from './InstallApp';
import type { Banner } from '../types';

export function Home() {
  const { data, session } = useApp();
  const { store, categories, products, banners, bestSellers } = data!;

  const onSale = products.filter((p) => p.available && p.oldPrice && p.oldPrice > p.price);
  // "Best sellers" only once there are real sales to rank; never invented.
  const sold = bestSellers.map((id) => products.find((p) => p.id === id)).filter((p) => p && p.available) as typeof products;

  return (
    <main className="mx-auto max-w-6xl pb-4">
      {session.user && <p className="px-4 pt-4 text-sm text-muted">أهلاً {session.user.name}</p>}
      {!store.isOpen && (
        <p className="mx-4 mt-4 rounded-xl bg-ink px-4 py-3 text-center text-sm text-white">المتجر لا يستقبل طلبات الآن. يمكنك التصفح والعودة لاحقاً.</p>
      )}
      {banners.length > 0 && <BannerSlider banners={banners} />}
      <InstallBanner />

      {categories.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 px-4 text-xl font-bold md:text-2xl">تسوّق حسب القسم</h2>
          <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 md:gap-8">
            {categories.map((cat) => (
              <li key={cat.id} className="shrink-0">
                <Link to={`/c/${cat.id}`} className="group flex w-20 flex-col items-center gap-2 text-center md:w-28">
                  <span className="block size-20 overflow-hidden rounded-full border border-line bg-card md:size-28">
                    {cat.imageKey ? (
                      <img src={imageUrl(cat.imageKey)} alt="" className="size-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <span className="grid size-full place-items-center bg-brand/8 text-2xl font-bold text-brand">{cat.name.charAt(0)}</span>
                    )}
                  </span>
                  <span className="text-sm font-medium leading-tight">{cat.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Features />

      <ProductRail title="عروض وخصومات" products={onSale} />
      {sold.length >= 3 && <ProductRail title="الأكثر مبيعاً" products={sold.slice(0, 10)} />}
      {categories.map((cat) => (
        <ProductRail
          key={cat.id}
          title={cat.name}
          products={products.filter((p) => p.categoryId === cat.id).slice(0, 10)}
          moreLink={`/c/${cat.id}`}
        />
      ))}
      <ProductRail title="منتجات أخرى" products={products.filter((p) => !p.categoryId || !categories.some((c) => c.id === p.categoryId))} />
      {products.length === 0 && <p className="py-20 text-center text-muted">لا توجد منتجات بعد. أضفها من لوحة التحكم.</p>}
    </main>
  );
}

export function titleSizeClass(size: string): string {
  const map: Record<string, string> = {
    '': 'text-xl sm:text-3xl md:text-4xl',
    sm: 'text-lg sm:text-xl md:text-2xl',
    base: 'text-xl sm:text-2xl md:text-3xl',
    lg: 'text-2xl sm:text-3xl md:text-4xl',
    xl: 'text-2xl sm:text-4xl md:text-5xl',
    '2xl': 'text-3xl sm:text-5xl md:text-6xl',
  };
  return map[size] ?? map[''];
}

export function subtitleSizeClass(size: string): string {
  const map: Record<string, string> = {
    '': 'text-[13px] sm:text-base md:text-lg',
    sm: 'text-xs sm:text-sm md:text-base',
    base: 'text-[13px] sm:text-base md:text-lg',
    lg: 'text-sm sm:text-lg md:text-xl',
    xl: 'text-base sm:text-xl md:text-2xl',
    '2xl': 'text-lg sm:text-2xl md:text-3xl',
  };
  return map[size] ?? map[''];
}

export function buttonRadiusClass(radius: string): string {
  const map: Record<string, string> = {
    '': 'rounded-lg',
    none: 'rounded-none',
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  };
  return map[radius] ?? map[''];
}

export type BannerStyleInput = Pick<
  Banner,
  | 'titleColor' | 'titleBg' | 'titleBgOpacity' | 'titleBorderColor' | 'titleBorderWidth'
  | 'subtitleColor' | 'subtitleBg' | 'subtitleBgOpacity' | 'subtitleBorderColor' | 'subtitleBorderWidth'
  | 'buttonBgColor' | 'buttonBgOpacity' | 'buttonTextColor' | 'buttonBorderColor' | 'buttonBorderWidth'
  | 'titleTextStrokeColor' | 'titleTextStrokeWidth'
  | 'subtitleTextStrokeColor' | 'subtitleTextStrokeWidth'
  | 'buttonTextStrokeColor' | 'buttonTextStrokeWidth'
>;

export function hexToRgba(hex: string, opacity: number): string {
  if (!hex) return 'transparent';
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(100, opacity)) / 100;
  return `rgba(${r},${g},${b},${a})`;
}

export function titleStyle(b: BannerStyleInput): CSSProperties {
  const s: CSSProperties = { color: b.titleColor || '#ffffff' };
  if (b.titleBg) s.backgroundColor = hexToRgba(b.titleBg, b.titleBgOpacity ?? 100);
  if (b.titleBorderWidth > 0) s.border = `${b.titleBorderWidth}px solid ${b.titleBorderColor || '#ffffff'}`;
  if (b.titleTextStrokeWidth > 0) {
    (s as any).WebkitTextStroke = `${b.titleTextStrokeWidth}px ${b.titleTextStrokeColor || '#000000'}`;
  }
  if (b.titleBg || b.titleBorderWidth > 0) {
    s.padding = '4px 10px';
    s.borderRadius = '8px';
    s.display = 'inline-block';
  }
  return s;
}

export function subtitleStyle(b: BannerStyleInput): CSSProperties {
  const s: CSSProperties = { color: b.subtitleColor || '#ffffff' };
  if (b.subtitleBg) s.backgroundColor = hexToRgba(b.subtitleBg, b.subtitleBgOpacity ?? 100);
  if (b.subtitleBorderWidth > 0) s.border = `${b.subtitleBorderWidth}px solid ${b.subtitleBorderColor || '#ffffff'}`;
  if (b.subtitleTextStrokeWidth > 0) {
    (s as any).WebkitTextStroke = `${b.subtitleTextStrokeWidth}px ${b.subtitleTextStrokeColor || '#000000'}`;
  }
  if (b.subtitleBg || b.subtitleBorderWidth > 0) {
    s.padding = '2px 8px';
    s.borderRadius = '6px';
    s.display = 'inline-block';
  }
  return s;
}

export function buttonStyle(b: BannerStyleInput): CSSProperties {
  const s: CSSProperties = {
    backgroundColor: hexToRgba(b.buttonBgColor || '#ffffff', b.buttonBgOpacity ?? 100),
    color: b.buttonTextColor || '#1a1a1a',
  };
  if (b.buttonBorderWidth > 0) s.border = `${b.buttonBorderWidth}px solid ${b.buttonBorderColor || '#000000'}`;
  if (b.buttonTextStrokeWidth > 0) {
    (s as any).WebkitTextStroke = `${b.buttonTextStrokeWidth}px ${b.buttonTextStrokeColor || '#000000'}`;
  }
  return s;
}

function BannerSlider({ banners }: { banners: Banner[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    // RTL scroll positions are negative in modern browsers.
    el.scrollTo({ left: -i * el.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    if (banners.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => goTo((index + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [index, paused, banners.length]);

  return (
    <section className="relative px-4 pt-4" aria-roledescription="carousel" aria-label="العروض">
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl"
        onScroll={(e) => setIndex(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth))}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
      >
        {banners.map((banner, i) => {
          const content = (
            <div className="relative aspect-[2/1] w-full sm:aspect-[5/2] md:aspect-[3/1]">
              <img src={imageUrl(banner.imageKey)} alt="" className="absolute inset-0 size-full object-cover object-left" loading={i ? 'lazy' : 'eager'} />
              {(banner.title || banner.subtitle || banner.buttonText) && (
                <div className="absolute inset-y-0 start-0 flex w-[55%] flex-col justify-center gap-2 ps-5 text-white md:w-1/2 md:gap-3 md:ps-14">
                  {banner.title && (
                    <p className={`${titleSizeClass(banner.titleFontSize)} font-bold leading-tight drop-shadow`} style={titleStyle(banner)}>
                      {banner.title}
                    </p>
                  )}
                  {banner.subtitle && (
                    <p className={`${subtitleSizeClass(banner.subtitleFontSize)} leading-relaxed`} style={subtitleStyle(banner)}>
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.buttonText && (
                    <span className={`mt-1 inline-flex w-fit px-3.5 py-2 text-[13px] font-semibold md:px-5 md:py-2.5 md:text-base ${buttonRadiusClass(banner.buttonRadius)}`} style={buttonStyle(banner)}>
                      {banner.buttonText}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
          return (
            <div key={banner.id} className="w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} من ${banners.length}`}>
              {banner.link ? <Link to={banner.link}>{content}</Link> : content}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => goTo(i)}
              aria-label={`البنر ${i + 1}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-brand' : 'w-2 bg-ink/20'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** The trust strip under the categories; each item only appears when the store really offers it. */
function Features() {
  const { data } = useApp();
  const { store } = data!;
  const items = [
    {
      icon: TruckIcon,
      title: store.freeShippingOver ? 'شحن مجاني' : store.deliveryFee ? 'توصيل سريع' : 'توصيل مجاني',
      text: store.freeShippingOver
        ? `للطلبات فوق ${money(store.freeShippingOver, store.currency)}`
        : store.deliveryFee
          ? `رسوم التوصيل ${money(store.deliveryFee, store.currency)}`
          : 'لكل الطلبات',
    },
    { icon: CashIcon, title: 'الدفع عند الاستلام', text: 'ادفع عند وصول طلبك' },
    ...(store.transferInfo ? [{ icon: BankIcon, title: 'تحويل بنكي', text: 'حوّل وأرفق الإيصال' }] : []),
    { icon: ShieldIcon, title: 'طلب آمن', text: 'نتابع طلبك حتى يصلك' },
  ];
  return (
    <section className="mx-4 mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex flex-col items-center gap-2 bg-card p-4 text-center md:flex-row md:gap-3 md:text-start">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <Icon width={20} height={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-xs text-muted">{text}</span>
          </span>
        </div>
      ))}
    </section>
  );
}
