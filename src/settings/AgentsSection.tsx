import { Show, createSignal } from 'solid-js';
import { useApp } from '../state';
import { isSyncAvailable } from '../sync/capabilities';
import { Section, SettingGroup } from './Section';
import { SettingRow } from './controls';

export function AgentsSection() {
  const ctx = useApp();
  const [available, setAvailable] = createSignal<boolean | null>(null);
  void isSyncAvailable().then(setAvailable);
  return (
    <Section title="Agents">
      <Show when={available()}>
        <SettingGroup>
          <SettingRow label="Agent access" description="Let an AI assistant read and manage your feeds through MCP.">
            <button type="button" class="btn" onClick={() => ctx.openModal({ kind: 'agents' })}>Manage</button>
          </SettingRow>
        </SettingGroup>
      </Show>
    </Section>
  );
}
