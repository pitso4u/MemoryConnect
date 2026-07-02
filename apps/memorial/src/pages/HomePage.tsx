import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  Check,
  CircleDollarSign,
  Clock3,
  GalleryHorizontalEnd,
  Heart,
  MapPinned,
  MessageCircleHeart,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

const steps = [
  ['Create a memorial page', 'Start with the service details and the name of the person being remembered.'],
  ['Add the funeral programme', 'Keep every guest informed, from the opening hymn to the final tribute.'],
  ['Share their story', 'Add a biography and a thoughtful collection of photographs.'],
  ['Generate the QR code', 'Place it on printed programmes, venue screens, or funeral notices.'],
  ['Share one simple link', 'Family and guests can open everything instantly on any phone.'],
  ['Publish when ready', 'Pay once to make the memorial public for 30 days.'],
];

const features = [
  { icon: BookOpenText, label: 'Programme' },
  { icon: Heart, label: 'Biography' },
  { icon: GalleryHorizontalEnd, label: 'Gallery' },
  { icon: MapPinned, label: 'Directions' },
  { icon: MessageCircleHeart, label: 'Tributes' },
];

function getAdminUrl(path: string) {
  const configuredUrl = import.meta.env.VITE_ADMIN_URL;
  if (configuredUrl) return `${configuredUrl.replace(/\/$/, '')}${path}`;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5173${path}`;
  }
  return `http://localhost:5173${path}`;
}

