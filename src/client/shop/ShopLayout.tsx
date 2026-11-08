import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useApp } from '../state';
import { Button, Notice, Spinner } from '../components/ui';
import { BagIcon, CloseIcon, MenuIcon, ReceiptIcon, SearchIcon, WhatsAppIcon } from '../components/icons';
import { imageUrl, money } from '../lib/format';
import { savedOrders } from '../lib/myOrders';
import { useOnline } from '../lib/install';

export function ShopLayout() {
  const { data, loadError, reload, session } = useApp();
  const online = useOnline();

  if (loadError) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
        <div className="space-y-4 text-center">
          <Notice tone="error">{loadError}</Notice>
          <Button onClick={reload}>حاول مرة أخرى</Button>
        </div>
      </main>
    );
  }
  if (!data) return <Spinner />;

  return (
    <div className="flex min-h-dvh flex-col min-w-0">
      {data.store.announcement && (
        <p className="bg-brand px-4 py-2 text-center text-[13px] font-medium text-on-brand break-words">{data.store.announcement}</p>
      )}
      {!online && (
        <p className="bg-ink px-4 py-2 text-center text-[13px] text-white" role="status">
          أنت غير متصل بالإنترنت. هذه آخر نسخة محفوظة من المتجر، وتحتاج اتصالاً لإتمام الطلب.
        </p>
      )}
      <Header />
      {session.error && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3 min-w-0">
          <Notice tone="error">{session.error}. يمكنك الطلب كزائر.</Notice>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
      <Footer />
      <AddedToast />
    </div>
  );
}

function Header() {
  const { data, cartCount, subtotal, session } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const { store, categories } = data!;
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 md:h-20 md:gap-6 md:px-4">
        <button onClick={() => setMenuOpen(true)} className="grid size-10 place-items-center rounded-lg hover:bg-ink/5 md:hidden" aria-label="القائمة">
          <MenuIcon />
        </button>
        <Link to="/" className="flex min-w-0 items-center gap-2.5 max-md:mx-auto">
          {store.logo ? (
            <img src={imageUrl(store.logo)} alt="" className="size-10 shrink-0 object-contain md:size-12" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-lg font-bold text-on-brand md:size-12">{store.name.charAt(0)}</span>
          )}
          <span className="truncate text-lg font-bold md:text-xl">{store.name}</span>
        </Link>

        <SearchBox className="hidden flex-1 md:flex" />

        <div className="flex items-center gap-1">
          <Link to="/search" className="grid size-10 place-items-center rounded-lg hover:bg-ink/5 md:hidden" aria-label="بحث">
            <SearchIcon />
          </Link>
          <Link to="/track" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-ink/5 sm:flex text-muted hover:text-ink">
            🔍 تتبع طلبك
          </Link>
          {(session.user || savedOrders().length > 0) && (
            <Link to="/orders" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-ink/5 md:flex">
              <ReceiptIcon width={20} height={20} /> طلباتي
            </Link>
          )}
          <Link to="/cart" className="relative flex items-center gap-2 rounded-lg p-2 hover:bg-ink/5 md:px-3" aria-label={`السلة، ${cartCount} منتجات`}>
            <BagIcon />
            {cartCount > 0 && (
              <span key={cartCount} className="pop price absolute -top-0.5 start-6 grid min-w-5 place-items-center rounded-full bg-sale px-1 text-[11px] leading-5 text-white">
                {cartCount}
              </span>
            )}
            <span className="price hidden text-sm md:inline">{money(subtotal, store.currency)}</span>
          </Link>
        </div>
      </div>

      <nav className="hidden border-t border-line md:block" aria-label="الأقسام">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3">
          <TopLink to="/" end>
            الرئيسية
          </TopLink>
          {categories.map((cat) => (
            <TopLink key={cat.id} to={`/c/${cat.id}`}>
              {cat.name}
            </TopLink>
          ))}
        </div>
      </nav>

      {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} />}
    </header>
  );
}

