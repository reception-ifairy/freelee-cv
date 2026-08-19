# Bot teams

A bot team is several personas working one task together, without you in the middle. In the code
and in the older documentation they are called *crews*; the admin panel calls them bot teams because
that is what they are.

This page is the operator's walkthrough. For *whether* you want a team at all — rather than a chat
or a room — read **[One assistant, or a team?](/admin/handbook/one-bot-or-a-team)** first.

## Building one

**Admin → Teamwork → Bot teams**, then the form beside the list.

**Name and description.** For you, not for the AI. Say what the team is for.

**Mode.** Three choices, and it is the most consequential setting on the page:

| | What happens |
|---|---|
| **Pipeline** | Each member acts once, in order, each seeing everything that came before |
| **Fan-out** | Every member answers the same task at once, independently, seeing only the task |
| **Delegating** | One member — the supervisor — picks who acts next each turn, until it decides the work is done |

**Members.** On the team's own page you get two columns of persona cards — available on the left,
the team on the right. **Drag a card across to add it**, drag it back to remove it, and drag within
the right-hand column to set the order. **In pipeline mode that order is the order they run in.**
Every card also has a plain **+** and **×** button, which work with a keyboard.

**Budget and max turns.** Both are hard caps, checked before every step. These are not suggestions —
they are the thing standing between a confused team and a real number on a real bill. The defaults
(50 credits, 6 turns) are deliberately modest.

**Stop phrases.** Optional. If any reply contains one of these, the run ends. `TASK COMPLETE` is a
common choice, paired with an instruction in the last member's prompt telling it to say exactly that
when the work is finished.

**Project.** Optional. Files the team, and every run it produces, under a project.

## Running one

Open the team and describe the task. The run starts in the background and hands you straight to its
own page.

**You do not have to stay.** The run continues whether the page is open or not. Come back to it from
the team's Runs list at any time.

## Watching a run

The run page has two halves.

**Steps** is the record of the work: which member acted, in what order, what each step cost, how
long it took, and the error if one failed. The time bars are scaled against the slowest step, so a
member that stalled is obvious without reading a single number.

**Transcript** is what the team actually said, rendered exactly as the product renders a
conversation — same formatting, same speaker labels.

At the top: status, turns used against the limit, credits spent against the budget, and elapsed
time. While a run is live the page updates itself.

## Stopping a run

Press **Stop run**.

It takes effect **after the current step finishes**. A request already sent to the AI cannot be
recalled, so expect the member currently writing to finish its reply, and then the run stops. The
run is recorded as *cancelled* — not completed, and not failed, because it was neither.

Everything produced up to that point is kept.

## Reading the outcome

A run ends for a reason, and the page names it:

| Ending | What it means |
|---|---|
| **Completed** | Every member did its work, or a stop phrase matched |
| **Cancelled** | You stopped it |
| **Max turns reached** | It ran out of turns before finishing — raise the limit, or give a clearer task |
| **Budget exceeded** | It ran out of credits — the same two options |
| **Failed** | A step errored. The step list shows which one and why |

The last three are worth paying attention to. A team that regularly hits its turn limit is usually
being given a task too vague to finish, not a task too big — raising the cap often just buys a more
expensive version of the same confusion.

## A word on delegating mode

Delegating mode is the closest thing here to a team that genuinely organises itself, and the one to
watch. A supervisor that never decides the work is done will keep delegating until the turn cap
stops it.

The cap is the real backstop, not the supervisor's good judgement. Set it deliberately.
