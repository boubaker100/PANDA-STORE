import { Link, Navigate } from 'react-router';
import { useApp } from '../state';
import { ProductImage } from '../components/ui';
import { money } from '../lib/format';
import { AlgeriaOrderForm } from '../components/AlgeriaOrderForm';

export function CheckoutPage() {
  const { data, cartLines, subtotal } = useApp();
  const { store } = data!;

  if (cartLines.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">إتمام الطلب وتحديد التوصيل</h1>
        <Link to="/cart" className="text-sm text-brand font-semibold hover:underline">
          ← تعديل السلة
        </Link>
      </div>

      <div className="gap-8 lg:grid lg:grid-cols-[1fr_380px]">
        {/* Dynamic Algeria Order Form */}
        <div>
          <AlgeriaOrderForm />
        </div>

        {/* Cart summary sidebar */}
        <aside className="mt-6 lg:mt-0">
          <div className="sticky top-6 rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base border-b border-line pb-3">ملخص سلة الشراء ({cartLines.length})</h2>

            <div className="divide-y divide-line/60 max-h-96 overflow-y-auto pe-1">
              {cartLines.map(({ product, qty }) => (
                <div key={product.id} className="py-3 flex items-center gap-3">
                  <ProductImage
                    name={product.name}
                    image={product.images[0]}
                    className="size-14 rounded-lg object-cover shrink-0 border border-line"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{product.name}</h3>
                    <p className="text-xs text-muted">
                      {qty} × {money(product.price, store.currency)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-ink">
                    {money(product.price * qty, store.currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>المجموع الفرعي للسلع:</span>
                <span>{money(subtotal, store.currency)}</span>
              </div>
              <p className="text-xs text-muted">
                * يتم احتساب مصاريف التوصيل تلقائياً في النموذج بناءً على الولاية وطريقة التوصيل المختارة.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
