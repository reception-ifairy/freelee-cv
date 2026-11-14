import { redirect } from 'next/navigation';

/** Renamed to Drafts on 2026-11-14; old links and bookmarks land there. */
export default function PrototypesRedirect() {
  redirect('/admin/taxonomy/drafts');
}
