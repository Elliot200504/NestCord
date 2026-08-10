import { Bird } from 'lucide-react';

import { cn } from '@/lib/utils';

const SIZES = {
  sm: { tile: 'size-6 rounded-md', icon: 'size-4' },
  md: { tile: 'size-8 rounded-lg', icon: 'size-5' },
  lg: { tile: 'size-12 rounded-2xl', icon: 'size-7' },
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
        'bg-primary text-primary-foreground grid shrink-0 place-items-center',
        tile,
        className,
      )}
    >
      <Bird className={icon} />
    </span>
  );
}
