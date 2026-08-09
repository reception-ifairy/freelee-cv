# On-page editing

Ported from **ifairy.co.uk** (`/var/www/ifairy.co.uk`, GitHub `reception-ifairy/mainpage`),
after reading its landing-page editor end to end.

## What ifairy got right

Its `app/page.tsx` renders the real public page, and when an admin is signed in it injects the
editing controls **into** that page:

- `SectionChrome` — move, hide, settings, drawn on the module itself
- `LandingQuickEdit` — an "Edit Hero" button opening a full-screen form
- `LayoutStudio` — a floating panel: drag to reorder, add, duplicate, delete

Every renderer takes `canEdit` and `chrome` as props, so it is one code path — visitors get the
page, admins get the page *plus* controls. As its own comment puts it, you work "against the real
design rather than an abstract preview".

Ours was the opposite: edit blind at `/admin/frontpage`, then click "View page" to find out whether
it worked. That is the gap this closes.

## What was ported, and what was not

| From ifairy | Kept |
|---|---|
| Controls drawn on the block, on the live page | ✅ |
| Layout mode as a CSS flag on `<html>` | ✅ |
| Floating studio, drag to reorder, add block | ✅ |
| Click a block in the studio → page scrolls to it | ✅ |
| Optimistic reorder that **rolls back** if the save fails | ✅ (we had no rollback) |
| Admins see hidden blocks, faded | ✅ |

Three things ours does that ifairy's cannot:

- **Every scope.** Home page, CMS pages and blog posts, because the actions were already keyed by
  `BlockScope`. ifairy's is one landing page, one table, no page or post scoping.
- **Keyboard reordering.** ifairy uses `motion`'s `Reorder`, which is pointer-only — it has
  `aria-label`s but no keyboard path, so a keyboard-only admin cannot reorder at all. Ours reuses
  the same `@dnd-kit` sensors as the admin list.
- **One editing surface.** The popout renders the *same* `BlockFields` and `BlockLayoutControls` the
  admin screen uses. A parallel "simple" editor would drift from the real one within a release.

Not ported (yet): AI copy assist, grouped fields, `anchorId`/`showInNav`, card pop-outs.

## How it works

| File | Role |
|---|---|
| `src/components/site/editor-types.ts` | `EditScope`, `EditableBlock` (**plain module**) |
| `src/components/site/block-chrome.tsx` | per-block controls |
| `src/components/site/block-quick-edit.tsx` | the editor popout |
| `src/components/site/editor-studio.tsx` | floating panel + layout-mode toggle |
| `src/components/ui/modal.tsx` | focus-trapping dialog with a dirty guard |

### Layout mode is CSS, not state

The studio sets `document.documentElement.dataset.layoutMode = 'on'`. `globals.css` does the rest:

```css
.block-chrome { opacity: 0; pointer-events: none; }
[data-layout-mode='on'] .block-chrome { opacity: 1; pointer-events: auto; }
[data-layout-mode='on'] [data-block-id] { outline: 1px dashed …; padding-top: 3.25rem; }
```

Nothing re-renders when it flips, and an admin simply reading the site sees the site rather than a
scaffold. Verified by computed style: `opacity 0 / pointer-events none / outline none` when off,
`1 / auto / dashed` when on.

### Visitors never receive the editor

`canEdit` is decided on the **server**; a visitor's HTML contains no chrome, no studio and no editor
components. Hiding them in CSS alone would ship the whole editor to everyone. Verified: `grep` for
`block-chrome`, `data-block-id`, `Page builder`, `Layout mode` and `Edit page` in the anonymous
response returns **0** for all five.

### Caching

The home page previously declared `revalidate = 300`. That never applied — the site header reads the
session cookie, so the route has always rendered on demand (`ƒ` in the build output). It is now
`force-dynamic` and the misleading value is gone. Serving admin chrome from a shared cache would be
a genuine leak, so this is worth stating rather than leaving implicit.

## What was verified

Signed in as an admin against the live site:

| Check | Result |
|---|---|
| Anonymous HTML contains no editor markup | ✅ 0 of 5 probes |
| Studio lists every block | ✅ 7 on the home page |
| Chrome present but inert with layout mode off | ✅ opacity 0, pointer-events none |
| Layout mode reveals chrome and outlines | ✅ opacity 1, dashed outline |
| Click a block in the studio scrolls the page | ✅ |
| Editor opens on the block, with Content and Layout tabs | ✅ |
| **Edit and save in place** | ✅ headline changed on the page without leaving it |
| Hidden block: faded for admin, absent for visitors | ✅ opacity 0.4 vs not in HTML |
| CMS page scope, correct "full editor" link | ✅ `/admin/pages/1/builder` |
| Blog post scope, first block added from the post | ✅ `/admin/posts/1/builder` |
| Markdown fallback intact on a post with no blocks | ✅ |
| Home page after all of it | ✅ byte-identical, same sha256 |

One bug caught by testing rather than reading: `EditorStudio` was imported on the blog post page but
never rendered, so the studio would never have appeared there — an admin could not have added a
first block from the post itself.

## Still open

- Container children have no on-page controls; nested blocks are edited from the admin screen.
- No inline text editing — you open the block's editor rather than typing on the page itself.
- The studio is bottom-right and fixed; on a narrow phone it covers a fair amount of the page.
