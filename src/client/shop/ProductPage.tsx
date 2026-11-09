import { useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useApp } from '../state';
import { ProductImage } from '../components/ui';
import { CheckIcon, TruckIcon, CashIcon } from '../components/icons';
import { discountPercent, money } from '../lib/format';
import { ProductRail } from './ProductCard';
import { NotFound } from './NotFound';
import { VideoPlayer } from '../components/VideoPlayer';
import { AlgeriaOrderForm } from '../components/AlgeriaOrderForm';

export function ProductPage() {
  const { id } = useParams();
  const { data } = useApp();
  const orderFormRef = useRef<HTMLDivElement>(null);

  const product = data!.products.find((p) => p.id === Number(id));
  if (!product) return <NotFound />;

  const { store, categories, products } = data!;
  const category = categories.find((c) => c.id === product.categoryId);
  const off = discountPercent(product.price, product.oldPrice);
  const related = products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId && p.available).slice(0, 8);
  const images = product.images.length ? product.images : [undefined];

  const scrollToOrder = () => {
    orderFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sections = product.sections ?? [];

  return (
    <main className="mx-auto max-w-6xl pb-24 md:pb-12 px-4 min-w-0">
      {/* Breadcrumb */}
      <nav className="pt-4 text-sm text-muted flex flex-wrap items-center gap-1.5" aria-label="مسار التصفح">
        <Link to="/" className="hover:text-ink shrink-0">
          الرئيسية
        </Link>
        {category && (
          <>
            <span className="text-muted/60">/</span>
            <Link to={`/c/${category.id}`} className="hover:text-ink shrink-0">
              {category.name}
            </Link>
          </>
        )}
        <span className="text-muted/60">/</span>
        <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{product.name}</span>
      </nav>

      {/* Hero Product Presentation */}
      <div className="mt-4 grid gap-8 lg:grid-cols-12 min-w-0">
        {/* Gallery column - vertical stack preserving natural aspect ratio */}
        <section className="min-w-0 lg:col-span-6" aria-label="معرض صور المنتج">
          <div className="space-y-4">
            {images.map((key, i) => (
              <div key={key ?? i} className="relative overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                <ProductImage
                  name={product.name}
                  image={key}
                  className="w-full h-auto block"
                />
                {i === 0 && off > 0 && (
                  <span className="absolute start-3 top-3 rounded-lg bg-sale px-3 py-1 text-sm font-bold text-white shadow-sm">
                    خصم {off}%
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Highlights & Guarantees */}
          <div className="mt-6 rounded-2xl border border-line bg-card p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-brand shrink-0"><TruckIcon /></span>
              <span><strong>توصيل لـ 69 ولاية:</strong> للمنزل أو الاستلام من المكتب، والدفع عند الاستلام بعد المعاينة.</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-brand shrink-0"><CashIcon /></span>
              <span><strong>ضمان المعاينة:</strong> افتح طردك وتأكد من جودة المنتج قبل تسليم المبلغ للموزع.</span>
            </div>
          </div>
        </section>

        {/* Order Form & Main Info column */}
        <section className="min-w-0 lg:col-span-6" aria-label="طلب المنتج">
          <div className="mb-4">
            <h1 className="text-2xl font-bold leading-snug sm:text-3xl text-ink break-words">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold text-brand">{money(product.price, store.currency)}</span>
              {off > 0 && (
                <>
                  <s className="text-lg text-muted">{money(product.oldPrice!, store.currency)}</s>
                  <span className="rounded-md bg-sale/10 px-2 py-0.5 text-sm font-bold text-sale">
                    وفّر {money(product.oldPrice! - product.price, store.currency)}
                  </span>
                </>
              )}
            </div>

            <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${product.available ? 'text-emerald-700' : 'text-sale'}`}>
              {product.available ? (
                <>
                  <CheckIcon width={18} height={18} /> متوفر في المخزون وجاهز للشحن الفوري
                </>
              ) : (
                'نفدت الكمية مؤقتاً'
              )}
            </p>
          </div>

          {/* Embedded Dynamic Algerian Order Form */}
          <div id="order-form" ref={orderFormRef} className="min-w-0">
            <AlgeriaOrderForm product={product} />
          </div>
        </section>
      </div>

      {/* Video section if present */}
      {product.videoUrl && (
        <section className="min-w-0 mt-12 rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🎬</span>
            <span>فيديو توضيحي للمنتج وتجربة الاستخدام</span>
          </h2>
          <div className="max-w-3xl mx-auto min-w-0">
            <VideoPlayer url={product.videoUrl} title={product.name} />
          </div>
        </section>
      )}

      {/* Configurable Landing Page Sections */}
      {sections.filter((s) => s.enabled).length > 0 && (
        <div className="mt-10 space-y-8 min-w-0">
          {sections
            .filter((s) => s.enabled)
            .map((sec) => {
              if (sec.type === 'features') {
                const items: string[] = Array.isArray(sec.content?.items) ? sec.content.items : [];
                return (
                  <section key={sec.id} className="min-w-0 rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-ink flex items-center gap-2">
                      <span>✨</span>
                      <span>{sec.title || 'أهم المميزات'}</span>
                    </h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {items.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-3 rounded-xl bg-paper p-3 border border-line/60 min-w-0">
                          <span className="text-brand shrink-0 mt-0.5 font-bold">✓</span>
                          <span className="text-sm leading-relaxed text-ink/90 break-words">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              }

              if (sec.type === 'specs') {
                const items: { label: string; value: string }[] = Array.isArray(sec.content?.items) ? sec.content.items : [];
                return (
                  <section key={sec.id} className="min-w-0 rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-ink flex items-center gap-2">
                      <span>📋</span>
                      <span>{sec.title || 'المواصفات الفنية'}</span>
                    </h2>
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full min-w-full text-start text-sm divide-y divide-line">
                        <tbody className="divide-y divide-line">
                          {items.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-card' : 'bg-paper'}>
                              <td className="w-1/3 px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-muted break-words">{item.label}</td>
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-ink font-medium break-words">{item.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              }

              if (sec.type === 'faq') {
                const items: { q: string; a: string }[] = Array.isArray(sec.content?.items) ? sec.content.items : [];
                return (
                  <section key={sec.id} className="min-w-0 rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-ink flex items-center gap-2">
                      <span>❓</span>
                      <span>{sec.title || 'الأسئلة الشائعة'}</span>
                    </h2>
                    <div className="space-y-3">
                      {items.map((faq, idx) => (
                        <div key={idx} className="rounded-xl border border-line bg-paper p-4 min-w-0">
                          <h3 className="font-bold text-sm text-ink mb-1.5 break-words whitespace-pre-line">{faq.q}</h3>
                          <p className="text-xs sm:text-sm text-muted leading-relaxed break-words whitespace-pre-line">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }

              return null;
            })}
        </div>
      )}

      {/* Long Description if present */}
      {product.description && (
        <section className="min-w-0 mt-8 rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-3 text-ink">تفاصيل المنتج</h2>
          <p className="whitespace-pre-line leading-relaxed text-ink/85 break-words">{product.description}</p>
        </section>
      )}

      {/* Related Products */}
      {related.length > 0 && (
        <div className="mt-12 min-w-0">
          <ProductRail title="منتجات أخرى قد تعجبك" products={related} />
        </div>
      )}

      {/* Mobile sticky bottom quick-action bar */}
      {product.available && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-md p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden shadow-lg">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div>
              <div className="text-xs text-muted">السعر:</div>
              <div className="text-lg font-bold text-brand">{money(product.price, store.currency)}</div>
            </div>
            <button
              type="button"
              onClick={scrollToOrder}
              className="flex-1 rounded-xl bg-brand py-3 px-4 font-bold text-on-brand shadow-sm text-center active:scale-95 transition-transform"
            >
              اطلب الآن ⚡
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
