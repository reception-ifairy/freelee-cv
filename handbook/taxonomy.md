# Taxonomy

**Admin → Taxonomy** is where the twenty fields your bots work in are described — and where you
design new ones.

A *category* is a field: Marketing and Advertising, Legal and Compliance, Health and Medicine. A
*sector* is a specialism inside it: Search Engine Optimisation, Contract Review. Each field carries
real research — how big the UK market is, how fast it grows, which regulations apply, which industry
bodies matter, how risky the work is, and who it serves.

Three screens:

- **Categories** — the twenty fields. Open one to see everything known about it.
- **Prototypes** — bots you have designed but not yet published.
- **Audiences** — seventy groups of people, and what each of them needs.

## Opening a field

Click a category and you get its brief on one page:

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

Each shows its age range where it has one, its UK context, what it needs, how badly a wrong answer
lands, and — where the catalogue records it — the tone it responds to.

This list lives in the code rather than the database, so changing it is a developer job. Attaching
segments to a field is not.

## Two things worth knowing

**Category addresses are permanent.** You can rename a category freely, but its address
(`/personas?category=legal`) is set once, because the chat layout and suggested tools of every
persona in it are keyed to that address.

**Specialisms shape the artwork.** A sector's address decides the density of the mark on every
persona card filed under it — so two specialists in the same sector look like relatives. Changing a
sector's address changes all of them.
