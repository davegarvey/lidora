import { describe, expect, it } from 'vitest';
import { availableSettingsSections, hashId, isStatsPath, parseSettingsPath, SETTINGS_SECTIONS, settingsUrl } from '../src/routing';

describe('routing', () => {
  it('recognizes the stats route and trailing slash', () => {
    expect(isStatsPath('/stats')).toBe(true);
    expect(isStatsPath('/stats/')).toBe(true);
    expect(isStatsPath('/')).toBe(false);
  });

  it('keeps item hash parsing separate from the stats route', () => {
    expect(hashId('feed::item')).toMatch(/^[a-z0-9]+$/);
  });

  describe('settings routes', () => {
    const all = { sync: true, syncKey: true };
    const none = { sync: false, syncKey: false };

    it('parses every section', () => {
      for (const section of SETTINGS_SECTIONS) {
        expect(parseSettingsPath(`/settings/${section}`, all)).toEqual({ section });
        expect(parseSettingsPath(`/settings/${section}/`, all)).toEqual({ section });
      }
    });

    it('parses the section list', () => {
      expect(parseSettingsPath('/settings', all)).toEqual({ section: null });
      expect(parseSettingsPath('/settings/', all)).toEqual({ section: null });
    });

    it('falls back to the list for unknown sections', () => {
      expect(parseSettingsPath('/settings/unknown', all)).toEqual({ section: null });
      expect(parseSettingsPath('/settings/storage/extra', all)).toBeNull();
    });

    it('ignores other paths', () => {
      expect(parseSettingsPath('/', all)).toBeNull();
      expect(parseSettingsPath('/stats', all)).toBeNull();
      expect(parseSettingsPath('/settingsx', all)).toBeNull();
    });

    it('falls back to the list for sync-only sections when sync is unavailable', () => {
      for (const section of ['devices', 'agents', 'server-data']) {
        expect(parseSettingsPath(`/settings/${section}`, none)).toEqual({ section: null });
      }
      expect(parseSettingsPath('/settings/storage', none)).toEqual({ section: 'storage' });
    });

    it('requires a sync key for server data', () => {
      expect(parseSettingsPath('/settings/server-data', { sync: true, syncKey: false })).toEqual({ section: null });
      expect(parseSettingsPath('/settings/devices', { sync: true, syncKey: false })).toEqual({ section: 'devices' });
    });

    it('lists available sections in order', () => {
      expect(availableSettingsSections(all)).toEqual([...SETTINGS_SECTIONS]);
      expect(availableSettingsSections(none)).toEqual(['appearance', 'subscriptions', 'storage', 'about']);
    });

    it('builds URLs', () => {
      expect(settingsUrl(null)).toBe('/settings');
      expect(settingsUrl('server-data')).toBe('/settings/server-data');
    });
  });
});
