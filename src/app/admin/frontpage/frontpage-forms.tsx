'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  updateHeroConfigAction, updateCtaConfigAction, updateHowItWorksConfigAction, updateCustomContentConfigAction,
} from '@/server/actions/admin-frontpage';
import type { ActionState } from '@/server/actions/auth';
import { Input, Textarea, Select, Label, FormMessage } from '@/components/ui/field';
import { STEP_ICON_KEYS } from '@/components/site/sections/types';
import type { HeroConfig, CtaConfig, HowItWorksConfig, CustomContentConfig } from '@/components/site/sections/types';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function HeroForm({ id, config }: { id: number; config: HeroConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateHeroConfigAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`titleLead-${id}`}>Title (lead)</Label>
          <Input id={`titleLead-${id}`} name="titleLead" defaultValue={config.titleLead} />
        </div>
        <div>
          <Label htmlFor={`titleAccent-${id}`}>Title (accent)</Label>
          <Input id={`titleAccent-${id}`} name="titleAccent" defaultValue={config.titleAccent} />
        </div>
      </div>
      <div>
        <Label htmlFor={`subtitle-${id}`}>Subtitle</Label>
        <Textarea id={`subtitle-${id}`} name="subtitle" defaultValue={config.subtitle} className="min-h-16" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`primaryLabel-${id}`}>Primary button</Label>
          <Input id={`primaryLabel-${id}`} name="primaryLabel" defaultValue={config.primaryLabel} />
        </div>
        <div>
          <Label htmlFor={`secondaryLabel-${id}`}>Secondary button</Label>
          <Input id={`secondaryLabel-${id}`} name="secondaryLabel" defaultValue={config.secondaryLabel} />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}

export function CtaForm({ id, config }: { id: number; config: CtaConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateCtaConfigAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div>
        <Label htmlFor={`title-${id}`}>Title</Label>
        <Input id={`title-${id}`} name="title" defaultValue={config.title} />
      </div>
      <div>
        <Label htmlFor={`subtitle-${id}`}>Subtitle</Label>
        <Textarea id={`subtitle-${id}`} name="subtitle" defaultValue={config.subtitle} className="min-h-16" />
        <p className="mt-1 text-xs text-slate-400">Use {'{credits}'} where the signup bonus amount should appear.</p>
      </div>
      <div>
        <Label htmlFor={`buttonLabel-${id}`}>Button label</Label>
        <Input id={`buttonLabel-${id}`} name="buttonLabel" defaultValue={config.buttonLabel} />
      </div>
      <SubmitButton />
    </form>
  );
}

export function HowItWorksForm({ id, config }: { id: number; config: HowItWorksConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateHowItWorksConfigAction, null);
  const steps = config.steps.length === 3 ? config.steps : [
    ...config.steps,
    ...Array.from({ length: Math.max(0, 3 - config.steps.length) }, () => ({ icon: 'users', title: '', body: '' })),
  ].slice(0, 3);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      {steps.map((step, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-[100px_1fr_1fr] dark:border-slate-800">
          <div>
            <Label htmlFor={`icon-${id}-${i}`}>Icon</Label>
            <Select id={`icon-${id}-${i}`} name="icon" defaultValue={step.icon}>
              {STEP_ICON_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`title-${id}-${i}`}>Title</Label>
            <Input id={`title-${id}-${i}`} name="title" defaultValue={step.title} />
          </div>
          <div>
            <Label htmlFor={`body-${id}-${i}`}>Body</Label>
            <Input id={`body-${id}-${i}`} name="body" defaultValue={step.body} />
          </div>
        </div>
      ))}
      <SubmitButton />
    </form>
  );
}

export function CustomContentForm({ id, config }: { id: number; config: CustomContentConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateCustomContentConfigAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div>
        <Label htmlFor={`heading-${id}`}>Heading</Label>
        <Input id={`heading-${id}`} name="heading" defaultValue={config.heading} />
      </div>
      <div>
        <Label htmlFor={`body-${id}`}>Body (Markdown)</Label>
        <Textarea id={`body-${id}`} name="body" defaultValue={config.body} className="min-h-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`imageUrl-${id}`}>Image URL (optional)</Label>
          <Input id={`imageUrl-${id}`} name="imageUrl" defaultValue={config.imageUrl ?? ''} placeholder="https://…" />
        </div>
        <div />
        <div>
          <Label htmlFor={`ctaLabel-${id}`}>CTA label (optional)</Label>
          <Input id={`ctaLabel-${id}`} name="ctaLabel" defaultValue={config.ctaLabel ?? ''} />
        </div>
        <div>
          <Label htmlFor={`ctaHref-${id}`}>CTA link (optional)</Label>
          <Input id={`ctaHref-${id}`} name="ctaHref" defaultValue={config.ctaHref ?? ''} placeholder="/register" />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
