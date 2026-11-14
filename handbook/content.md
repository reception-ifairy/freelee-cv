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

## Offering pages: For business and Homeschooling

Two pages describe what freelee offers. Both are linked in the top menu and the footer.

- **For business** — `/business`: specialist personas by sector, answers shaped your way, a team
  workspace, a chat widget for your site (on request), selling your own bots, exporting your data.
- **Homeschooling** — `/homeschooling`: AI tutors for Year 1 to Year 11 built on the national
  curriculum for England, one plan per child, parent accounts, encryption, how lessons work and
  questions parents ask.

They are ordinary pages built from blocks. Open one while signed in as an admin to edit any block in
place, or edit the menu links under **Menus**. Everything they promise exists today. Before adding a
new claim, check that the feature is really available to customers.

**Homeschooling says tutors are in preparation** (since November 2026), because no tutor is live
yet. The lines that depend on live tutors — the opening block, the closing call to action and the
first FAQ answer — come from `scripts/offering-copy.ts`. When the first tutors open, change those
lines and run `npx tsx scripts/update-homeschooling-copy.ts --apply`, or edit the blocks in place.

The **How it works** block now has an optional heading and sub-heading. Left blank, it shows the
standard "Three steps, no setup" (as on the home page).

