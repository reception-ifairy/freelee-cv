import { ConnectionCard } from '@/components/admin/connection-card';
import { connectionView, type ConnectionId } from '@/lib/connections/registry';
import type { SettingValue } from '@/lib/settings';
import {
  chooseConnectionItemAction,
  fetchConnectionAction,
  saveConnectionAction,
  testConnectionAction,
} from '@/server/actions/admin-connections';

/**
 * One connection's card (Save → Test → Fetch). The actions are bound to the
 * connection id here, on the server, so the card itself knows nothing about
 * which service it is talking to. Since freelee #93 it is the body of the
 * connection's sheet in Settings → Integrations.
 */
export function ConnectionCardFor({ id, settings }: { id: ConnectionId; settings: Map<string, SettingValue> }) {
  const { canFetch, canChoose, ...view } = connectionView(id, settings);
  return (
    <ConnectionCard
      {...view}
      save={view.envOnly ? undefined : saveConnectionAction.bind(null, id)}
      test={testConnectionAction.bind(null, id)}
      fetch={canFetch ? fetchConnectionAction.bind(null, id) : undefined}
      choose={canChoose ? chooseConnectionItemAction.bind(null, id) : undefined}
    />
  );
}
