import { useApp } from '../state';
import type { ThemePreference } from '../db/types';
import { Section, SettingGroup } from './Section';
import { SegmentedControl, SettingRow, Switch } from './controls';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function AppearanceSection() {
  const ctx = useApp();
  return (
    <Section title="Appearance">
      <SettingGroup>
        <SettingRow label="Theme" description="System follows your device setting.">
          <SegmentedControl
            value={ctx.settings().theme}
            options={THEMES}
            onChange={(theme) => void ctx.saveSettingsPatch({ theme })}
          />
        </SettingRow>
        <SettingRow label="High contrast" description="Stronger text and borders for easier reading.">
          <Switch
            checked={ctx.settings().highContrast}
            onChange={(highContrast) => void ctx.saveSettingsPatch({ highContrast })}
          />
        </SettingRow>
      </SettingGroup>
    </Section>
  );
}
