# Child profiles and privacy

freelee is for **adults**. A parent or guardian creates the account, and each child learns through a
**profile** under that account. A child never has a login of their own.

## Signing up

1. **Two boxes at sign-up.** "I am 18 or over …" and the terms. Both are required.
2. **Confirm the email.** We send a link to confirm the address. A profile for a child can be created
   only after that.

   Until an email service is connected (**Admin → Settings → Email**, Resend key and sender
   address), the confirmation email is not actually sent. It is written to the server log instead,
   so ask Claude for the link if needed.

## Adding a child

Account menu → **Children** → **Add your child**. Every field shows three things: **why we ask**,
**where it goes** and **how long we keep it**.

| Field | Note |
|---|---|
| Nickname | Required. Not the child's real name. |
| School year | Required. |
| Subjects | Required: at least one. |
| GCSE details | From Year 9. "Not sure" is fine. |
| Focus | Optional. |
| Interests | Optional. |
| Adaptations | Optional. Practical things like "one instruction at a time"; we never ask for a diagnosis. |
| PSHE topics | Optional, off by default. Tutors never teach relationships and sex education. |

**We never ask for** a real name, date of birth, school, address, photos, location or health
details.

The first save needs one more tick: "I am this child's parent or guardian …".

## Where the information goes

- **The curriculum service** receives only the school year, the subjects and the GCSE settings. It
  never learns who they are for.
- **The AI tutor** sees the nickname, interests, focus and adaptations during a lesson.

## How it is protected

- Everything about a child is **encrypted on our own server** before it is saved.
- Each child has their own key. Those keys are locked with a master key that sits in a protected file
  on the server, outside the database.
- Someone who copied the database would see only scrambled data.

**Keep the offline copy of the master key safe** (Claude showed you where it is). Without it, nobody
can read the children's data, including us.

## Changing or deleting

Open the child on the Children page (**Edit profile**) to change anything.

**Delete profile** removes the profile, the learning plan and the chats at once. The child's key is
deleted with them, so nothing can be read back.

## The learning plan

When you save a profile, freelee builds your child's **learning plan** from the UK curriculum:
- the topics for their school year, in order, for each subject;
- how a tutor should talk to a child of that age.

Only the school year and subjects are sent to the curriculum.

Every tutor your child talks to uses the **same plan**, so changing tutor never means starting
again. The Children page shows what each subject is on now. **Refresh plan** picks up curriculum
updates and keeps your child's progress.

## Lessons: handing the device to your child

1. On the Children page, click **Start learning as <nickname>**.
2. Your child sees their tutors and what they are learning now, with a note that you can read the
   chats and that tutors are AI, not people.
3. While child mode is on, the rest of your account is hidden: billing, settings and other bots.
4. To leave, click **Grown-ups: leave** and enter your password.

Lessons are encrypted with your child's key, never shared, and deleted together with the profile.

## Coming next

- Reading full lesson transcripts from the Children page.
- Export of everything about a child.
- Automatic clean-up of old lessons.

Engineering details: `docs/54-children-data.md`.
