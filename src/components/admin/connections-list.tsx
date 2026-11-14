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
 * One card per connection. The actions are bound to the connection id here,
 * on the server, so the card itself knows nothing about which service it is
 * talking to. Each card carries an anchor (`#conn-<id>`), so a link from
 * elsewhere — the homeschool hub, a hint in the persona form — lands on it.
 */
export function ConnectionsList({ ids, settings }: { ids: readonly ConnectionId[]; settings: Map<string, SettingValue> }) {
  return (
    <div className="space-y-4">
      {ids.map((id) => {
        const { canFetch, canChoose, ...view } = connectionView(id, settings);
        return (
          <div key={id} id={`conn-${id}`} className="scroll-mt-24">
            <ConnectionCard
              {...view}
              save={view.envOnly ? undefined : saveConnectionAction.bind(null, id)}
              test={testConnectionAction.bind(null, id)}
              fetch={canFetch ? fetchConnectionAction.bind(null, id) : undefined}
              choose={canChoose ? chooseConnectionItemAction.bind(null, id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
