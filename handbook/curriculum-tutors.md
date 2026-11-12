# Tutors that teach from the curriculum

A tutor is an ordinary persona with one difference: what it teaches comes from the **UK
curriculum**, live, instead of from whatever the AI happens to remember. You write the character —
its voice, its patience, how it explains things. The curriculum supplies the facts: passages from
official documents, the learning objectives for each year, and real test questions.

Each tutor is limited to the **key stages and subjects** you choose. A tutor for Year 4 maths never
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

**Write the prompt as the character, not the subject.** Who the tutor is, how it encourages, how it
checks understanding, what it does when a child is stuck. Leave out the subject content — that is
what the curriculum is for, and a prompt full of facts is a prompt full of things that can be wrong.

> *"You are Max, a cheerful maths coach for children aged 8 and 9. Explain one small step at a
> time, use everyday objects as examples, and ask the child to try before you show the answer.
> Praise effort, not speed."*

Don't also tick a **grounding source** that points at the curriculum — the tutor would pay twice for
the same text.

## 3. What the tutor will do

- **Checks before it teaches.** Before a new topic, or a fact like "what Year 4 should know about
  fractions", it looks it up in the curriculum.
- **Stays at its level.** It only ever looks inside its key stages and subjects, and says so if a
  child asks about something else.
- **Says where it learned it.** It names the documents it used, with a link where there is one.
  Some documents may only be named, not quoted, because of their licence.
- **Admits when there is nothing.** If the curriculum has nothing on a question, it says so plainly
  instead of making something up.
- **Says when it cannot check.** If the curriculum is down, or the daily limit is reached, it tells
  the child it cannot check right now rather than guessing.

Tutors work in ordinary one-to-one chats. In rooms and bot teams they talk like any persona, without
the curriculum.

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

Looking something up costs the curriculum almost nothing. What costs your customer is the text the
tutor reads: each look-up adds up to about 750 tokens to that reply, billed like any other input. A
tutor only looks things up when it is about to teach something, not on every message, so a
"yes, I get it" costs the same as with any persona.
