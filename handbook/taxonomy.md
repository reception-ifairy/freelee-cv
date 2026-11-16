# Taxonomy

**Admin → Catalogue → Bots & taxonomy** is where every bot lives, filed under the twenty fields it works
in — and where you design new ones.

A *category* is a field: Marketing and Advertising, Legal and Compliance, Health and Medicine. A
*sector* is a specialism inside it: Search Engine Optimisation, Contract Review. Each field carries
real research — how big the UK market is, how fast it grows, which regulations apply, which industry
bodies matter, how risky the work is, and who it serves.

Under **Catalogue** in the sidebar:

- **Bots & taxonomy** — every bot, filed under the twenty fields and their sectors, as a browser
  (below). This is the one list of bots: the old *Personas* page opens it, keeping your search and
  filters. **New bot** and **Convert a bot** are at the top.
- **Audiences** — seventy groups of people, and what each of them needs.
- **Drafts** — the same browser showing only bots that are not live: switched off, or designed with an
  AI agent and not yet published. Open one and **Publish** it from its card.
- **Prompt modifiers** — the tones, styles and formats customers can layer onto a chat, in the same
  layout: the five types on the left, the list, the full instruction on each card.

## Categories are the pillars

The twenty categories are what Freelee is organised around. They sit at the top of the sidebar under
**Categories**, each with its colour and **live/all** bots; a category with no bot yet is dimmed. Click
one and it opens in the taxonomy browser with its own tabs (below).

Two categories carry more than the rest:

- **Education and Training** holds homeschooling: the public page */homeschooling* and the homeschool
  hub (Tutors, Curriculum, Families — see *Child profiles and privacy*).
- **Business and Finance** links the public page */business*.

(Until 16 November 2026 there were six "markets" worked out from each bot's audience. They are gone;
old links to them land on the matching category.)

## Browsing the taxonomy

The screen has two halves.

**On the left, the tree.** At the top is **All categories**, then the twenty fields, each with its
sectors underneath; the arrow beside a field folds its sectors in and out. Every line shows **live/all**
bots: **16/32** means 16 of the 32 bots filed there are switched on. **R1–R3** marks a field's risk
level. A field or sector that is switched off is greyed out. The box at the top finds a field or
sector by name: type *nutri* and only Lifestyle and Wellness › Nutrition Coaching is left.

**On the right, the list** for whatever you picked in the tree:

- **Bots** — the bots filed there, with their sector, audience type and whether they are live.
  Search, filter (live or not, audience type, curriculum tutors) and sort; click **Name** to sort by
  it.
- **Sectors** — the specialisms, with how many of their bots are live and their risk level.

**Click a row and its card slides in** from the right:

- a bot's card shows where it is filed, its audience and audience groups, its model, how much it is
  used, and its description — and its actions: **Publish** (or **Unpublish**), **Mark as featured**,
  **Duplicate**, **Delete**, and **Edit** for everything else;
- a sector's card shows its risk, who it suits and its description, and **Show its bots** jumps to
  that sector in the tree.

The arrows at the top of the card step through the rows on screen. **Esc**, a click beside the card or
your browser's **Back** button closes it.

Your search stays as you click around the tree, so you can search *maths* and then click through
fields to see where the maths bots are.

Everything you pick is in the page address, so you can bookmark a view or send it to someone.

When you pick a field, its header shows its live/all bots, sectors, audiences and risk, its public
page if it has one, and **Edit**. Under it, the field's tabs:

- **Bots** and **Sectors** — the lists described above, for this field.
- **Audiences** — the groups this field serves, and why (below).
- **AI agent** — where you design a new bot with the field's assistant.
- **Brief** — the researched facts: market size and growth, regulation, industry bodies, risk level,
  how the field leans towards consumers, businesses or government, and what its web address decides
  (the chat layout bots here get and the tools they are offered — which is why the address never
  changes when you rename a category).
- **Tutors**, **Curriculum**, **Families** — only on Education and Training: the homeschool hub.

On a phone, the tree folds into a **Browse** line above the list.

(*/admin/taxonomy/34* still works: it opens the same field in the browser.)

## Designing a bot with the field's AI agent

Every category has its own **AI agent**, on its **AI agent** tab. It runs on Anthropic (Claude Opus 5.5
unless you choose another model under *Settings → AI defaults*) and is paid from your own Anthropic key
in *Settings → Integrations* — without a key the tab says so and points you there.

**What it knows:** everything about the field — the market, its regulation and risk level, its sectors,
the audiences attached and why — **and every bot already filed here**, live or not, so it can point out
gaps and duplicates. In Education and Training it also knows the tutors and which subjects and key
stages have no live tutor.

**How it works:** it is a working conversation. Ask what is missing, who would pay, what a bot must
refuse to do. When you settle on something, ask it to propose it. A proposal appears under the chat:

- **New bot** — a complete persona. **Approve** saves it as an **inactive draft** in this category;
  you review and publish it in the editor.
- **Sector description** — a better description for one of the field's sectors.
- **Audience groups** — groups to link to the field, with a note on why.

**Nothing changes until you press Approve.** Reject keeps the record and changes nothing.

**Cost:** the header shows the model, its price per million tokens and what this conversation has cost
so far. The field's description is cached, so replies after the first cost much less to send.

**Paste a persona by hand** (under the proposals) is the old path: paste a persona written out as JSON
and it is saved as an inactive draft.

## Attaching audiences

The **Audiences** tab of a field lists the groups it serves, by kind (consumers, businesses, public
sector), each with **a note on why it matters to this field**. Press **Edit note** to
write or change one: notes go into the field's brief, beside the group. **Ctrl+Enter** saves; **Esc**
cancels.

**Choose audiences** opens all seventy, folded by family. Type in the box to find a group (*parents*,
*SEND*, *councils*). Each shows what those people actually need.

This matters more than it looks. Whatever you attach here becomes part of the brief every bot in this
field is designed against, and a wrong audience is worse than none.

> **It also changes how bots talk.** A persona tagged with an audience segment now carries that
> group's real needs and preferred tone into every reply — so a tutor written for Early Years is told
> those readers are 3–5, need play-based learning and emotional regulation, and want a playful,
> gentle, simple voice. It costs about 140 extra tokens per reply, which is a fraction of a credit.

## The Audiences screen

Seventy groups, in three families:

- **Consumer (B2C)** — children and young people, the adults who decide for them, adults in general,
  and interest groups.
- **Business (B2B)** — by size, by industry, by function.
- **Public sector (B2G)** — central government, local government, public services.

Each family is one folded line listing the groups in it — click it to open a row per group. Click a
row and the whole card slides in from the right: its age range where it has one, its UK context, what
it needs, how badly a wrong answer lands, and — where the catalogue records it — the tone it responds
to. The card also says **where the group is used**: which categories link it (with your note) and
which personas list it. If a persona of another kind lists it — a consumer tutor carrying a
public-sector group, say — the card says so: that group is kept but never reaches the persona's prompt.

The arrows at the top of the card step to the previous or next group; **Esc** or a click beside the
card closes it, and your browser's Back button does too. The address in the bar opens the same card,
so you can send someone a link to it.

This list lives in the code rather than the database, so changing it is a developer job. Attaching
segments to a field is not.

## Two things worth knowing

**Category addresses are permanent.** You can rename a category freely, but its address
(`/personas?category=legal`) is set once, because the chat layout and suggested tools of every
persona in it are keyed to that address.

**Specialisms shape the artwork.** A sector's address decides the density of the mark on every
persona card filed under it — so two specialists in the same sector look like relatives. Changing a
sector's address changes all of them.
