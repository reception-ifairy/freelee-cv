# 57 — Admin navigation: lists with a card on demand

**Owner decision, 2026-11-14.** The taxonomy, sectors and audiences should be browsed as lists, with a card opening only when wanted ("zamiast widoku kart system, który ułatwia przejrzyste przeglądanie, a karta otwiera się na życzenie"). This doc covers the building blocks every admin browser uses. Later updates add the taxonomy browser, the pillars and the sidebar by job, each as its own section here.

## Building blocks (freelee #78)

| Piece | File | What it is for |
|---|---|---|
| `useDialog` | `src/components/ui/use-dialog.ts` | One focus trap for every overlay |
| `Sheet` | `src/components/ui/sheet.tsx` | A panel from the right over a list: the card on demand |
| `RouteSheet` | `src/components/ui/route-sheet.tsx` | A Sheet whose open state is the URL (`?open=…`) |
| `Disclosure` | `src/components/ui/disclosure.tsx` | A section that folds |
| overlay root | `src/components/ui/overlay-root.ts`, `#admin-overlay-root` in `src/app/admin/layout.tsx` | Where admin overlays portal to |

### useDialog

What every overlay must get right, now in one place:
- focus moves to the panel on open, and Tab and Shift+Tab stay inside it;
- Escape closes it;
- the page behind does not scroll;
- on close, focus returns to whatever opened it, or to `returnFocus()`.

**Only the top overlay answers keys.** A Modal over a Sheet used to mean that one Escape closed both, because every overlay listened on `document`. The rule now lives in a small stack, `dialog-stack.ts`:
- only the most recently opened overlay reacts to keys;
- the page unlocks only when the last overlay closes, whatever order they close in.

Modal, Sheet and the phone nav drawer all use it.

**Two bugs this fixed:**
- **The drawer had no Tab trap.** Tab walked out into the page hidden behind it.
- **Modal never moved focus into itself.** In the render where `open` turns true, the panel is not in the DOM yet: `useMountTransition` mounts it one effect later. So callers pass `open && mounted`.

### Sheet and RouteSheet

`Sheet` is anchored to the right edge at full height. Its header stays put while the body scrolls, and the header holds Previous/Next and other `actions`. Below `sm` it takes the whole screen.

`RouteSheet` is for server pages:
- **Opening.** The page reads `?open=` and renders the card as the sheet's children. A row that opens a card is an ordinary `<Link scroll={false}>`, so Back closes the card.
- **Previous/Next** use `replace`, so stepping through 70 cards does not need 70 presses of Back to leave.
- **Closing** replaces the URL with `closeHref`.
- **Remembering it is closed.** "Closed" is remembered per `openId`: close A and click B before the server answers, and B still opens.
- **Focus after closing** goes to `returnFocusId`, the row of the card being closed, even after stepping with Next.

**Why the overlay root.** A portal to `<body>` leaves `.admin-console dark`, which loses the console's colour tokens, its mono face and every `dark:` style. Not portalling at all fails differently: any ancestor with `backdrop-filter` or `transform`, such as the sticky header, traps a `fixed` panel inside itself. `#admin-overlay-root` is an empty element at the end of the console, so both problems are avoided. The phone drawer moved there too.

### Disclosure

Built on native `<details>`/`<summary>`:
- it opens and closes before hydration;
- find-in-page (Ctrl+F) opens a folded section when the match is inside it;
- keyboard and screen-reader behaviour comes with the element.

**The animation** comes from `.disclosure::details-content` with `interpolate-size` in `globals.css`. A browser without these simply opens the section at once.

**`defaultOpen` only ever opens the section after the first render, never closes it.** A server page re-renders on every soft navigation. Passed straight to `<details open>`, the section opened for a card snapped shut as the card closed, taking with it the row that should get focus.

## First use: the Audiences screen (freelee #78)

`/admin/taxonomy/audiences` used to be 70 expanded cards in one column. Now:
- **ten families that fold.** Each one-line summary lists the names in it and a count, so the whole catalogue fits on one screen.
- **One compact row per segment** inside a family: name, description, ages, sensitivity and code. The whole row is a link, and it is one tab stop.
- **The card opens in a sheet** at `?open=B2C-CYP-07`, with Previous/Next across all 70 and "3/70".

**The card also says where the segment is used** (`segmentUsage()`, `src/lib/taxonomy/segment-usage.ts`):
- which categories link the segment, with the operator's note;
- which personas list it, live ones first;
- how many of those personas never pass it to the model, because their own audience type differs (freelee #77).

The query runs only for the open card.

## Checks

`npm run admin:verify-dialogs` (`scripts/verify-dialog-stack.ts`, part of `blocks:verify`):
- the stack rules: a Modal over a Sheet, closing in either order, closing twice;
- that Modal, Sheet and the drawer use `useDialog` gated on being mounted;
- that the layout renders the overlay root outside the header;
- that Sheet and the drawer portal to the overlay root, not to `<body>`.

**Verified live with Playwright** (1440×900 and a 390×844 phone):
- the sheet renders inside the overlay root with the console's colours;
- focus is on the panel when it opens;
- 0 of 30 Tab presses left it;
- Next steps to the next segment;
- Escape closes it, returns focus to the row of the card that was open, and keeps its family open;
- Back closes it;
- a direct link opens it after hydration;
- a backdrop click closes it;
- the models Modal takes focus and gives it back to "Add manually";
- the drawer traps Tab (0 of 40) and returns focus to the menu button;
- on a phone the sheet is full width.
