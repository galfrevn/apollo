import { useRef } from 'react';

import { REDUCED_MOTION_SAFE_QUERY, gsap, useGSAP } from '@/landing/motion';

import type { ReactNode } from 'react';

interface MagneticLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly isExternal?: boolean;
  readonly onWarm?: () => void;
}

const MAGNET_PULL_X = 6;
const MAGNET_PULL_Y = 4;

export function MagneticLink({
  href,
  children,
  className,
  isExternal = false,
  onWarm,
}: MagneticLinkProps) {
  const linkReference = useRef<HTMLAnchorElement | null>(null);

  useGSAP(
    () => {
      const linkElement = linkReference.current;
      if (linkElement === null) {
        return;
      }
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        const pullHorizontal = gsap.quickTo(linkElement, 'x', {
          duration: 0.3,
          ease: 'power3',
        });
        const pullVertical = gsap.quickTo(linkElement, 'y', {
          duration: 0.3,
          ease: 'power3',
        });
        const handlePointerMove = (event: PointerEvent) => {
          const bounds = linkElement.getBoundingClientRect();
          const ratioX = (event.clientX - bounds.left - bounds.width / 2) / bounds.width;
          const ratioY = (event.clientY - bounds.top - bounds.height / 2) / bounds.height;
          pullHorizontal(ratioX * MAGNET_PULL_X);
          pullVertical(ratioY * MAGNET_PULL_Y);
        };
        const handlePointerLeave = () => {
          pullHorizontal(0);
          pullVertical(0);
        };
        linkElement.addEventListener('pointermove', handlePointerMove, {
          passive: true,
        });
        linkElement.addEventListener('pointerleave', handlePointerLeave, {
          passive: true,
        });
        return () => {
          linkElement.removeEventListener('pointermove', handlePointerMove);
          linkElement.removeEventListener('pointerleave', handlePointerLeave);
        };
      });
    },
    { scope: linkReference },
  );

  return (
    <a
      ref={linkReference}
      href={href}
      className={className}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
      onPointerEnter={onWarm}
      onFocus={onWarm}
    >
      {children}
    </a>
  );
}
