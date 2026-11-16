import { Disclosure } from '@/components/ui/disclosure';

/**
 * A create form folded above a list in the browser layout (freelee #90–#91).
 * The form used to take a third of the screen beside the list on every visit;
 * folded, the list gets the width and the form is one click away. Open by
 * default when the list is empty, because then the form is the only thing to do.
 */
export function FormFold({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-card border hairline px-3">
      <Disclosure title={title} defaultOpen={defaultOpen}>
        <div className="max-w-xl">{children}</div>
      </Disclosure>
    </div>
  );
}
