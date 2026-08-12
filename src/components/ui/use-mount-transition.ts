'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps a component mounted long enough to animate itself out.
 *
 * Every overlay in the admin — Modal, ActionMenu, GridSelect, HelpTip — closes
 * with `if (!open) return null`, which removes the element from the DOM in the
 * same frame the state flips. An exit animation on an element that no longer
 * exists never plays, so panels appear gently and vanish instantly, which
 * reads as a glitch rather than a close.
 *
 * This holds `mounted` true for `duration` after `open` goes false, so the
 * caller can render an exit animation and *then* disappear.
 *
 * Timer, not `animationend`: the reduced-motion rule sets durations to ~0 and
 * a display-none'd or never-started animation may not fire the event at all.
 * A timeout always resolves, so a panel can never get stuck half-closed.
 */
export function useMountTransition(open: boolean, duration = 160): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;

    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration, mounted]);

  return { mounted, closing: mounted && !open };
}
