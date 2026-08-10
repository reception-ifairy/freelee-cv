import { redirect } from 'next/navigation';

/**
 * Moved into Settings.
 *
 * The model catalog is configuration in the same sense as the API keys beside
 * it, and keeping them on separate screens meant setting up a provider took two
 * pages that never referred to each other. Kept as a redirect so existing
 * links, bookmarks and the handbook still land in the right place.
 */
export default function AiModelsRedirect() {
  redirect('/admin/settings?section=models');
}
