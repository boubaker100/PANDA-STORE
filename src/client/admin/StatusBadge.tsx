import { STATUS_LABELS, type OrderStatus } from '../lib/format';

const TONES: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border border-blue-200',
  pending_confirmation: 'bg-amber-100 text-amber-800 border border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  preparing: 'bg-purple-100 text-purple-800 border border-purple-200',
  out_for_delivery: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  delivered: 'bg-green-100 text-green-800 border border-green-200',
  cancelled: 'bg-rose-100 text-rose-800 border border-rose-200 line-through',
  returned: 'bg-gray-100 text-gray-700 border border-gray-300',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[status] || 'bg-gray-100 text-gray-800'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
