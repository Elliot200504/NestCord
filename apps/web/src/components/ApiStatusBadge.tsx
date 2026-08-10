import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { keys } from '../api/keys';
import { cn } from '@/lib/utils';

/**
 * Proves the full stack is wired: React Query -> Vite proxy -> NestJS -> Prisma
 * -> PostgreSQL. Replace with something more useful once real data exists.
 */
export function ApiStatusBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: keys.health,
    queryFn: api.health,
    refetchInterval: 30_000,
  });

  const label = isPending ? 'Connecting…' : isError ? 'API offline' : `API ${data.status}`;
  const tone = isPending
    ? 'bg-content-500'
    : isError || data.database !== 'up'
      ? 'bg-dnd'
      : 'bg-online';

  return (
    <span className="text-content-300 flex items-center gap-1.5 text-xs" title={label}>
      <span className={cn('size-2 rounded-full', tone)} aria-hidden />
      {label}
    </span>
  );
}
