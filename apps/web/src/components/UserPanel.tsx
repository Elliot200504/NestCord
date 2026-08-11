import { Link } from '@tanstack/react-router';
import { Headphones, Mic, Settings } from 'lucide-react';

import { PresenceDot } from './PresenceDot';

/** Bottom-left panel: who you are, plus quick toggles. */
export function UserPanel() {
  return (
    <div className="bg-surface-900 border-border flex items-center gap-2 border-t px-2 py-2.5">
      <div className="relative">
        <div className="bg-primary grid size-8 place-items-center rounded-full text-xs font-semibold">
          TU
        </div>
        <PresenceDot status="ONLINE" className="absolute -right-0.5 -bottom-0.5" />
      </div>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">testuser</p>
        <p className="text-content-500 truncate text-xs">Here now</p>
      </div>

      <button
        type="button"
        aria-label="Toggle microphone"
        className="text-content-300 hover:bg-surface-700 hover:text-content-100 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
      >
        <Mic className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Toggle headphones"
        className="text-content-300 hover:bg-surface-700 hover:text-content-100 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
      >
        <Headphones className="size-4" aria-hidden />
      </button>
      <Link
        to="/settings"
        aria-label="User settings"
        className="text-content-300 hover:bg-surface-700 hover:text-content-100 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
      >
        <Settings className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
