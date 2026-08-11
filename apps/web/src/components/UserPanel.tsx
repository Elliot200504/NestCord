import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Headphones, LogOut, Mic, Settings } from 'lucide-react';

import { useCurrentUser, useLogout } from '@/features/auth/use-auth';
import { avatarTint } from '@/lib/avatar-tint';
import { PresenceDot } from './PresenceDot';

/** Bottom-left panel: who you are, plus quick toggles. */
export function UserPanel() {
  const { data: user, isPending } = useCurrentUser();
  const logout = useLogout();

  const username = user?.username ?? '';
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="bg-surface-900 border-border flex items-center gap-2 border-t px-2 py-2.5">
      <div className="relative">
        <div
          className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${avatarTint(username)}`}
        >
          {initials}
        </div>
        <PresenceDot status={user?.status ?? 'OFFLINE'} className="absolute -right-0.5 -bottom-0.5" />
      </div>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{isPending ? 'Loading…' : username}</p>
        <p className="text-content-500 truncate text-xs">Here now</p>
      </div>

      <IconButton label="Toggle microphone">
        <Mic className="size-4" aria-hidden />
      </IconButton>
      <IconButton label="Toggle headphones">
        <Headphones className="size-4" aria-hidden />
      </IconButton>
      <IconButton label="Log out" onClick={() => logout.mutate()} disabled={logout.isPending}>
        <LogOut className="size-4" aria-hidden />
      </IconButton>

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

interface IconButtonProps {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function IconButton({ label, children, onClick, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="text-content-300 hover:bg-surface-700 hover:text-content-100 grid size-7 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}
