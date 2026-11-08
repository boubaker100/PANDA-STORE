import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { MinusIcon, PlusIcon } from './icons';
import { imageUrl } from '../lib/format';

type Variant = 'brand' | 'plain' | 'ghost' | 'danger';

export function Button({
  variant = 'brand',
  tone,
  size = 'md',
  className = '',
  busy,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  tone?: string;
  size?: 'sm' | 'md' | 'lg';
  busy?: boolean;
}) {
  const chosenVariant: Variant = (tone === 'brand' ? 'brand' : variant) as Variant;
  const styles: Record<Variant, string> = {
    brand: 'bg-brand text-on-brand hover:brightness-110',
    plain: 'bg-card text-ink border border-line hover:border-ink/30',
    ghost: 'text-ink hover:bg-ink/5',
    danger: 'bg-card text-danger border border-danger/30 hover:border-danger',
  };
  const sizes = {
    sm: 'min-h-9 px-3 text-xs',
    md: 'min-h-12 px-5 text-sm',
    lg: 'min-h-14 px-6 text-base font-bold',
  };
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${styles[chosenVariant]} ${className}`}
    >
      {busy ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
    </button>
  );
}

export function QtyStepper({
  qty,
  onChange,
  max = 50,
  size = 'md',
  full,
}: {
  qty: number;
  onChange: (qty: number) => void;
  max?: number;
  size?: 'sm' | 'md';
  full?: boolean;
}) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  return (
    <div className={`${full ? 'flex w-full justify-between' : 'inline-flex'} items-center rounded-xl border border-brand/30 bg-card text-brand`}>
      <button type="button" className={`${box} grid place-items-center rounded-xl hover:bg-brand/5`} onClick={() => onChange(qty + 1)} disabled={qty >= max} aria-label="زيادة الكمية">
        <PlusIcon width={18} height={18} />
      </button>
      <span className="price min-w-8 text-center text-base text-ink" aria-live="polite">
        {qty}
      </span>
      <button type="button" className={`${box} grid place-items-center rounded-xl hover:bg-brand/5`} onClick={() => onChange(qty - 1)} aria-label="إنقاص الكمية">
        <MinusIcon width={18} height={18} />
      </button>
    </div>
  );
}

export function ProductImage({
  image,
  name,
  className = '',
}: {
  image?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div className={`grid place-items-center bg-paper text-muted ${className}`} aria-label={name}>
        <span className="text-2xl font-bold opacity-30">{name.charAt(0)}</span>
      </div>
    );
  }
  const hasFit = /\b(object-(cover|contain|fill|none|scale-down)|h-auto)\b/.test(className);
  return (
    <img
      src={imageUrl(image)}
      alt={name}
      onError={() => setFailed(true)}
      className={`${hasFit ? '' : 'object-cover '} ${className}`}
      loading="lazy"
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 flex items-center justify-between font-medium text-ink">
        <span>{label}</span>
        {hint && <span className="text-xs text-muted font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Notice({
  tone = 'info',
  className = '',
  children,
}: {
  tone?: 'error' | 'info' | 'success';
  className?: string;
  children: ReactNode;
}) {
  const styles = {
    error: 'bg-[#fde8e8] text-[#9b1c1c] border-[#f8b4b4]',
    info: 'bg-[#e8f0fe] text-[#1a56db] border-[#b4c6f8]',
    success: 'bg-[#eaf5ea] text-[#1e7e34] border-[#b8e2be]',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles[tone]} ${className}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-muted">
      <span className="size-8 animate-spin rounded-full border-3 border-brand border-t-transparent" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
