import { useId } from 'react';

interface AuthFieldProps {
  label: string;
  name: string;
  type: 'text' | 'email' | 'password';
  autoComplete: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
}

/** A labelled input. The browser handles the first pass of validation; the server has the last word. */
export function AuthField({ label, hint, ...input }: AuthFieldProps) {
  const hintId = useId();

  return (
    <label className="block">
      <span className="text-content-300 text-sm font-medium">{label}</span>
      <input
        {...input}
        aria-describedby={hint ? hintId : undefined}
        className="border-input bg-surface-900/60 focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 w-full rounded-xl border px-3.5 py-2.5 outline-none focus-visible:ring-3"
      />
      {hint && (
        <span id={hintId} className="text-content-500 mt-1 block text-xs">
          {hint}
        </span>
      )}
    </label>
  );
}
