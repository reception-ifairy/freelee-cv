# Taxonomy

**Admin → Taxonomy** is where the twenty fields your bots work in are described — and where you
design new ones.

A *category* is a field: Marketing and Advertising, Legal and Compliance, Health and Medicine. A
*sector* is a specialism inside it: Search Engine Optimisation, Contract Review. Each field carries
real research — how big the UK market is, how fast it grows, which regulations apply, which industry
bodies matter, how risky the work is, and who it serves.

Three screens:

- **Categories** — the twenty fields, their sectors and the bots filed there, as a browser (below).
- **Drafts** — bots that are not live: switched off, or designed in the workbench and not yet published. (Called Prototypes until November 2026.)
- **Audiences** — seventy groups of people, and what each of them needs.

## Markets

**Admin → Markets** shows the six markets Freelee is built for:
- **sold now:** Business, and Homeschooling & family;
- **planned:** Schools & educators, Adults, Interests and Public sector.

You never assign a bot to a market. Its market follows from who it is for:
- a curriculum tutor goes to Homeschooling & family;
- otherwise the bot's own audience groups decide;
- otherwise its field's groups decide.

So when you change a bot's audience, its market follows by itself.

Each market shows:
- how many of its bots are live;
- which fields serve it;
- how many of its audience groups are linked to a field;
- whether its public page exists.

Some markets have a **risk floor**. For example, anything serving children should be at least **R2**. A market's page warns you when a field serving it is below that.

**Browse its bots** opens the taxonomy browser filtered to that market. There the chips above the tree switch between markets: the tree shows only the fields that serve the market, and the list only its bots. Outside a market, the small coloured dots beside a field show which markets it serves.

## Browsing the taxonomy

The screen has two halves.

**On the left, the tree.** At the top is **All categories**, then the twenty fields, each with its
sectors underneath; the arrow beside a field folds its sectors in and out. Every line shows **live/all**
bots: **16/32** means 16 of the 32 bots filed there are switched on. **R1–R3** marks a field's risk
level. A field or sector that is switched off is greyed out. The box at the top finds a field or
sector by name: type *nutri* and only Lifestyle and Wellness › Nutrition Coaching is left.

**On the right, the list** for whatever you picked in the tree:

- **Personas** — the bots filed there, with their sector, audience type and whether they are live.
  Search, filter (live or not, audience type, curriculum tutors) and sort; click **Name** to sort by
  it.
- **Sectors** — the specialisms, with how many of their bots are live and their risk level.

**Click a row and its card slides in** from the right:

- a bot's card shows where it is filed, its audience and audience groups, its model, how much it is
  used, and its description;
- a sector's card shows its risk, who it suits and its description, and **Show its bots** jumps to
  that sector in the tree.

The arrows at the top of the card step through the rows on screen. **Esc**, a click beside the card or
your browser's **Back** button closes it.

Your search stays as you click around the tree, so you can search *maths* and then click through
fields to see where the maths bots are.

Everything you pick is in the page address, so you can bookmark a view or send it to someone.

When you pick a field, its header has **Workspace**, which opens the field's brief (below), and
**Edit**.

On a phone, the tree folds into a **Browse** line above the list.

## Opening a field

Press **Workspace** on a field (or open */admin/taxonomy/34* directly) and you get its brief on one page:

- **The market** — size, growth, regulation, industry bodies, risk level.
- **What the address decides** — the chat layout persons in this field get, and the tools they are
  offered. These are keyed to the category's web address, which is why that address never changes
  when you rename a category. Renaming is safe; the address is fixed.
- **Specialisms** — every sector, with how well the work suits consumers, businesses and the public
  sector.
- **Who this field serves** — the audiences you have attached.
- **The workbench** — where you design a new bot.

## Designing a bot

Press **Open workbench**. You get a conversation with an assistant that has already read everything
above — the market, the regulations, the risk level, the specialisms and the audiences.

It is a working conversation, not a form. Ask it what kind of specialist is missing, who would pay
for one, what the bot must refuse to do. It will push you towards a *narrow* specialist, because "a
marketing bot" helps nobody and "a bot that audits landing pages against the advertising code" is a
product.

**Nothing here is charged and nothing goes live.** This is your own tooling.

When you are happy, ask it to *write the persona out as JSON*, copy the block it produces, and paste
it into **Save as prototype** underneath. Pick a specialism from the dropdown first if you know it.

What you get is a **draft persona**, filed under this category, with its audience and its mandatory
safeguards already set, switched off and unlisted. Open it in the normal persona editor, change
whatever you like, and publish it when it is ready.

## Attaching audiences

On a category page, **Choose audiences** opens the full list of seventy. Each one shows what those
people actually need and how they want to be spoken to — not just a name.

This matters more than it looks. Whatever you attach here becomes part of the brief every bot in this
field is designed against, and a wrong audience is worse than none. Seventeen of the twenty fields
already have a starting set; the rest is yours to decide.

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
