# Blog, pages and menus

The three places your written content lives.

## Blog — Content → Blog

Dated articles, listed newest first at `/blog`.

| Field | Notes |
|---|---|
| **Title / Slug** | Slug is the address. Don't change it after publishing — it breaks links. |
| **Excerpt** | Shown on the listing card. Write it; a truncated first paragraph reads badly. |
| **Content** | Markdown. Headings, lists, tables, code, links. |
| **Category** | Groups posts and drives the filter on the blog page. |
| **Published** | Off = a draft only you can see. |
| **Meta title / description** | For search engines. Leave blank to use the title and excerpt. |

Reading time is calculated automatically from length.

## Pages — Content → Pages

Undated standalone pages: About, Terms, Privacy, Contact. Live at `/your-slug`.

Same editor as posts, plus **noindex**, which asks search engines to skip the page. Use it for
thank-you pages and anything not meant to be found cold.

Pages don't appear anywhere automatically. Add them to a menu — that's the next section.

## Menus — Content → Menus

Which links appear in the header, the footer, and the legal row at the very bottom.

Each link has a **label**, a **URL** (internal like `/pricing`, or a full external address), a
**position**, and a **visible to** setting:

| Visible to | Who sees it |
|---|---|
| Everyone | All visitors |
| Guests only | Signed-out visitors — good for "Sign up" |
| Signed in only | Logged-in users — good for "Dashboard" |
| Admins only | Just you |

Keep the header to five or six links. It's the navigation people actually use, and past about six
it stops being navigation and starts being a list.
