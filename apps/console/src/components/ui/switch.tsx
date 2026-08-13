import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';

import { cn } from '@/components/utility';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors duration-150',
        'bg-accent data-[state=checked]:bg-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'block size-3.5 translate-x-0.5 rounded-full bg-dim transition-transform duration-150',
          'data-[state=checked]:translate-x-[1.125rem] data-[state=checked]:bg-primary-foreground',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
