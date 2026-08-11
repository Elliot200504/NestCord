import { Bird } from 'lucide-react';

import { cn } from '@/lib/utils';

/* Round, not rounded-rectangular — a nest has no corners. */
const SIZES = {
  sm: { tile: 'size-6', icon: 'size-3.5' },
  md: { tile: 'size-8', icon: 'size-4.5' },
  lg: { tile: 'size-12', icon: 'size-6' },
} as const;

interface BrandMarkProps {
  size?: keyof typeof SIZES;
  className?: string;
}

/** The NestCord mark: a white bird on brand red. Decorative — label the link. */
export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  const { tile, icon } = SIZES[size];

  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary text-primary-foreground grid shrink-0 place-items-center rounded-full',
        tile,
        className,
      )}
    >
      <Bird className={icon} />
    </span>
  );
}
