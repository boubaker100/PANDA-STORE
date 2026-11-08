import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../state';
import { Button, Notice, Spinner } from '../components/ui';
import { TelegramIcon } from '../components/icons';
import { api } from '../lib/api';
import { count, ITEMS_WORDS, money, STATUS_LABELS, timeAgo, type OrderStatus } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { useStats } from './stats';
import { getWilayas } from '../../shared/algeria';

interface Row {
  id: number;
  status: OrderStatus;
  source: 'web' | 'telegram';
  name: string;
  phone: string;
  wilayaName: string;
  commune: string;
  deliveryType: 'home' | 'desk';
  total: number;
  payment: 'cod' | 'transfer';
  createdAt: number;
  itemCount: number;
}

const ALL_FILTERS: (OrderStatus | 'all')[] = [
  'all',
  'new',
  'pending_confirmation',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
];

export function OrdersPage() {
  const { data } = useApp();
  const { stats, refreshStats } = useStats();
  const currency = data!.store.currency;
  const wilayas = getWilayas();

  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as OrderStatus | 'all') || 'all';
  const searchQuery = params.get('q') || '';
  const selectedWilaya = params.get('wilayaId') || '';
  const selectedType = params.get('deliveryType') || '';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('confirmed');
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (filter !== 'all') qs.set('status', filter);
    if (searchQuery) qs.set('q', searchQuery);
    if (selectedWilaya) qs.set('wilayaId', selectedWilaya);
    if (selectedType) qs.set('deliveryType', selectedType);

    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    api<{ orders: Row[] }>(`/admin/orders${queryStr}`).then(
      (list) => {
        setRows(list.orders);
        setError(null);
      },
      (e) => setError(e.message),
    );
    refreshStats();
  }, [filter, searchQuery, selectedWilaya, selectedType, refreshStats]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  function updateFilter(newFilter: OrderStatus | 'all') {
    const next = new URLSearchParams(params);
    if (newFilter === 'all') next.delete('status');
    else next.set('status', newFilter);
    setParams(next, { replace: true });
    setSelectedIds([]);
  }

  function toggleSelectAll() {
    if (!rows) return;
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulkStatusUpdate() {
    if (selectedIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من تغيير حالة ${selectedIds.length} طلب إلى "${STATUS_LABELS[bulkStatus]}"؟`)) return;

    setBulkBusy(true);
    try {
      await api('/admin/orders/bulk-status', {
        json: { ids: selectedIds, status: bulkStatus, note: 'تعديل جماعي من لوحة التحكم' },
      });
      setSelectedIds([]);
      load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top action bar: Search, Filters, and CSV export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">إدارة الطلبات</h1>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/orders/export-csv"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold hover:bg-paper shadow-sm"
          >
            📥 تصدير CSV (Excel)
          </a>
        </div>
      </div>

      {/* Search and Wilaya Filter Bar */}
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="search"
          placeholder="بحث بالاسم، رقم الطلب، أو الهاتف..."
          value={searchQuery}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('q', e.target.value);
            else next.delete('q');
            setParams(next, { replace: true });
          }}
          className="field text-xs sm:text-sm"
        />

        <select
          value={selectedWilaya}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('wilayaId', e.target.value);
            else next.delete('wilayaId');
            setParams(next, { replace: true });
          }}
          className="field text-xs sm:text-sm"
        >
          <option value="">جميع الولايات (69)</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} - {w.nameAr}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('deliveryType', e.target.value);
            else next.delete('deliveryType');
            setParams(next, { replace: true });
          }}
          className="field text-xs sm:text-sm"
        >
          <option value="">جميع طرق التوصيل</option>
          <option value="home">توصيل للمنزل 🚚</option>
          <option value="desk">استلام من المكتب 🏢</option>
        </select>
      </div>

      {/* Horizontal Status Pills */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ALL_FILTERS.map((f) => {
          const n = f === 'all' ? null : stats?.byStatus[f] ?? 0;
          return (
            <button
              key={f}
              onClick={() => updateFilter(f)}
              aria-pressed={filter === f}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                filter === f ? 'bg-ink text-white shadow-sm' : 'bg-card text-muted hover:text-ink ring-1 ring-line'
              }`}
            >
              {f === 'all' ? 'الكل' : STATUS_LABELS[f]}
              {n !== null && n > 0 && <span className="ms-1.5 opacity-70">({n})</span>}
            </button>
          );
        })}
      </div>

      {/* Bulk actions bar if items are selected */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand/10 border border-brand/30 p-3">
          <span className="text-xs font-bold text-brand">تم تحديد {selectedIds.length} طلب</span>
          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              className="rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-semibold"
            >
              {ALL_FILTERS.filter((s) => s !== 'all').map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st as OrderStatus]}
                </option>
              ))}
            </select>
            <Button size="sm" tone="brand" onClick={handleBulkStatusUpdate} disabled={bulkBusy}>
              {bulkBusy ? 'تحديث...' : 'تطبيق التعديل الجماعي'}
            </Button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted hover:text-ink underline ms-2"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {filter === 'all' ? 'لا توجد طلبات بعد.' : 'لا توجد طلبات مطابقة لهذا الفلتر.'}
        </p>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          <div className="bg-paper px-4 py-2 flex items-center justify-between text-xs text-muted">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === rows.length}
                onChange={toggleSelectAll}
                className="rounded border-line"
              />
              <span>تحديد الكل ({rows.length})</span>
            </label>
            <span>العدد: {rows.length}</span>
          </div>

          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const isSelected = selectedIds.includes(row.id);
              return (
                <li key={row.id} className={`flex items-center gap-3 px-3 py-3 hover:bg-ink/[0.02] ${isSelected ? 'bg-brand/5' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(row.id)}
                    className="rounded border-line shrink-0"
                  />

                  <Link to={`/admin/orders/${row.id}`} className="min-w-0 flex-1 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink">#{row.id}</span>
                        <span className="font-semibold truncate">{row.name}</span>
                        <span className="text-xs text-muted" dir="ltr">{row.phone}</span>
                        {row.source === 'telegram' && (
                          <TelegramIcon width={16} height={16} className="shrink-0 text-[#229ED9]" aria-label="من تيليجرام" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted flex items-center gap-2 flex-wrap">
                        <span>📍 {row.wilayaName || 'الجزائر'} ({row.commune || ''})</span>
                        <span>•</span>
                        <span>{row.deliveryType === 'desk' ? '🏢 استلام من المكتب' : '🚚 للمنزل'}</span>
                        <span>•</span>
                        <span>{timeAgo(row.createdAt)}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-bold text-sm text-brand">{money(row.total, currency)}</span>
                      <StatusBadge status={row.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
