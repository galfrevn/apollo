import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { cn } from '@/components/utility';

function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root modal={false} {...props} />;
}

const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        data-slot="sheet-content"
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          'fixed top-[70px] right-0 bottom-0 z-30 flex w-full flex-col border-l bg-card lg:w-1/3',
          'animate-[sheet_0.4s_cubic-bezier(0.16,1,0.3,1)_both]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-6 right-5 text-dim transition-colors duration-150 hover:text-foreground">
          <Icons.Close size={16} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-sm font-medium', className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetTitle };
