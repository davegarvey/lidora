import { useApp } from '../state';
import type { ThemePreference } from '../db/types';
import { Section, SettingGroup } from './Section';
import { InlineMessage, SegmentedControl, SettingRow, Switch } from './controls';
import { createSignal } from 'solid-js';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function AppearanceSection() {
  const ctx = useApp();
  const [preferenceError, setPreferenceError] = createSignal(false);
  const [preferenceSaving, setPreferenceSaving] = createSignal(false);
  const saveAutomaticPreference = async (enabled: boolean) => {
    const previous = ctx.settings().automaticallyShowNewArticles ?? false;
    setPreferenceError(false);
    setPreferenceSaving(true);
    try {
      await ctx.saveSettingsPatch({ automaticallyShowNewArticles: enabled });
    } catch {
      if (ctx.settings().automaticallyShowNewArticles !== previous) await ctx.saveSettingsPatch({ automaticallyShowNewArticles: previous }).catch(() => undefined);
      setPreferenceError(true);
    } finally {
      setPreferenceSaving(false);
    }
  };
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
        <SettingRow label="Automatically show new articles" description="Add articles to the list as they arrive. This may move articles you’re browsing.">
          <Switch
            checked={ctx.settings().automaticallyShowNewArticles ?? false}
            disabled={preferenceSaving()}
            onChange={(automaticallyShowNewArticles) => void saveAutomaticPreference(automaticallyShowNewArticles)}
          />
        </SettingRow>
        {preferenceError() && <InlineMessage kind="error">Could not save this preference. Check storage and try again.</InlineMessage>}
      </SettingGroup>
    </Section>
  );
}
