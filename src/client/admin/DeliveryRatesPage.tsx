import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../state';
import { Button, Notice, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { getWilayas } from '../../shared/algeria';
import type { DeliveryRate } from '../types';

export function DeliveryRatesPage() {
  const { data } = useApp();
  const store = data!.store;
  const currency = store.currency;
  const allWilayas = useMemo(() => getWilayas(), []);

  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // Editing state for a single row
  const [editWilayaId, setEditWilayaId] = useState<number | null>(null);
  const [editHomeFee, setEditHomeFee] = useState<number>(600);
  const [editDeskFee, setEditDeskFee] = useState<number>(350);
  const [editAvailable, setEditAvailable] = useState<boolean>(true);

  async function loadRates() {
    setLoading(true);
    try {
      const res = await api<{ rates: DeliveryRate[] }>('/admin/delivery-rates');
      setRates(res.rates);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRates();
  }, []);

  function startEdit(wilayaId: number, wilayaName: string) {
    const existing = rates.find((r) => r.wilayaId === wilayaId);
    setEditWilayaId(wilayaId);
    setEditHomeFee(existing ? existing.homeFee : store.defaultHomeDeliveryFee ?? 600);
    setEditDeskFee(existing ? existing.deskFee : store.defaultDeskDeliveryFee ?? 350);
    setEditAvailable(existing ? existing.isAvailable : true);
  }

  async function saveRate(wilayaId: number, wilayaName: string) {
    setSavingId(wilayaId);
    try {
      await api('/admin/delivery-rates', {
        put: {
          wilayaId,
          wilayaName,
          homeFee: editHomeFee,
          deskFee: editDeskFee,
          isAvailable: editAvailable,
        },
      });
      setEditWilayaId(null);
      await loadRates();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const filteredWilayas = useMemo(() => {
    if (!search.trim()) return allWilayas;
    const q = search.trim().toLowerCase();
    return allWilayas.filter(
      (w) => w.code.includes(q) || w.nameAr.includes(q) || w.nameEn.toLowerCase().includes(q),
    );
  }, [allWilayas, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold">إدارة تكاليف التوصيل لـ 69 ولاية</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            حدد سعر التوصيل للمنزل وللمكتب (Stop-desk) لكل ولاية، أو اتركها تعتمد الأسعار الافتراضية
          </p>
        </div>

        <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs">
          <span className="text-muted">الافتراضي: </span>
          <span className="font-bold">منزل: {money(store.defaultHomeDeliveryFee ?? 600, currency)}</span>
          <span className="mx-2">•</span>
          <span className="font-bold">مكتب: {money(store.defaultDeskDeliveryFee ?? 350, currency)}</span>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="max-w-md">
        <input
          type="search"
          placeholder="ابحث برقم الولاية أو اسمها (مثلاً: 16 أو الجزائر أو وهران)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field text-xs sm:text-sm"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs sm:text-sm">
              <thead className="bg-paper border-b border-line text-muted">
                <tr>
                  <th className="p-3 text-start">الولاية</th>
                  <th className="p-3 text-start">توصيل للمنزل 🚚</th>
                  <th className="p-3 text-start">استلام من المكتب 🏢</th>
                  <th className="p-3 text-start">الحالة</th>
                  <th className="p-3 text-start">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredWilayas.map((w) => {
                  const custom = rates.find((r) => r.wilayaId === w.id);
                  const isEditing = editWilayaId === w.id;
                  const homeFee = custom ? custom.homeFee : store.defaultHomeDeliveryFee ?? 600;
                  const deskFee = custom ? custom.deskFee : store.defaultDeskDeliveryFee ?? 350;
                  const available = custom ? custom.isAvailable : true;

                  return (
                    <tr key={w.id} className={isEditing ? 'bg-brand/5' : 'hover:bg-ink/[0.02]'}>
                      <td className="p-3 font-bold text-ink">
                        {w.code} - {w.nameAr}
                        <span className="text-xs text-muted font-normal block">{w.nameEn}</span>
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editHomeFee}
                              onChange={(e) => setEditHomeFee(Number(e.target.value))}
                              className="w-20 rounded border border-line bg-card px-2 py-1 text-xs"
                            />
                            <span className="text-xs text-muted">{currency}</span>
                          </div>
                        ) : (
                          <span className={custom ? 'font-bold text-brand' : 'text-muted'}>
                            {money(homeFee, currency)}
                            {!custom && ' (افتراضي)'}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editDeskFee}
                              onChange={(e) => setEditDeskFee(Number(e.target.value))}
                              className="w-20 rounded border border-line bg-card px-2 py-1 text-xs"
                            />
                            <span className="text-xs text-muted">{currency}</span>
                          </div>
                        ) : (
                          <span className={custom ? 'font-bold text-brand' : 'text-muted'}>
                            {money(deskFee, currency)}
                            {!custom && ' (افتراضي)'}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={editAvailable}
                              onChange={(e) => setEditAvailable(e.target.checked)}
                              className="rounded border-line"
                            />
                            <span>متاح للشحن</span>
                          </label>
                        ) : (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {available ? 'متاح' : 'معطل'}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              tone="brand"
                              onClick={() => saveRate(w.id, w.nameAr)}
                              disabled={savingId === w.id}
                            >
                              {savingId === w.id ? 'حفظ...' : 'حفظ'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditWilayaId(null)}
                              className="text-xs text-muted hover:text-ink underline ms-1"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(w.id, w.nameAr)}
                            className="rounded-lg border border-line bg-card px-3 py-1 text-xs font-semibold hover:border-brand"
                          >
                            تعديل السعر
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
