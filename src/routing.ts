export function hashId(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function itemUrl(item: { id: string; title?: string }): string {
  const h = hashId(item.id);
  const slug = item.title ? slugify(item.title) : '';
  return slug ? `/i/${h}/${slug}` : `/i/${h}`;
}

export function writeItemHistory(item: { id: string; title?: string }, replace = false): void {
  const entry = { itemId: item.id };
  const url = itemUrl(item);
  if (replace) history.replaceState(entry, '', url);
  else history.pushState(entry, '', url);
}

export function itemIdFromHistoryState(state: unknown, hash: string): string | null {
  if (typeof state !== 'object' || state === null || !('itemId' in state)) return null;
  const itemId = (state as { itemId?: unknown }).itemId;
  return typeof itemId === 'string' && hashId(itemId) === hash ? itemId : null;
}

export function parseItemIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/i\/([a-z0-9]+)/);
  return match?.[1] ?? null;
}

export function isStatsPath(pathname: string): boolean {
  return pathname === '/stats' || pathname === '/stats/';
}

export const SETTINGS_SECTIONS = ['appearance', 'subscriptions', 'devices', 'agents', 'storage', 'server-data', 'about'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export interface SettingsAvailability {
  sync: boolean;
  syncKey: boolean;
}

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function settingsSectionAvailable(section: SettingsSection, availability: SettingsAvailability): boolean {
  if (section === 'devices' || section === 'agents') return availability.sync;
  if (section === 'server-data') return availability.sync && availability.syncKey;
  return true;
}

export function availableSettingsSections(availability: SettingsAvailability): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => settingsSectionAvailable(section, availability));
}

export interface SettingsRoute {
  section: SettingsSection | null;
}

export function parseSettingsPath(pathname: string, availability: SettingsAvailability): SettingsRoute | null {
  const match = /^\/settings(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!match) return null;
  const segment = match[1];
  if (segment === undefined || !isSettingsSection(segment)) return { section: null };
  return { section: settingsSectionAvailable(segment, availability) ? segment : null };
}

export function settingsUrl(section: SettingsSection | null): string {
  return section ? `/settings/${section}` : '/settings';
}
