import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { BrandProfile, BrandTemplate } from '@memorialconnect/shared';
import { BRAND_TEMPLATES, brandCssVariables, brandFromFuneralHome } from '../lib/brand';
import { Building2, Check, Eye, FileText, Monitor, Palette, Smartphone, Wand2 } from 'lucide-react';
import { api, FuneralHomeProfile, photoUrl } from '../lib/api';
import { useBrand } from '../context/BrandContext';

const templateLabels: Record<BrandTemplate, string> = {
  classic: 'Classic',
  elegant: 'Elegant',
  modern: 'Modern',
  luxury: 'Luxury',
  gold: 'Gold',
  dark: 'Dark',
  minimal: 'Minimal',
  'traditional-african': 'Traditional African',
  church: 'Church',
  corporate: 'Corporate',
};

type PreviewMode = 'desktop' | 'mobile' | 'public' | 'admin' | 'pdf';

function brandToProfile(profile: FuneralHomeProfile, brand: BrandProfile): FuneralHomeProfile {
  return {
    ...profile,
    name: brand.companyName,
    tradingName: brand.tradingName,
    email: brand.companyEmail || profile.email,
    phone: brand.companyPhone,
    address: brand.physicalAddress,
    logoUrl: brand.logoUrl,
    iconUrl: brand.iconUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    accentColor: brand.accentColor,
    backgroundColor: brand.backgroundColor,
    textColor: brand.textColor,
    fontFamily: brand.fontFamily,
    buttonStyle: brand.buttonStyle,
    cardStyle: brand.cardStyle,
    borderRadius: brand.borderRadius,
    whatsapp: brand.whatsapp,
    websiteUrl: brand.websiteUrl,
    facebookUrl: brand.facebookUrl,
    instagramUrl: brand.instagramUrl,
    tiktokUrl: brand.tiktokUrl,
    footerText: brand.footerText,
    copyrightText: brand.copyrightText,
    whiteLabelEnabled: brand.whiteLabelEnabled,
    themeTemplate: brand.themeTemplate,
    homeBackgroundUrl: brand.homeBackgroundUrl,
    loginBackgroundUrl: brand.loginBackgroundUrl,
    memorialHeroUrl: brand.memorialHeroUrl,
    projectorBackgroundUrl: brand.projectorBackgroundUrl,
    pdfWatermarkUrl: brand.pdfWatermarkUrl,
    splashScreenUrl: brand.splashScreenUrl,
    memorialStyle: brand.memorialStyle,
    animationLevel: brand.animationLevel,
    galleryLayout: brand.galleryLayout,
    timelineStyle: brand.timelineStyle,
    programmeStyle: brand.programmeStyle,
    brand,
  };
}

