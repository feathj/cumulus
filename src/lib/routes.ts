/**
 * Every in-app path, in one place, so pages can move without links breaking.
 * Slugs and ids are already URL-safe, so nothing here needs encoding.
 */

export type ClusterView = 'cloud' | 'cards' | 'memory';

export const todayPath = '/today';
export const inboxPath = '/inbox';
export const cloudPath = '/cloud';

export function domainPath(domainSlug: string): string {
  return `${cloudPath}/${domainSlug}`;
}

export function clusterPath(domainSlug: string, clusterSlug: string, view: ClusterView = 'cloud'): string {
  const base = `${domainPath(domainSlug)}/${clusterSlug}`;
  return view === 'cloud' ? base : `${base}/${view}`;
}

/** A card, opened in its cluster's board. */
export function cardPath(domainSlug: string, clusterSlug: string, nodeId: string): string {
  return `${clusterPath(domainSlug, clusterSlug, 'cards')}?node=${nodeId}`;
}
