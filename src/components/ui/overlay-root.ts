/**
 * Where overlays portal to.
 *
 * In the admin, `#admin-overlay-root` — an empty element at the end of
 * `.admin-console` (src/app/admin/layout.tsx), so a portalled panel keeps the
 * console's colour tokens, its mono face and its `dark` class. Portalling to
 * <body> escapes all three: the panel renders in the public site's indigo and
 * light-mode styles. Outside the admin there is no such element and <body> is
 * the right place.
 *
 * Call it only on the client (in a render that happens after mount).
 */
export const ADMIN_OVERLAY_ROOT_ID = 'admin-overlay-root';

export function overlayRoot(): HTMLElement {
  return document.getElementById(ADMIN_OVERLAY_ROOT_ID) ?? document.body;
}
