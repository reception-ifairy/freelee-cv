/**
 * The homeschooling page lines that depend on tutors being live (owner
 * decision 2026-11-14: soften the page while no tutor is active). One source
 * for the first-version seed (seed-offering-pages.ts) and for updating the
 * existing page (update-homeschooling-copy.ts). When tutors open, change these
 * lines and run the update again.
 */
export const HOMESCHOOLING_COPY = {
  metaDescription:
    'A learning plan for your child built on the UK national curriculum, Year 1 to Year 11, with exam goals. AI tutors are in preparation; parents stay in charge and children’s data is encrypted.',
  heading: 'One plan that follows your child — tutors in preparation',
  body: [
    'Freelee builds **your child’s learning plan** from the **national curriculum for England**, from Year 1 to Year 11: the topics for their school year, in order, with the official learning objectives — and the exams they are working towards.',
    '',
    '**Tutors are in preparation.** They will open subject by subject. You can create your child’s profile, build the plan and set exam goals now.',
    '',
    '- **One plan for every tutor.** When tutors open, each works from your child’s plan, so switching subjects never means starting again.',
    '- **Talks at their age.** A six-year-old gets short sentences and simple choices; a fifteen-year-old gets exam technique.',
    '- **You stay in charge.** The account is yours. You read every lesson, see progress and can delete everything at any time.',
  ].join('\n'),
  ctaSubtitle: 'Create a parent account and set up your child’s plan now — tutors open subject by subject. No subscription.',
  whenFaq: {
    question: 'When can my child start lessons?',
    answer: 'Tutors are in preparation and will open subject by subject. You can create the profile, build the learning plan and set exam goals now; your child’s page shows each tutor as soon as it is ready.',
  },
};
