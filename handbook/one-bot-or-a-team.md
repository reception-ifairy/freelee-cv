# One assistant, or a team?

There are three ways work happens here. They look similar from the outside and behave very
differently. Picking the wrong one is the most common early mistake, and it's an annoying one to
undo, so it's worth five minutes now.

## The short version

| | **Chat** | **Room** | **Bot team** |
|---|---|---|---|
| Who is there | One person, one persona | Several people and several personas | Personas only |
| Who speaks | Both, taking turns | Anyone, and personas when @mentioned | The personas, to each other |
| Are you needed? | Yes, constantly | Yes, you drive it | No — you start it and walk away |
| Replies appear | Word by word, live | All at once, per persona | As each step finishes |
| Good for | Getting an answer | Getting several opinions | Getting a task done |
| Costs credits | Per message | Per persona that replies | Per step, with a budget cap |

## Chat — one to one

The default, and the right answer most of the time.

You ask, one persona answers, back and forth. The reply streams in as it's written. This is what
your customers use on the public site.

**Use it when:** someone needs help with something. That's it. It covers the overwhelming
majority of real use.

> **Example.** A parent opens the maths tutor and asks how to explain fractions to a seven-year-old.
> One question, one specialist, one good answer.

## Room — several voices, you in the chair

A room is a group conversation. Real people can be in it, and so can personas. Personas only
speak when someone **@mentions** them by name — they never chip in on their own, and they never
reply to each other. That restraint is deliberate: a room where bots talk to bots becomes noise
in about four messages.

**Use it when:** you want more than one perspective on the same question, with a human deciding
what to do about it.

> **Example.** You're writing a job advert. You post the draft in a room and type
> "@Lex any legal problems here? @Muse make it sound less corporate." Both reply, in the same
> thread, and you take the bits you want.

Rooms don't stream word by word. Each mentioned persona thinks, then its whole reply appears. With
three personas mentioned, you wait for the slowest one. That's normal.

## Bot team — bots working without you

A bot team is a few bots with one task between them. You press start; they work through it between
themselves and hand you the result. (On the customer side of the site, and in the code, a bot team is
called a **crew** — same thing.)

**You do not wait.** Starting a run hands you straight to a page that updates itself as the team
works: which bot is replying, what each reply cost, how long it took, and the conversation as it
appears. If a run is going somewhere you did not intend, press **Stop run**. It finishes the reply
currently being written and then stops — a request already sent to the AI cannot be taken back, so
expect one more paragraph, not an instant halt.

This is the powerful one and the one to be careful with, because nobody is checking each step as
it happens. Every team has a **credit budget** and a **maximum number of turns** for exactly that
reason. Set both. A team that loops on a confusing task will happily spend everything you allow it
to, and the caps are what stop that being a real number on a real bill.

There are three ways a team can work together:

| | What happens | Use it when |
|---|---|---|
| **One after another** | The bots take turns in a set order; each builds on the previous answer | The task has stages — research, then draft, then check |
| **All at once** | Every bot answers the same task on its own, at the same time | You want several separate takes to compare |
| **A lead bot delegates** | One bot — the lead — hands work to the others and decides when it is done | The path is not known up front |

In *One after another* the order *is* the behaviour, so you set it yourself — drag the bots, or use
the arrows. Each bot can also be given a **role on this team** ("check for legal risks, don't
rewrite"), which applies on that team only. Before a run starts, the team's page checks for free
that every bot is published and the wallet has credits, so a team that cannot work never gets as far
as spending anything.

**Use it when:** the task has clear stages, and you'd rather review the finished thing than
supervise the middle.

> **Example.** "Research this company, draft a one-page brief, then check it for anything legally
> risky." Researcher, writer, compliance bot — one after another, in that order, no human in
> between.

**Where to build one:** Admin → Teamwork → Bot teams → **New bot team**. See
*[Bot teams](/admin/handbook/bot-teams)* for the full walkthrough.

## How to choose

Ask yourself one question: **do I need to be involved while this happens?**

- Yes, and it's one topic → **Chat**
- Yes, and I want several opinions → **Room**
- No, I just want the outcome → **Bot team**

If you're unsure, start with a chat. Turning a chat into a room later costs you nothing. Starting
with a team and discovering you needed to steer it costs you the credits it spent getting the wrong
answer — though you can now stop it part-way and keep what it produced.

Whichever you use, you can file it under a **project** so the chats, rooms and teams for one piece
of work sit together with a running total of what they have cost. See
*[Projects](/admin/handbook/projects)*.
