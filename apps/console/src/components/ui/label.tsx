import * as LabelPrimitive from '@radix-ui/react-label';
import * as React from 'react';

import { cn } from '@/components/utility';

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn('block text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Label };
