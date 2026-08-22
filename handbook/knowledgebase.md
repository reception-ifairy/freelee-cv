# Knowledgebase

The Knowledgebase is your bots' library. Put books, papers and notes in a folder on the server, and a
persona you grant access to can quote from them — with the page number.

Nothing about this is automatic, on purpose. The system **finds** your files and lists them; it does
not read them until you say so.

## Getting books in

Copy them into the library folder on the server:

```
/mnt/HC_Volume_104760667/freelee-library/
```

**Make a folder per subject.** Each folder becomes a *shelf*, and a shelf is what you grant to a bot:

```
freelee-library/
├── operations/          → shelf "Operations"
├── uk-employment-law/   → shelf "Uk employment law"
└── seo/                 → shelf "Seo"
```

That is the whole filing system, and it is why you should get the folders right before copying 500
books in: moving a file later means re-scanning.

Then open **Admin → Knowledgebase** and press **Scan folder**. Your books appear, marked *Not
processed yet*.

> **PDFs only, for now** (plus plain `.txt` and `.md`). Word documents and EPUBs are not read yet.

## Processing

Tick the books you want and press **Process selected**. Each one is read, cut into passages, and made
searchable. It runs in the background — you can close the page.

**What it costs:** a fraction of a penny per book. Indexing five hundred books costs about $1.60,
once. The real cost comes later, when bots actually use it — see below.

## Reading what actually happened

Click any book. The four stages across the top say, in order, what was done to it:

1. **Read the file** — how big it was, how many pages
2. **Pulled the text out** — how many characters of readable text came out
3. **Cut it into passages** — how many pieces, each a few paragraphs
4. **Made the passages searchable** — each piece turned into numbers, so a bot can find it by
   *meaning* rather than by exact words

Below that is the part worth your attention: **the passages themselves**. This is exactly what a bot
will read. If they look like coherent paragraphs, the book was processed well. If they look like
shredded half-sentences, something went wrong with that particular PDF and it is worth knowing before
a bot starts quoting it.

## The test question box

Type a question you know the book answers, and you will see the passages a bot would be handed — the
same ones, in the same order.

This is the fastest way to tell whether any of this is working. Use it after processing anything
important.

**Getting nothing back is a real answer.** If the library has no passage close enough to your
question, nothing comes back, and a bot would say it does not know rather than quote something
irrelevant. That is deliberate — a confident answer built on the wrong page is worse than an honest
"I don't know".

## Giving a bot access

Open a persona, go to the **Capabilities** area, and tick the shelves under *Grounding sources*. Your
own shelves are listed alongside the external sources; both work the same way.

Everything to do with what the bots know lives under **Knowledge** in the sidebar: *Library* (the
books), *Shelves* (what you grant), and *External sources* (someone else's search API).

From then on, every reply that persona gives is preceded by a search of those shelves, and anything
it uses is cited.

> **This makes replies cost more, and the customer pays.** A grounded reply sends the retrieved
> passages to the AI along with the question, and those count like any other text. On Haiku a plain
> reply costs 2 credits and a grounded one costs **6** — so a Starter pack goes from about 2,500
> replies to about 830. That is already as low as it goes without hurting answer quality. If the
> persona is one customers pay for, look at its price before switching this on.

## When a book will not process

| What you see | What it means |
|---|---|
| **Needs OCR** | The PDF is a scan — pictures of pages, with no text in them. Reading it needs OCR, which is not built yet. The book is kept in the list so it can be done later. |
| **Could not read it** | Something else went wrong. The reason is on the book's own page, in plain words. |
| **File is gone** | The file left the folder. What it taught the bots is kept — delete it here if that was deliberate. |

## Removing things

Two different actions, on the book's page:

- **Forget this document** — removes its passages. The file stays in the folder, so the next scan
  finds it again. Reversible in minutes.
- **Delete the file too** — also deletes the PDF. Not reversible from here.

## What is not built yet

- **Uploading from this panel.** Books arrive through the folder. The web server caps uploads at
  12 MB here and books are routinely larger, so this needs its own upload route.
- **OCR for scans.**
- **Rooms and bot teams** do not search the library — only one-to-one chats do.
