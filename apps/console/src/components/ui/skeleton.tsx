import * as React from 'react';

import { cn } from '@/components/utility';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse bg-accent', className)}
      {...props}
    />
  );
}

export { Skeleton };
