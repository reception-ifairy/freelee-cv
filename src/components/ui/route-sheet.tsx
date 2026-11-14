'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from './sheet';

/**
 * A Sheet whose open state is the URL (`?open=…`), rendered by a server page.
 *
 * Why the URL: a card you can link to, reload, and close with Back. The page
 * reads `open` from its search params and renders this with the card as
 * children. A row that opens a card is an ordinary `<Link scroll={false}>`
 * (a history entry, so Back closes the card); Previous/Next inside the card
 * should `replace`, so stepping through seventy cards does not need seventy
 * presses of Back to leave.
 *
 * Closing replaces the URL with `closeHref` rather than pushing it, so closing
 * does not add an entry that Back would reopen. The panel starts its exit
 * animation at once; the navigation removes it when the server answers.
 *
 * `openId` is the `?open=` value. Closed is remembered per id, not as a flag:
 * close A and click row B before the server has answered, and the page renders
 * this same instance with B — a plain `open` flag would still say closed.
 * (Keying the component by id instead would replay the slide-in on every
 * Previous/Next.)
 */
export function RouteSheet({
  openId,
  closeHref,
  returnFocusId,
  ...props
}: Omit<React.ComponentProps<typeof Sheet>, 'open' | 'onClose' | 'returnFocus'> & {
  openId: string;
  closeHref: string;
  /** Element id to focus on close — the row of the card being closed. */
  returnFocusId?: string;
}) {
  const router = useRouter();
  const [closedId, setClosedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <Sheet
      {...props}
      open={closedId !== openId}
      returnFocus={returnFocusId ? () => document.getElementById(returnFocusId) : undefined}
      onClose={() => {
        setClosedId(openId);
        startTransition(() => router.replace(closeHref, { scroll: false }));
      }}
    />
  );
}
