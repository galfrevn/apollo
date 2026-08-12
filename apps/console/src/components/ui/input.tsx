import * as React from 'react';

import { cn } from '@/components/utility';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full rounded-lg border border-line bg-ground px-3 text-sm text-ink transition-colors duration-150',
        'hover:border-faint focus:border-amber',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
