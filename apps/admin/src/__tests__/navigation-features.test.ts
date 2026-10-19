import { describe, expect, it } from 'vitest';
import { filterVisibleNavigation, funeralHomeNavigation, NavItem } from '../lib/navigation';

type SectionItem = Extract<NavItem, { type: 'section' }>;

function findMarketingSection(items: NavItem[]): SectionItem | undefined {
  return items.find((item): item is SectionItem => item.type === 'section' && item.label === 'Marketing');
}

function marketingLinks(hasFeature: (key: string) => boolean): string[] {
  const filtered = filterVisibleNavigation(funeralHomeNavigation, hasFeature);
  const section = findMarketingSection(filtered);
  if (!section) return [];
  return section.items.map((item) => item.label);
}

describe('navigation feature visibility', () => {
  it('shows only Digital Brochures & Categories when BROCHURES is on and PROMOTIONS is off', () => {
    const links = marketingLinks((key) => key === 'BROCHURES');
    expect(links).toEqual(['Digital Brochures', 'Categories']);
  });

  it('shows Promotion when PROMOTIONS is on and BROCHURES is off', () => {
    const links = marketingLinks((key) => key === 'PROMOTIONS');
    expect(links).toEqual(['Promotions']);
  });

  it('shows all marketing children when both features are on', () => {
    const links = marketingLinks((key) => key === 'BROCHURES' || key === 'PROMOTIONS');
    expect(links).toEqual(['Digital Brochures', 'Categories', 'Promotions']);
  });

  it('hides the Marketing section entirely when no feature is enabled', () => {
    const filtered = filterVisibleNavigation(funeralHomeNavigation, () => false);
    expect(findMarketingSection(filtered)).toBeUndefined();
  });
});