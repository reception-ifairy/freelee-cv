import { redirect } from 'next/navigation';
import { BROWSER_PATH } from '@/lib/taxonomy/browser';

/**
 * Drafts — every bot that is not live — is the taxonomy browser filtered to
 * "Not live" since freelee #90, with the tree, the card and its Publish
 * button. The Catalogue menu links straight there.
 */
export default function DraftsRedirect() {
  redirect(`${BROWSER_PATH}?status=draft`);
}
