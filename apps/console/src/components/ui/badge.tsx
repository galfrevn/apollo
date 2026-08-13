import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/components/utility';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-border bg-accent text-foreground',
        strong: 'border-foreground/20 bg-foreground/10 text-foreground',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