function TopLink({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors ${
          isActive ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function SearchBox({ className = '', autoFocus }: { className?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  function submit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={submit} className={`relative ${className}`}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث عن منتج..."
        className="field ps-10"
      />
      <span className="pointer-events-none absolute inset-y-0 start-0 grid size-10 place-items-center text-muted">
        <SearchIcon width={18} height={18} />
      </span>
    </form>
  );
}

function MenuDrawer({ onClose }: { onClose: () => void }) {
  const { data, session } = useApp();
  const { store, categories } = data!;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex w-[min(320px,85vw)] flex-col bg-card shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <span className="font-bold">{store.name}</span>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-ink/5" aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <DrawerLink to="/" image={null}>الرئيسية</DrawerLink>
          <DrawerLink to="/track" image={null}>🔍 تتبع طلبك</DrawerLink>
          {(session.user || savedOrders().length > 0) && (
            <DrawerLink to="/orders" image={null}>طلباتي السابقة</DrawerLink>
          )}
          <div className="pt-2 pb-1 text-xs font-semibold uppercase text-muted px-3">الأقسام</div>
          {categories.map((cat) => (
            <DrawerLink key={cat.id} to={`/c/${cat.id}`} image={cat.imageKey}>
              {cat.name}
            </DrawerLink>
          ))}
        </nav>
        {store.whatsapp && (
          <a
            href={`https://wa.me/${store.whatsapp.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener"
            className="m-3 flex items-center justify-center gap-2 rounded-xl bg-[#1FA855] py-3 font-semibold text-white shadow-sm"
          >
            <WhatsAppIcon /> تواصل معنا عبر واتساب
          </a>
        )}
      </aside>
    </div>
  );
}

function DrawerLink({ to, image, children }: { to: string; image?: string | null; children: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-ink/5">
      {image !== undefined &&
        (image ? <img src={imageUrl(image)} alt="" className="size-8 rounded-full object-cover" /> : null)}
      {children}
    </Link>
  );
}

function Footer() {
  const { data } = useApp();
  const { store, categories } = data!;
  return (
    <footer className="mt-12 bg-[#16181c] text-white/75">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-white">{store.name}</p>
          {store.tagline && <p className="mt-2 max-w-[32ch] text-sm leading-relaxed">{store.tagline}</p>}
        </div>
        <FooterList title="الأقسام" links={categories.map((c) => ({ to: `/c/${c.id}`, label: c.name }))} />
        <FooterList
          title="روابط مهمة"
          links={[
            { to: '/track', label: 'تتبع طلبك' },
            { to: '/orders', label: 'طلباتي' },
            { to: '/cart', label: 'سلة المشتريات' },
            ...(store.whatsapp ? [{ href: `https://wa.me/${store.whatsapp.replace(/[^\d]/g, '')}`, label: 'تواصل معنا عبر واتساب' }] : []),
          ]}
        />
        <div>
          <p className="mb-3 font-semibold text-white">طرق التوصيل والدفع</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-white/10 px-3 py-1.5">توصيل لـ 69 ولاية</span>
            <span className="rounded-lg bg-white/10 px-3 py-1.5">الدفع عند الاستلام</span>
            {store.transferInfo && <span className="rounded-lg bg-white/10 px-3 py-1.5">بريدي موب BaridiMob</span>}
          </div>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {store.name}. جميع الحقوق محفوظة.
      </p>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: { to?: string; href?: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-3 font-semibold text-white">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            {link.href ? (
              <a href={link.href} target="_blank" rel="noopener" className="hover:text-white">
                {link.label}
              </a>
            ) : (
              <Link to={link.to!} className="hover:text-white">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddedToast() {
  const { lastAdded } = useApp();
  if (!lastAdded) return null;
  return (
    <aside
      role="status"
      className="fixed bottom-4 start-4 z-40 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-xl"
    >
      <span className="text-brand font-bold">✓</span>
      <span>تمت إضافة المنتج للسلة</span>
    </aside>
  );
}