export default function HomePage() {
  const registerUrl = getAdminUrl('/register');
  const loginUrl = getAdminUrl('/login');

  return (
    <div className="marketing-page min-h-screen bg-parchment text-ink">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12" aria-label="Main navigation">
          <a href="#top" className="font-display text-2xl font-semibold tracking-tight text-parchment">
            Memory Connect
          </a>
          <div className="hidden items-center gap-8 text-sm text-parchment/70 md:flex">
            <a href="#how-it-works" className="transition hover:text-parchment">How it works</a>
            <a href="#pricing" className="transition hover:text-parchment">Pricing</a>
            <a href={loginUrl} className="transition hover:text-parchment">Sign in</a>
          </div>
          <a
            href={registerUrl}
            className="rounded-full border border-parchment/30 px-4 py-2 text-sm font-medium text-parchment transition hover:border-gold hover:bg-gold hover:text-ink"
          >
            For funeral homes
          </a>
        </nav>
      </header>

      <main>
        <section id="top" className="relative min-h-[860px] overflow-hidden bg-ink text-parchment">
          <div className="hero-glow absolute inset-0" />
          <div className="hero-grain absolute inset-0 opacity-40" />
          <div className="relative mx-auto grid min-h-[860px] max-w-7xl items-center gap-16 px-5 pb-20 pt-36 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:pt-32">
            <div className="max-w-3xl">
              <p className="animate-fade-up mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-gold-light">
                <span className="h-px w-10 bg-gold" />
                Made for South African funeral homes
              </p>
              <h1 className="animate-fade-up animate-fade-up-delay-1 font-display text-[clamp(4.4rem,10vw,8.8rem)] font-semibold leading-[0.78] tracking-[-0.055em]">
                Memory
                <span className="block pl-[0.42em] text-gold-light">Connect</span>
              </h1>
              <p className="animate-fade-up animate-fade-up-delay-2 mt-10 max-w-2xl font-display text-2xl leading-snug text-parchment/90 sm:text-3xl">
                Memory Connect helps funeral homes create beautiful digital funeral programmes and memorial pages.
              </p>
              <p className="animate-fade-up animate-fade-up-delay-2 mt-5 max-w-xl text-base leading-7 text-parchment/60 sm:text-lg">
                Create the programme, add photos, directions, obituary and QR code. Pay only when you publish.
              </p>
              <div className="animate-fade-up animate-fade-up-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <a href={registerUrl} className="group inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 font-semibold text-ink transition hover:bg-gold-light">
                  Create Funeral Home Account
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
                <Link to="/demo" className="inline-flex items-center justify-center gap-2 rounded-full border border-parchment/25 px-7 py-3.5 font-medium text-parchment transition hover:border-parchment/60 hover:bg-white/5">
                  View Demo Memorial
                </Link>
              </div>
            </div>

            <div className="animate-fade-up animate-fade-up-delay-3 relative mx-auto w-full max-w-md lg:ml-auto">
              <div className="absolute -inset-5 rounded-[2.5rem] border border-gold/10" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-light/75 p-7 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-9">
                <div className="flex items-start justify-between border-b border-white/10 pb-7">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gold">In loving memory</p>
                    <p className="mt-3 font-display text-4xl text-parchment">One beautiful page</p>
                    <p className="mt-2 text-sm text-parchment/45">Every detail. One gentle experience.</p>
                  </div>
                  <QrCode size={36} strokeWidth={1.25} className="text-gold-light" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 mt-7">
                  {features.map(({ icon: Icon, label }, index) => (
                    <div key={label} className={`flex items-center gap-3 bg-ink-light px-4 py-4 ${index === features.length - 1 ? 'col-span-2' : ''}`}>
                      <Icon size={18} strokeWidth={1.5} className="text-gold-light" aria-hidden="true" />
                      <span className="text-sm text-parchment/80">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex items-center justify-between text-xs text-parchment/40">
                  <span>Open on any phone</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Private &amp; dignified</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 hidden w-full max-w-7xl -translate-x-1/2 items-center justify-between border-t border-white/10 px-12 py-5 text-[11px] uppercase tracking-[0.2em] text-parchment/35 lg:flex">
            <span>Programme</span><span>Biography</span><span>Gallery</span><span>Directions</span><span>Tributes</span>
          </div>
        </section>

        <section id="how-it-works" className="relative overflow-hidden px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="lg:sticky lg:top-10 lg:self-start">
              <p className="eyebrow">What it does</p>
              <h2 className="mt-5 max-w-md font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">
                From service details to a lasting memory.
              </h2>
              <p className="mt-6 max-w-sm leading-7 text-ink/60">
                Set up a thoughtful digital experience in minutes, then share it everywhere with one QR code.
              </p>
            </div>
            <ol className="border-t border-ink/15">
              {steps.map(([title, description], index) => (
                <li key={title} className="group grid gap-4 border-b border-ink/15 py-7 sm:grid-cols-[4rem_1fr_1.2fr] sm:items-start sm:py-9">
                  <span className="font-display text-2xl italic text-gold-dark">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-2xl font-semibold transition-colors group-hover:text-gold-dark">{title}</h3>
                  <p className="max-w-md leading-7 text-ink/55">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-[#e8e0d4] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow">A simpler way to offer more care</p>
              <h2 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-none sm:text-6xl">The funeral home pays. The family simply receives.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-3xl bg-parchment p-7 shadow-sm">
                <CircleDollarSign size={26} strokeWidth={1.5} className="text-gold-dark" />
                <h3 className="mt-10 font-display text-2xl font-semibold">One clear business account</h3>
                <p className="mt-3 leading-7 text-ink/55">Include Memory Connect in your service offering without asking grieving families to arrange a separate payment.</p>
              </div>
              <div className="rounded-3xl bg-ink p-7 text-parchment shadow-xl">
                <Clock3 size={26} strokeWidth={1.5} className="text-gold-light" />
                <h3 className="mt-10 font-display text-2xl font-semibold">Ready for every service</h3>
                <p className="mt-3 leading-7 text-parchment/55">Your team creates and publishes memorials from one simple funeral-home portal.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="overflow-hidden bg-parchment px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 border-b border-ink/15 pb-14 lg:grid-cols-2 lg:items-end">
              <div>
                <p className="eyebrow">Simple pricing</p>
                <h2 className="mt-5 font-display text-5xl font-semibold leading-none sm:text-7xl">Start small.<br />Serve beautifully.</h2>
              </div>
              <p className="max-w-lg text-lg leading-8 text-ink/55 lg:justify-self-end">
                Draft for free, then pay once when the funeral is ready to share. Public viewing is included for 30 days.
              </p>
            </div>

            <div className="mt-14 grid gap-10 overflow-hidden rounded-[2rem] bg-ink p-8 text-parchment shadow-2xl shadow-ink/15 sm:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-light">Pay per funeral</p>
                <p className="mt-6 font-display text-6xl font-semibold tracking-tight sm:text-8xl">R299.99</p>
                <p className="mt-3 text-lg text-parchment/55">per published funeral</p>
                <a href={registerUrl} className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 font-semibold text-ink transition hover:bg-gold-light">
                  Create Funeral Home Account <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
              </div>
              <div className="border-t border-white/10 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                <h3 className="font-display text-3xl">Publish each funeral for R299.99</h3>
                <ul className="mt-7 space-y-4 text-parchment/75">
                  {['Drafts are free', 'Public viewing included for 30 days', 'Programme, photos, directions, obituary and QR code', 'Secure payment through Paystack'].map((item) => (
                    <li key={item} className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-light"><Check size={14} /></span>{item}</li>
                  ))}
                </ul>
                <p className="mt-7 text-sm leading-6 text-parchment/50">No monthly fees. No packages. No complicated subscriptions.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-gold px-5 py-24 text-ink sm:px-8 sm:py-28 lg:px-12">
          <div className="absolute inset-0 final-cta-lines opacity-25" />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
            <Heart size={34} strokeWidth={1.25} aria-hidden="true" />
            <h2 className="mt-8 font-display text-5xl font-semibold leading-none sm:text-7xl">Give every family<br />one place to remember.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/65">Create your funeral home account and bring the programme, story, photographs and tributes together.</p>
            <a href={registerUrl} className="group mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 font-semibold text-parchment transition hover:bg-ink-light">
              Get started with Memory Connect
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-ink px-5 py-10 text-parchment sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-2xl font-semibold">Memory Connect</p>
            <p className="mt-2 text-sm text-parchment/40">Digital memories, thoughtfully connected.</p>
          </div>
          <div className="flex gap-6 text-sm text-parchment/50">
            <a href="#how-it-works" className="hover:text-parchment">How it works</a>
            <a href="#pricing" className="hover:text-parchment">Pricing</a>
            <a href={loginUrl} className="hover:text-parchment">Funeral home sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