export default function ProfilePage() {
  const { setPreviewBrand, refreshBrand } = useBrand();
  const [profile, setProfile] = useState<FuneralHomeProfile | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [message, setMessage] = useState('');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');

  useEffect(() => {
    api.getFuneralHomeProfile().then((data) => {
      setProfile(data);
      const loadedBrand = data.brand || brandFromFuneralHome(data as unknown as Record<string, unknown>);
      setBrand(loadedBrand);
      setPreviewBrand(loadedBrand);
    });
  }, []);

  const updateBrand = (patch: Partial<BrandProfile>) => {
    setBrand((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      setPreviewBrand(next);
      setMessage('');
      return next;
    });
  };

  const applyTemplate = (template: BrandTemplate) => {
    updateBrand({ ...BRAND_TEMPLATES[template], themeTemplate: template });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || !brand) return;
    const updated = await api.updateFuneralHomeProfile(brandToProfile(profile, brand));
    setProfile(updated);
    const nextBrand = updated.brand || brandFromFuneralHome(updated as unknown as Record<string, unknown>);
    setBrand(nextBrand);
    setPreviewBrand(nextBrand);
    await refreshBrand();
    setMessage('Brand profile saved');
  };

  const previewStyle = useMemo(() => brand ? brandCssVariables(brand) as React.CSSProperties : undefined, [brand]);

  if (!profile || !brand) return <div className="p-8 text-muted">Loading brand profile...</div>;

  const textField = (key: keyof BrandProfile, label: string, placeholder = '', type = 'text') => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={String(brand[key] || '')}
        placeholder={placeholder}
        onChange={(event) => updateBrand({ [key]: event.target.value } as Partial<BrandProfile>)}
        className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
      />
    </label>
  );

  const selectField = (key: keyof BrandProfile, label: string, values: string[]) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <select
        value={String(brand[key] || '')}
        onChange={(event) => updateBrand({ [key]: event.target.value } as Partial<BrandProfile>)}
        className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
      >
        {values.map((value) => <option key={value} value={value}>{value.replace(/-/g, ' ')}</option>)}
      </select>
    </label>
  );

  const colorField = (key: keyof BrandProfile, label: string) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-2 py-2">
        <input type="color" value={String(brand[key])} onChange={(event) => updateBrand({ [key]: event.target.value } as Partial<BrandProfile>)} className="h-8 w-10 border-0 bg-transparent" />
        <input value={String(brand[key])} onChange={(event) => updateBrand({ [key]: event.target.value } as Partial<BrandProfile>)} className="min-w-0 flex-1 text-sm outline-none" />
      </div>
    </label>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <form onSubmit={save} className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Brand engine</p>
          <h1 className="mt-3 font-display text-4xl text-ink">Brand Studio</h1>
          <p className="mt-2 max-w-3xl text-muted">This profile drives admin, family, public memorial, projector, payment, email, PDF, and future mobile surfaces.</p>

          <section className="mt-8 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><Wand2 size={20} /> Theme templates</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(BRAND_TEMPLATES) as BrandTemplate[]).map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className={`rounded-lg border p-3 text-left text-sm transition ${brand.themeTemplate === template ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-ink' : 'border-parchment-dark hover:border-[var(--brand-accent)]'}`}
                >
                  <span className="font-semibold">{templateLabels[template]}</span>
                  <span className="mt-2 flex gap-1">
                    {['primaryColor', 'secondaryColor', 'accentColor'].map((field) => <i key={field} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: BRAND_TEMPLATES[template][field as 'primaryColor'] }} />)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><Building2 size={20} /> Identity & contact</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {textField('companyName', 'Company name')}
              {textField('tradingName', 'Trading name')}
              {textField('companyEmail', 'Company email', 'care@example.co.za', 'email')}
              {textField('companyPhone', 'Company phone')}
              {textField('whatsapp', 'WhatsApp')}
              {textField('physicalAddress', 'Physical address')}
              {textField('websiteUrl', 'Website', 'https://', 'url')}
              {textField('facebookUrl', 'Facebook', 'https://', 'url')}
              {textField('instagramUrl', 'Instagram', 'https://', 'url')}
              {textField('tiktokUrl', 'TikTok', 'https://', 'url')}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><Palette size={20} /> Colours, typography & style</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colorField('primaryColor', 'Primary colour')}
              {colorField('secondaryColor', 'Secondary colour')}
              {colorField('accentColor', 'Accent colour')}
              {colorField('backgroundColor', 'Background colour')}
              {colorField('textColor', 'Text colour')}
              {textField('borderRadius', 'Border radius', '12px')}
              {selectField('fontFamily', 'Font family', ['serif', 'sans-serif', 'traditional', 'elegant', 'large-print'])}
              {selectField('buttonStyle', 'Button style', ['solid', 'outline', 'soft', 'pill'])}
              {selectField('cardStyle', 'Card style', ['square', 'rounded', 'glass', 'shadow'])}
              {selectField('animationLevel', 'Animation level', ['none', 'subtle', 'expressive'])}
              {selectField('galleryLayout', 'Gallery layout', ['grid', 'masonry', 'editorial'])}
              {selectField('programmeStyle', 'Programme style', ['formal', 'clean', 'ceremonial'])}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><FileText size={20} /> Logos, backgrounds & white label</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {textField('logoUrl', 'Logo URL', 'https://', 'url')}
              {textField('iconUrl', 'Icon / favicon URL', 'https://', 'url')}
              {textField('homeBackgroundUrl', 'Home background URL', 'https://', 'url')}
              {textField('loginBackgroundUrl', 'Login background URL', 'https://', 'url')}
              {textField('memorialHeroUrl', 'Memorial hero image URL', 'https://', 'url')}
              {textField('projectorBackgroundUrl', 'Projector background URL', 'https://', 'url')}
              {textField('pdfWatermarkUrl', 'PDF watermark URL', 'https://', 'url')}
              {textField('splashScreenUrl', 'Splash screen URL', 'https://', 'url')}
              {textField('footerText', 'Footer text')}
              {textField('copyrightText', 'Copyright text')}
            </div>
            <label className="mt-5 flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={brand.whiteLabelEnabled} onChange={(event) => updateBrand({ whiteLabelEnabled: event.target.checked })} />
              Enable white label mode
            </label>
          </section>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="brand-button px-5 py-3 text-sm font-semibold">Save brand profile</button>
            {message && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><Check size={15} />{message}</span>}
          </div>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-lg border border-parchment-dark bg-white p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                ['desktop', Monitor],
                ['mobile', Smartphone],
                ['public', Eye],
                ['admin', Building2],
                ['pdf', FileText],
              ] as const).map(([mode, Icon]) => (
                <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={`grid h-10 w-10 place-items-center rounded-lg border ${previewMode === mode ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)]/10' : 'border-parchment-dark'}`} title={`${mode} preview`}>
                  <Icon size={17} />
                </button>
              ))}
            </div>
            <BrandPreview brand={brand} mode={previewMode} style={previewStyle} />
          </div>
        </aside>
      </form>
    </div>
  );
}

