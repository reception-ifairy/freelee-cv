'use client';

import { useTransition } from 'react';

/**
 * Calls a server action from a menu item instead of a `<form>`.
 *
 * The admin list pages used to wrap every icon button in its own tiny form
 * purely to submit a hidden id. Now that the actions live inside a `⋯` menu
 * there is no form to submit, so they are invoked directly — server actions are
 * callable from client components, and `startTransition` keeps the surrounding
 * UI responsive while the revalidation lands.
 */
export function useAdminAction() {
  const [pending, startTransition] = useTransition();

  function run(action: (formData: FormData) => Promise<unknown>, fields: Record<string, string | number | boolean>) {
    startTransition(async () => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) formData.set(key, String(value));
      await action(formData);
    });
  }

  return { run, pending };
}
