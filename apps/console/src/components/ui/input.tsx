import * as React from 'react';

import { cn } from '@/components/utility';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full border bg-transparent px-3 text-sm text-foreground transition-colors duration-150',
        'hover:border-border-hover focus:border-dim',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
