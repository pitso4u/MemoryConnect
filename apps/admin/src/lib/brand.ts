import type { BrandProfile, BrandTemplate, FuneralHome } from '@memorialconnect/shared';

export const BRAND_TEMPLATES: Record<BrandTemplate, Pick<BrandProfile, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'backgroundColor' | 'textColor' | 'fontFamily' | 'buttonStyle' | 'cardStyle' | 'borderRadius' | 'memorialStyle' | 'animationLevel' | 'galleryLayout' | 'timelineStyle' | 'programmeStyle'>> = {
  classic: { primaryColor: '#1a1a2e', secondaryColor: '#f5f0e8', accentColor: '#c9a84c', backgroundColor: '#f5f0e8', textColor: '#1a1a2e', fontFamily: 'serif', buttonStyle: 'solid', cardStyle: 'rounded', borderRadius: '12px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'grid', timelineStyle: 'classic', programmeStyle: 'formal' },
  elegant: { primaryColor: '#263238', secondaryColor: '#f8f5ef', accentColor: '#b9965b', backgroundColor: '#f8f5ef', textColor: '#182024', fontFamily: 'elegant', buttonStyle: 'soft', cardStyle: 'shadow', borderRadius: '14px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'masonry', timelineStyle: 'editorial', programmeStyle: 'formal' },
  modern: { primaryColor: '#0f766e', secondaryColor: '#ecfeff', accentColor: '#f59e0b', backgroundColor: '#f8fafc', textColor: '#10201f', fontFamily: 'sans-serif', buttonStyle: 'pill', cardStyle: 'rounded', borderRadius: '16px', memorialStyle: 'rounded', animationLevel: 'expressive', galleryLayout: 'grid', timelineStyle: 'compact', programmeStyle: 'clean' },
  luxury: { primaryColor: '#111111', secondaryColor: '#f7f1e3', accentColor: '#d4af37', backgroundColor: '#fbf8f0', textColor: '#17120a', fontFamily: 'elegant', buttonStyle: 'solid', cardStyle: 'shadow', borderRadius: '10px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'editorial', timelineStyle: 'editorial', programmeStyle: 'formal' },
  gold: { primaryColor: '#6f4e00', secondaryColor: '#fff8dc', accentColor: '#e2b13c', backgroundColor: '#fffaf0', textColor: '#2d2412', fontFamily: 'serif', buttonStyle: 'soft', cardStyle: 'shadow', borderRadius: '12px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'grid', timelineStyle: 'classic', programmeStyle: 'formal' },
  dark: { primaryColor: '#101828', secondaryColor: '#1f2937', accentColor: '#fbbf24', backgroundColor: '#0b1120', textColor: '#f8fafc', fontFamily: 'sans-serif', buttonStyle: 'outline', cardStyle: 'glass', borderRadius: '14px', memorialStyle: 'glass', animationLevel: 'subtle', galleryLayout: 'masonry', timelineStyle: 'compact', programmeStyle: 'clean' },
  minimal: { primaryColor: '#111827', secondaryColor: '#ffffff', accentColor: '#64748b', backgroundColor: '#ffffff', textColor: '#111827', fontFamily: 'sans-serif', buttonStyle: 'outline', cardStyle: 'square', borderRadius: '4px', memorialStyle: 'square', animationLevel: 'none', galleryLayout: 'grid', timelineStyle: 'minimal', programmeStyle: 'clean' },
  'traditional-african': { primaryColor: '#3b2416', secondaryColor: '#fff7ed', accentColor: '#b45309', backgroundColor: '#fff7ed', textColor: '#2f1d12', fontFamily: 'traditional', buttonStyle: 'solid', cardStyle: 'shadow', borderRadius: '10px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'masonry', timelineStyle: 'story', programmeStyle: 'ceremonial' },
  church: { primaryColor: '#243c5a', secondaryColor: '#f8fafc', accentColor: '#b08d57', backgroundColor: '#f8fafc', textColor: '#172033', fontFamily: 'serif', buttonStyle: 'soft', cardStyle: 'rounded', borderRadius: '12px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'grid', timelineStyle: 'classic', programmeStyle: 'ceremonial' },
  corporate: { primaryColor: '#0f3d5e', secondaryColor: '#eef6fb', accentColor: '#22a6b3', backgroundColor: '#f6fbfd', textColor: '#0b2233', fontFamily: 'sans-serif', buttonStyle: 'solid', cardStyle: 'rounded', borderRadius: '8px', memorialStyle: 'rounded', animationLevel: 'none', galleryLayout: 'grid', timelineStyle: 'compact', programmeStyle: 'clean' },
};

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  companyName: 'Memory Connect',
  tradingName: null,
  logoUrl: null,
  iconUrl: null,
  companyEmail: null,
  companyPhone: null,
  whatsapp: null,
  physicalAddress: null,
  websiteUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  footerText: null,
  copyrightText: null,
  whiteLabelEnabled: false,
  themeTemplate: 'classic',
  homeBackgroundUrl: null,
  loginBackgroundUrl: null,
  memorialHeroUrl: null,
  projectorBackgroundUrl: null,
  pdfWatermarkUrl: null,
  splashScreenUrl: null,
  ...BRAND_TEMPLATES.classic,
};

export function brandCssVariables(brand: BrandProfile): Record<string, string> {
  return {
    '--brand-primary': brand.primaryColor,
    '--brand-secondary': brand.secondaryColor,
    '--brand-accent': brand.accentColor,
    '--brand-background': brand.backgroundColor,
    '--brand-text': brand.textColor,
    '--brand-radius': brand.borderRadius,
    '--brand-font': brand.fontFamily === 'serif' ? 'Georgia, serif' : brand.fontFamily === 'elegant' ? 'Cormorant Garamond, Georgia, serif' : brand.fontFamily === 'traditional' ? 'Trebuchet MS, Georgia, serif' : brand.fontFamily === 'large-print' ? 'Atkinson Hyperlegible, Verdana, sans-serif' : 'Source Sans 3, system-ui, sans-serif',
  };
}

export function brandFromFuneralHome(home: Partial<FuneralHome> & Record<string, unknown>): BrandProfile {
  const template = (home.themeTemplate as BrandTemplate) || 'classic';
  const defaults = BRAND_TEMPLATES[template] || BRAND_TEMPLATES.classic;
  return {
    ...DEFAULT_BRAND_PROFILE,
    ...defaults,
    companyName: String(home.name || DEFAULT_BRAND_PROFILE.companyName),
    tradingName: (home.tradingName as string | null | undefined) || null,
    logoUrl: (home.logoUrl as string | null | undefined) || null,
    iconUrl: (home.iconUrl as string | null | undefined) || null,
    primaryColor: (home.primaryColor as string | null | undefined) || defaults.primaryColor,
    secondaryColor: (home.secondaryColor as string | null | undefined) || defaults.secondaryColor,
    accentColor: (home.accentColor as string | null | undefined) || defaults.accentColor,
    backgroundColor: (home.backgroundColor as string | null | undefined) || defaults.backgroundColor,
    textColor: (home.textColor as string | null | undefined) || defaults.textColor,
    fontFamily: (home.fontFamily as string | null | undefined) || defaults.fontFamily,
    buttonStyle: (home.buttonStyle as string | null | undefined) || defaults.buttonStyle,
    cardStyle: (home.cardStyle as string | null | undefined) || defaults.cardStyle,
    borderRadius: (home.borderRadius as string | null | undefined) || defaults.borderRadius,
    companyEmail: (home.email as string | null | undefined) || null,
    companyPhone: (home.phone as string | null | undefined) || null,
    whatsapp: (home.whatsapp as string | null | undefined) || null,
    physicalAddress: (home.address as string | null | undefined) || null,
    websiteUrl: (home.websiteUrl as string | null | undefined) || null,
    facebookUrl: (home.facebookUrl as string | null | undefined) || null,
    instagramUrl: (home.instagramUrl as string | null | undefined) || null,
    tiktokUrl: (home.tiktokUrl as string | null | undefined) || null,
    footerText: (home.footerText as string | null | undefined) || null,
    copyrightText: (home.copyrightText as string | null | undefined) || null,
    whiteLabelEnabled: Boolean(home.whiteLabelEnabled),
    themeTemplate: template,
    homeBackgroundUrl: (home.homeBackgroundUrl as string | null | undefined) || null,
    loginBackgroundUrl: (home.loginBackgroundUrl as string | null | undefined) || null,
    memorialHeroUrl: (home.memorialHeroUrl as string | null | undefined) || null,
    projectorBackgroundUrl: (home.projectorBackgroundUrl as string | null | undefined) || null,
    pdfWatermarkUrl: (home.pdfWatermarkUrl as string | null | undefined) || null,
    splashScreenUrl: (home.splashScreenUrl as string | null | undefined) || null,
    memorialStyle: (home.memorialStyle as string | null | undefined) || defaults.memorialStyle,
    animationLevel: (home.animationLevel as string | null | undefined) || defaults.animationLevel,
    galleryLayout: (home.galleryLayout as string | null | undefined) || defaults.galleryLayout,
    timelineStyle: (home.timelineStyle as string | null | undefined) || defaults.timelineStyle,
    programmeStyle: (home.programmeStyle as string | null | undefined) || defaults.programmeStyle,
  };
}
