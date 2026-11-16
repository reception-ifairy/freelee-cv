import { redirect } from 'next/navigation';
import { integrationsHref } from '@/lib/admin/connection-groups';

/**
 * Connections moved into Settings as Integrations (freelee #93; owner,
 * 2026-11-16: "integrations should live in Settings"). The redirect that
 * matters is in next.config.ts (HTTP, so `#conn-<id>` survives); this page is
 * the fallback if that rule is ever removed.
 */
export default function ConnectionsRedirect() {
  redirect(integrationsHref());
}
