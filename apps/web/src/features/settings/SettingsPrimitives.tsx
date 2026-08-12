import type { ReactNode } from 'react';
import { useId } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/** A titled block of settings. Every section on every page is one of these. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-b py-8 first:pt-0 last:border-b-0">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="text-content-300 mt-1 text-sm">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  disabled?: boolean;
  /** Shows a live character count — worth it where the limit is easy to hit. */
  showCount?: boolean;
  multiline?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  placeholder,
  maxLength,
  autoComplete,
  disabled,
  showCount,
  multiline,
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const inputClass =
    'border-input bg-surface-900/60 focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow focus-visible:ring-3 disabled:opacity-50';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-content-300 text-sm font-medium">
          {label}
        </label>
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'text-content-500 text-xs tabular-nums',
              value.length > maxLength * 0.9 && 'text-idle',
            )}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          rows={3}
          aria-describedby={hint ? hintId : undefined}
          className={cn(inputClass, 'resize-none')}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          className={inputClass}
        />
      )}

      {hint && (
        <p id={hintId} className="text-content-500 mt-1.5 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The one place a mutation's outcome is spoken to the user. `role="status"` means
 * a screen reader hears "Saved" without the focus moving.
 */
export function FormStatus({
  isPending,
  error,
  isSuccess,
  successMessage = 'Saved',
}: {
  isPending?: boolean;
  error?: Error | null;
  isSuccess?: boolean;
  successMessage?: string;
}) {
  if (isPending) {
    return (
      <p role="status" className="text-content-300 flex items-center gap-1.5 text-sm">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving…
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-destructive flex items-center gap-1.5 text-sm">
        <AlertCircle className="size-3.5" aria-hidden />
        {error.message}
      </p>
    );
  }

  if (isSuccess) {
    return (
      <p role="status" className="text-online flex items-center gap-1.5 text-sm">
        <Check className="size-3.5" aria-hidden />
        {successMessage}
      </p>
    );
  }

  return null;
}

/** A row of radio-like choice cards. Used for the theme and density pickers. */
export function ChoiceGroup<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: ReadonlyArray<{ value: TValue; label: string; preview: ReactNode }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <fieldset>
      <legend className="text-content-300 mb-3 text-sm font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'border-border hover:border-content-500 rounded-xl border p-1.5 text-left transition-colors',
              value === option.value && 'border-primary ring-primary/30 ring-3',
            )}
          >
            {option.preview}
            <span className="block px-1.5 py-1.5 text-sm font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * A row of colour swatches with a "None" escape hatch.
 *
 * Six choices rather than a colour input: a fixed palette keeps names readable
 * against the app's near-black surfaces, which a free picker does not — and the API
 * takes the same six-digit hex either way.
 */
export function ColorPicker({
  label,
  value,
  colors,
  onChange,
}: {
  label: string;
  value: string | null;
  colors: readonly string[];
  onChange: (color: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="text-content-300 mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'size-8 rounded-full transition-transform hover:scale-110',
              value === color && 'ring-content-100 ring-2 ring-offset-2 ring-offset-transparent',
            )}
          />
        ))}

        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            'border-border text-content-300 hover:text-content-100 rounded-full border px-3 py-1.5 text-xs transition-colors',
            value === null && 'border-content-300 text-content-100',
          )}
        >
          None
        </button>
      </div>
    </fieldset>
  );
}
