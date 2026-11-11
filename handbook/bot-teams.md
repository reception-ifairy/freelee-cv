# Bot teams

A bot team is a few bots working on one task together, without you in the middle. You give the team
a task, it works through it between its members, and you read the result.

(In the code, and on the customer side of the site, they are called *crews*. The admin panel calls
them bot teams because that is what they are.)

This page is the walkthrough. For *whether* you want a team at all — rather than a chat or a room —
read **[One assistant, or a team?](/admin/handbook/one-bot-or-a-team)** first.

## Making a team

**Admin → Teamwork → Bot teams → New bot team.** The page asks three questions, top to bottom, and
nothing is saved until you press **Create team** at the bottom.

### 1. What is this team for?

**Name** and **Goal** — for you and other admins. The bots never see them, so write whatever will
remind you what the team is for in a month.

**How do they work together?** Three cards. This is the most important choice on the page:

| | What happens | For example |
|---|---|---|
| **One after another** | The bots take turns, top to bottom. Each one sees everything said before it and builds on the previous answer. | A researcher finds facts, a writer drafts, an editor polishes. |
| **All at once** | Every bot gets the same task and answers on its own, without seeing the others. Good for comparing. | Three copywriters each pitch a slogan; you pick one. |
| **A lead bot delegates** | One bot — the lead — hands pieces of work to the others, one at a time, and decides when the job is finished. | A project lead asks the researcher, then the writer, then says it is done. |

If you are not sure, pick **One after another**. It is the easiest to predict.

### 2. Who is on the team

**Find bots** is a search box over every bot on the platform. Type part of a name or a category —
*legal*, *writer*, *marketing* — and press **Add** on the ones you want.

A bot marked **Not published yet** cannot be added: it has no live version to answer from, so it
could not take a turn. Publish it first (Personas → the bot → Publishing tab).

The bots you added appear under **On the team**. For each one:

- **Order.** Drag it by the handle on the left, or use the up and down arrows. In *One after another*
  the order is the running order, and each bot shows its place — **1st**, **2nd**, **3rd**. In the
  other two ways of working the order does not matter.
- **Role on this team.** Optional, and worth a sentence. It is added to that bot's instructions *on
  this team only* — the bot itself is unchanged everywhere else. Good roles say what to do **and what
  not to do**: *"Check the draft for legal risks. Do not rewrite it."*
- **Lead** (only in *A lead bot delegates*). Press the crown on the bot that should hand out the
  work. There is always exactly one lead, and it must be on the team. The lead is told who its
  teammates are and what each one's role is, so the roles matter even more here.
- **×** takes the bot off the team.

The page warns you, in amber, about anything that will not work well: a team of one bot (that is
just a chat), a lead team with no lead chosen, or a bot that is not published.

### 3. Limits (Advanced)

Folded away, because the defaults are fine to start with. The line under the heading always shows
what is set.

**Budget (credits).** The most one run may spend. Every bot reply costs credits; when the budget is
used up, the run stops. Default 50.

**Turn limit.** The most replies one run may have, counting every bot. It is what stops a team that
goes round in circles. Default 6. In *All at once* every bot answers exactly once, so if the team has
more bots than the limit, the limit is raised to the number of bots when you save — the page tells
you before and after.

Budget and turn limit are hard limits, checked before every reply. They are what stands between a
confused team and a real number on a real bill.

**Stop phrase.** Optional. If any reply contains it, the run ends there. `TASK COMPLETE` is a common
choice, paired with a role on the last bot telling it to say exactly that when the work is finished.

**Project.** Optional. Files the team, and every run it makes, under a project so the cost adds up
there. See *[Projects](/admin/handbook/projects)*.

**Enabled.** A switched-off team keeps its settings and history but cannot start new runs.

If something is wrong when you save, the message appears under the field it is about, and the page
takes you there.

## The team's page

After you create a team you land on its page. At the top: the name, the goal, and a one-line summary
such as *3 bots · one after another · up to 6 turns · budget 50 credits*. Below that, two tabs.

**Build** is the same three questions as before, filled in. Change anything and press **Save team**.
If you have changed something and not saved, the page says so next to the button.

**Runs** is where you try the team out and see everything it has done.

## Test run

On the **Runs** tab, type a task into **What should the team work on?** and press
**Start test run**.

Before you start, the page checks — for free — the things that would make a run fail:

- the team is switched on;
- it has bots (and, for a lead team, a lead and at least one other bot);
- every bot on it is published;
- the wallet that pays for the run has credits. For teams made in the admin that is the **platform
  wallet**. If it has fewer credits than the team's budget you get an amber note: the run can start,
  but may stop early.

If any check fails, **Start test run** stays greyed out and the reason is written next to it. Fix it
on the Build tab and come back.

A test run is a real run: it spends real credits, up to the team's budget. Start with a small task.

The run starts in the background and takes you straight to its own page. **You do not have to stay.**
The run continues whether the page is open or not; come back to it from the Runs tab at any time.

## Watching a run

The run page has two halves.

**Steps** is the record of the work: which bot replied, in what order, what each reply cost, how long
it took, and the error if one failed. The time bars are scaled against the slowest reply, so a bot
that stalled is obvious without reading a single number.

**Transcript** is what the team actually said, shown exactly the way the site shows a conversation.

At the top: how the run ended (or that it is still running), turns used against the limit, credits
spent against the budget, and the time taken. While a run is live the page updates itself.

## Stopping a run

Press **Stop run**.

It takes effect **after the current reply finishes**. A request already sent to the AI cannot be
recalled, so expect the bot currently writing to finish, and then the run stops. Everything produced
up to that point is kept.

## How a run ended

Every run ends for a reason, and the Runs tab and the run page say which, in plain words:

| What you see | What it means | What to do |
|---|---|---|
| **Finished — every bot had its turn** | *One after another* got to the last bot | Read the result |
| **Finished — every bot answered** | *All at once*: every bot replied | Compare the answers |
| **Finished — the lead said the work is done** | The lead replied with DONE | Read the result |
| **Finished — a reply used the stop phrase** | A bot said the stop phrase | Read the result |
| **Stopped — someone pressed Stop** | You (or another admin) stopped it | — |
| **Stopped — reached the turn limit** | It ran out of turns before finishing | Give a clearer task, or raise the limit |
| **Stopped — used up its credit budget** | It ran out of budget | The same two options |
| **Stopped — the lead didn't hand the task to anyone** | The lead replied without naming a teammate and without saying it was done | Give the lead a clearer role: *"Hand each part to one teammate by @name. Reply DONE when the work is complete."* |
| **Failed — a bot could not reply** | One reply errored | The Steps list shows which bot and why |

A team that regularly reaches its turn limit is usually being given a task too vague to finish, not a
task too big — raising the limit often just buys a more expensive version of the same confusion.

## A word on "A lead bot delegates"

This is the closest thing here to a team that organises itself, and the one to watch.

The lead finishes the run only by replying with **DONE on a line by itself**. The word "done"
somewhere in a sentence — *"I'm not done yet"* — does not count, so a lead cannot end the run by
accident. A lead that never decides the work is finished keeps delegating until the turn limit stops
it. The turn limit is the real backstop, not the lead's good judgement. Set it deliberately.
