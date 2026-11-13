# Tutors that teach from the curriculum

Every tutor for children on freelee works the same way. **You write the character**: who it is,
its voice and world, how it encourages and explains. **The curriculum supplies the rest**: what to
teach, in what order, and how to talk to a child of that age. It comes from curriculum.ifairy.co.uk,
the UK curriculum service on the same server.

How the pieces fit:

- **The curriculum** knows the official learning objectives for each school year, topics in order,
  past test questions, and *developmental levels*: how a tutor should talk to a 6-year-old, a
  9-year-old or a 15-year-old. It knows nothing about any child.
- **freelee** knows the child. A parent creates a profile (docs: Child profiles and privacy), and
  freelee builds **one learning plan for that child**, shared by every tutor they talk to.
- **T1000** is where you see and control it all: what freelee may take from the curriculum, how much
  it used, the topics waiting for your review, and the plan a child of a given year would get.

Each tutor is limited to the **key stages and subjects** you choose. A Year 4 maths tutor never
looks at GCSE material, however the child asks.

## 1. Connect the curriculum

Do this once. Open **Settings → Providers & keys** and find **Curriculum** under *Knowledge*.

1. Paste the API key. It starts with `cur_` and is issued for freelee in T1000's curriculum panel.
   Leave **Address** and **Grant** blank — the defaults are right.
2. **Save.**
3. **Test.** It checks the key and runs one tiny search for "fractions".
4. **Fetch scope.** It asks the curriculum what this key may see — which key stages and subjects,
   with how many documents and objectives each — and remembers the answer. This list is what the
   persona form offers you, so press **Fetch scope** again whenever the scope is changed in T1000.

What Test can say:

| Message | What to do |
|---|---|
| **Works — key accepted** | Nothing. Press Fetch scope. |
| **Key rejected** | Copy the key again in full. In T1000, check the freelee client is enabled and the key has not been rotated. |
| **The key works but may not use the grant** | In T1000, allow `curriculum-rag` for the freelee client. |
| **Today's allowance for it is used up** | The daily limit is reached. It resets tomorrow, or raise it in T1000. |
| **Could not reach the curriculum** | The curriculum server is down or unreachable. Try again later. |

## 2. Make a tutor

Open the persona (or create one) and go to the **Prompt** tab. Below the starter suggestions is the
**Curriculum** section.

1. Tick **Teaches from the curriculum**.
2. Tick the **key stages** — the learner's stage. Most tutors have one.
3. Tick the **subjects** it may teach. A homework helper can have them all.
4. Optionally pick a **year**, for a tutor made for one class. Learning objectives then default to
   that year.
5. Save.

If the section says *Connect and Fetch the Curriculum API in Settings first*, step 1 is not done
yet — the key stages and subjects to choose from come from **Fetch scope**.

Saving also ticks the matching audience on the **Personality** tab (KS2 → *KS2 Learners*, and so
on), so the persona knows who it is talking to.

**Write the prompt as the character, not the subject or the age.** Who the tutor is, its world, how
it encourages, what it does when a child is stuck.

Leave out:
- **subject content**: the plan supplies it, and a prompt full of facts is a prompt full of things
  that can be wrong;
- **rules for a particular age**: the developmental level supplies them, so the same character can
  teach a 6-year-old and a 10-year-old.

A shorter prompt also makes every reply cheaper.

> *"You are Max, a cheerful maths coach for children aged 8 and 9. Explain one small step at a
> time, use everyday objects as examples, and ask the child to try before you show the answer.
> Praise effort, not speed."*

Don't also tick a **grounding source** that points at the curriculum — the tutor would pay twice for
the same text.

## 3. What happens in a lesson

1. A parent creates a profile for their child: nickname, school year, subjects.
2. freelee asks the curriculum, once, for that year's **plan**: the topics in order, with the
   official objectives. Only the year and subjects are sent, never anything about the child.
3. The parent starts **child mode**. The child picks a tutor and starts a lesson.
4. At every reply the tutor has in front of it:
   - its own character;
   - how to talk at this child's age: sentence length, kind of questions, what to say when an
     answer is wrong, phrases it must never use (e.g. "it's easy");
   - the child's nickname, interests and the adaptations the parent chose;
   - what the child is learning now, with the official objectives, and what is due for a quick
     review.
5. It teaches from that. It looks something up in the curriculum only when the child asks about
   something the plan does not cover, and at most once per reply.
6. When the child shows they understand, the tutor marks it in the plan (the child does not see
   this). The plan moves on, and understood topics come back for short reviews after 1, 3, 7 and 21
   days.
7. The parent can read every lesson and see progress on the Children page.

The tutor also:

- **stays at its level**, inside its key stages and subjects, and says so if asked about something
  else;
- **names its sources** when it looked something up;
- **admits when there is nothing**, or when it cannot check right now, instead of guessing.

Lessons happen in one-to-one chats. In rooms and bot teams a tutor talks like any persona.

## 4. What you see in T1000

The curriculum panel in T1000 shows the freelee client:

- **Its scope and limits** — which key stages, subjects and kinds of material freelee may see,
  whether licence-restricted text is withheld, and how many requests a minute and a day. This is the
  outer limit for every tutor; change it there, then **Fetch scope** here.
- **Usage** — requests per day, errors, and which routes were used.
- **What was served** — the documents, learning objectives, subjects and key stages most often
  handed to tutors.
- **A preview** — exactly what freelee would see for a given key stage and subject, including which
  documents are withheld.

You will **not** see what children asked. The curriculum records which items it served, never the
questions — the people typing are children.

## What it costs

Building a plan costs nothing per lesson: it happens once, when the profile is saved. A lesson reply
costs what any reply costs, plus the short learner and plan sections.

Measured on the same eight questions (Year 1 to Year 11) with the plain **Baseline Tutor**:

| Per reply | Before plans (tutor searched every time) | With the child's plan |
|---|---|---|
| Credits, average | 111 | **59** |
| Credits, most expensive reply | 216 | **82** |
| Look-ups per reply | 2.1 | **0.44** |

Before plans, the tutor sometimes looked things up so many times that the child got no answer at
all. That cannot happen any more.

## Measuring tutors

**Baseline Tutor** is a plain teacher with no world, no voice and a short prompt. It is not listed,
customers never see it, and it is used only to measure.

A measurement sends eight short learner messages (Year 1 to Year 11) through real lessons and
records for each reply:

- what it cost (tokens and credits);
- how many times the tutor looked something up;
- whether the reply suits the child's age: sentence and reply length, no "it's easy" or "wrong",
  exactly one question at the end;
- whether it named a real curriculum objective for that year.

When we import characters, each one is measured the same way. The difference to Baseline Tutor is
what the character itself costs.

Ask Claude to run a measurement. It costs only the tutor's own replies (about 500–1,000 credits for
the full set). Engineering details: `docs/52-curriculum-tutors.md` and
`docs/53-tutor-measurement.md`.