function BrandPreview({ brand, mode, style }: { brand: BrandProfile; mode: PreviewMode; style?: React.CSSProperties }) {
  const logo = brand.logoUrl ? <img src={photoUrl(brand.logoUrl)} alt="" className="h-10 max-w-36 object-contain" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand-primary)] text-sm font-bold text-[var(--brand-secondary)]">{brand.companyName.slice(0, 1)}</div>;
  const phone = brand.whatsapp || brand.companyPhone || 'Contact number';

  return (
    <div className={`${mode === 'mobile' ? 'mx-auto max-w-[18rem]' : ''}`} style={style}>
      <div className="overflow-hidden border border-black/10 bg-[var(--brand-background)] text-[var(--brand-text)]" style={{ borderRadius: 'var(--brand-radius)', fontFamily: 'var(--brand-font)' }}>
        {(brand.memorialHeroUrl || brand.loginBackgroundUrl) && (
          <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${brand.memorialHeroUrl || brand.loginBackgroundUrl})` }} />
        )}
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            {logo}
            <span className="rounded-full bg-[var(--brand-accent)] px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">{mode.toUpperCase()}</span>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--brand-accent)' }}>Presented by</p>
          <h3 className="mt-2 font-display text-3xl leading-none">{brand.tradingName || brand.companyName}</h3>
          <p className="mt-3 text-sm opacity-75">{brand.footerText || 'Dignified digital memorials, family updates and service programmes.'}</p>
          <div className="mt-5 rounded-lg border border-current/10 bg-white/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] opacity-60">{mode === 'pdf' ? 'Programme PDF' : mode === 'admin' ? 'Admin Portal' : 'Public Memorial'}</p>
            <p className="mt-2 text-lg font-semibold">Nomvula Dlamini</p>
            <p className="text-sm opacity-70">Service programme · gallery · tributes</p>
          </div>
          <button type="button" className="mt-5 w-full px-4 py-3 text-sm font-semibold" style={{ borderRadius: 'var(--brand-radius)', background: 'var(--brand-primary)', color: 'var(--brand-secondary)' }}>
            {mode === 'pdf' ? 'Download programme' : 'Open memorial'}
          </button>
          <div className="mt-5 flex flex-wrap gap-2 text-xs opacity-70">
            <span>{phone}</span>
            {brand.websiteUrl && <span>{brand.websiteUrl.replace(/^https?:\/\//, '')}</span>}
          </div>
          <p className="mt-5 border-t border-current/10 pt-3 text-center text-[11px] opacity-55">
            {brand.whiteLabelEnabled ? 'Powered by Memory Connect' : `${brand.companyName} · Powered by Memory Connect`}
          </p>
        </div>
      </div>
    </div>
  );
}
