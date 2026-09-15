import { describe, expect, it } from 'vitest';

import { cardPath, clusterPath, domainPath } from './routes';

describe('routes', () => {
  it('nests domains and clusters under the cloud', () => {
    expect(domainPath('personal')).toBe('/cloud/personal');
    expect(clusterPath('personal', 'house')).toBe('/cloud/personal/house');
    expect(clusterPath('personal', 'house', 'memory')).toBe('/cloud/personal/house/memory');
    expect(cardPath('personal', 'house', 'c123')).toBe('/cloud/personal/house/cards?node=c123');
  });
});
