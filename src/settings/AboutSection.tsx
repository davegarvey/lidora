import { ChevronRight, ExternalLink } from 'lucide-solid';
import { version } from '../../package.json';
import { useApp } from '../state';
import { Section, SettingGroup } from './Section';
import { SettingRow } from './controls';

export function AboutSection() {
  const ctx = useApp();
  return (
    <Section title="About">
      <SettingGroup>
        <SettingRow label="Version">
          <span class="setting-value">v{version}</span>
        </SettingRow>
        <SettingRow label="Source code" description="Lidora is open source.">
          <a
            class="setting-link"
            href="https://github.com/davegarvey/lidora"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub <ExternalLink size={14} />
          </a>
        </SettingRow>
        <SettingRow label="Keyboard shortcuts" description="See the keys that work in the river and the reader.">
          <button type="button" class="btn" onClick={() => ctx.openModal({ kind: 'shortcuts' })}>
            Show shortcuts
          </button>
        </SettingRow>
      </SettingGroup>
      <nav class="settings-links" aria-label="About Lidora">
        <a href="/about">About <ChevronRight size={14} /></a>
        <a href="/privacy">Privacy <ChevronRight size={14} /></a>
        <a href="/terms">Terms <ChevronRight size={14} /></a>
      </nav>
    </Section>
  );
}
