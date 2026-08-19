# One assistant, or a team?

There are three ways work happens here. They look similar from the outside and behave very
differently. Picking the wrong one is the most common early mistake, and it's an annoying one to
undo, so it's worth five minutes now.

## The short version

| | **Chat** | **Room** | **Crew** |
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

## Crew — personas working without you

A crew — **"bot team"** in the admin panel — is a set of personas with a task and a running order.
You press start; they work through it between themselves and hand you the result.

**You do not wait.** Starting a run hands you straight to a page that updates itself as the team
works: which member is acting, what each step cost, how long it took, and the conversation as it
appears. If a run is going somewhere you did not intend, press **Stop run**. It finishes the reply
currently being written and then stops — a request already sent to the AI cannot be taken back, so
expect one more paragraph, not an instant halt.

This is the powerful one and the one to be careful with, because nobody is checking each step as
it happens. Every team has a **credit budget** and a **maximum number of turns** for exactly that
reason. Set both. A team that loops on a confusing task will happily spend everything you allow it
to, and the caps are what stop that being a real number on a real bill.

There are three ways a team can work, and the admin panel names them for what they do rather than
what they are called in the code:

| | What happens | Use it when |
|---|---|---|
| **Pipeline** | Each member acts once, in order, seeing everything before it | The task has stages — research, then draft, then check |
| **Fan-out** | Every member answers the same task at once, independently | You want several separate takes to compare |
| **Delegating** | One member decides who acts next, each turn, until it says the work is done | The path is not known up front |

In a pipeline the order *is* the behaviour, so the members list is drag-to-reorder.

**Use it when:** the task has clear stages, and you'd rather review the finished thing than
supervise the middle.

> **Example.** "Research this company, draft a one-page brief, then check it for anything legally
> risky." Researcher, writer, compliance persona — in that order, no human in between.

**Where to build one:** Admin → Teamwork → Bot teams. See *[Bot teams](/admin/handbook/bot-teams)*
for the full walkthrough.

## How to choose

Ask yourself one question: **do I need to be involved while this happens?**

- Yes, and it's one topic → **Chat**
- Yes, and I want several opinions → **Room**
- No, I just want the outcome → **Crew**

If you're unsure, start with a chat. Turning a chat into a room later costs you nothing. Starting
with a team and discovering you needed to steer it costs you the credits it spent getting the wrong
answer — though you can now stop it part-way and keep what it produced.

Whichever you use, you can file it under a **project** so the chats, rooms and teams for one piece
of work sit together with a running total of what they have cost. See
*[Projects](/admin/handbook/projects)*.
