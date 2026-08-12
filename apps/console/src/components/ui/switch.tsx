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
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150',
        'border-line bg-raised data-[state=checked]:border-amber data-[state=checked]:bg-amberdim',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'block size-3.5 translate-x-0.5 rounded-full bg-faint transition-transform duration-150',
          'data-[state=checked]:translate-x-[1.125rem] data-[state=checked]:bg-amber',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
