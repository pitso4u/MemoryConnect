import { EVENT_TYPE_LABELS, type EventType } from '@memorialconnect/event-shared';
import {
  BabyIcon,
  CakeIcon,
  CheckIcon,
  ConfettiIcon,
  CreateIcon,
  FacebookIcon,
  GradCapIcon,
  HeartIcon,
  InstagramIcon,
  PencilIcon,
  QrIcon,
  RingsIcon,
  ShareIcon,
  SmsIcon,
  WhatsAppIcon,
} from './icons';

const OCCASIONS: { type: EventType; blurb: string; icon: (p: { className?: string }) => React.ReactElement; card: string }[] = [
  { type: 'WEDDING', blurb: 'Ceremony, reception and everything in between.', icon: RingsIcon, card: 'landing-occ-rose' },
  { type: 'BIRTHDAY', blurb: 'Milestones worth celebrating together.', icon: CakeIcon, card: 'landing-occ-amber' },
  { type: 'GRADUATION', blurb: 'Honour the achievement with family.', icon: GradCapIcon, card: 'landing-occ-violet' },
  { type: 'BABY_SHOWER', blurb: 'Welcome the little one with love.', icon: BabyIcon, card: 'landing-occ-mint' },
  { type: 'ANNIVERSARY', blurb: 'Years together, beautifully shared.', icon: HeartIcon, card: 'landing-occ-sky' },
  { type: 'CELEBRATION', blurb: 'Any joyful occasion, one page.', icon: ConfettiIcon, card: 'landing-occ-peach' },
];

export function Occasions() {
  return (
    <section className="landing-section landing-occasions" aria-labelledby="types-heading">
      <div className="landing-wrap landing-center">
        <p className="eyebrow landing-eyebrow">Made for every occasion</p>
        <h2 id="types-heading" className="landing-h2">Pick your occasion, the page shapes itself around it.</h2>
        <div className="landing-occ-grid">
          {OCCASIONS.map(({ type, blurb, icon: Icon, card }) => (
            <div key={type} className={`landing-occ-card ${card}`}>
              <span className="landing-occ-icon" aria-hidden="true"><Icon className="h-6 w-6" /></span>
              <h3 className="landing-occ-title">{EVENT_TYPE_LABELS[type]}</h3>
              <p className="landing-occ-blurb">{blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: CreateIcon, title: 'Create your event', text: 'Pick the occasion, add the details that matter. Takes a few minutes.' },
  { icon: PencilIcon, title: 'Personalise your page', text: 'Photos, programme, venue and your own style.' },
  { icon: ShareIcon, title: 'Share the link or QR code', text: 'One link for WhatsApp, SMS and socials.' },
];

export function HowItWorks() {
  return (
    <section className="landing-section landing-how" aria-labelledby="how-heading">
      <div className="landing-wrap landing-how-grid">
        <div>
          <p className="eyebrow landing-eyebrow">Simple steps</p>
          <h2 id="how-heading" className="landing-h2">How it works</h2>
          <p className="landing-sub">Get your event page live in three easy steps.</p>
        </div>
        <ol className="landing-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="landing-step">
              <span className="landing-step-top" aria-hidden="true">
                <span className="landing-step-num">{i + 1}</span>
                <span className="landing-step-icon"><s.icon className="h-5 w-5" /></span>
              </span>
              <h3 className="landing-step-title">{s.title}</h3>
              <p className="landing-step-text">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const CHANNELS = [
  { icon: WhatsAppIcon, tile: 'landing-channel-wa', label: 'WhatsApp', note: 'Most guests arrive here', badge: '1' },
  { icon: FacebookIcon, tile: 'landing-channel-fb', label: 'Facebook', note: null, badge: null },
  { icon: InstagramIcon, tile: 'landing-channel-ig', label: 'Instagram', note: null, badge: null },
  { icon: SmsIcon, tile: 'landing-channel-sms', label: 'SMS', note: null, badge: null },
  { icon: QrIcon, tile: 'landing-channel-qr', label: 'QR code', note: 'Print & posters', badge: null },
];

export function ShareSection() {
  return (
    <section className="landing-section landing-share" aria-labelledby="share-heading">
      <div className="landing-wrap landing-share-grid">
        <div>
          <p className="eyebrow landing-eyebrow">Share anywhere</p>
          <h2 id="share-heading" className="landing-h2">One link. Easy to share.</h2>
          <p className="landing-sub">Send it where your people already are — it just opens, no app needed.</p>
        </div>
        <ul className="landing-channels" aria-label="Share channels">
          {CHANNELS.map((c) => (
            <li key={c.label} className="landing-channel">
              <span className={`landing-channel-icon ${c.tile}`} aria-hidden="true">
                <c.icon className="h-6 w-6" />
                {c.badge ? <span className="landing-channel-badge">{c.badge}</span> : null}
              </span>
              <span className="landing-channel-label">{c.label}</span>
              {c.note ? <span className="landing-channel-note">{c.note}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Social proof: real testimonials render here once they exist.
   Until then, show neutral benefit cards — no invented names or quotes. */
export interface Testimonial {
  quote: string;
  name: string;
  detail: string;
  photo?: string;
}

export const TESTIMONIALS: Testimonial[] = [];

const BENEFITS = [
  { icon: CheckIcon, title: 'Live in minutes', text: 'Pick an occasion, add your details and photos, then publish. No design skills needed.' },
  { icon: HeartIcon, title: 'Made for your guests', text: 'One link that opens fast on any phone — programme, venue, photos and messages in one place.' },
  { icon: ShareIcon, title: 'Share everywhere', text: 'WhatsApp, SMS, Facebook, Instagram or a printed QR code. Every visit is counted for you.' },
];

export function SocialProof() {
  const hasTestimonials = TESTIMONIALS.length > 0;
  return (
    <section className="landing-section landing-proof" aria-labelledby="love-heading">
      <div className="landing-wrap">
        <p className="eyebrow landing-eyebrow">Real people, real moments</p>
        <h2 id="love-heading" className="landing-h2">
          {hasTestimonials ? 'Loved by hosts across SA' : 'Made for hosts across SA'}
        </h2>
        <p className="landing-sub">
          {hasTestimonials
            ? 'Here is what our community has to say about their Events pages.'
            : 'Everything you need for a celebration page your guests will love.'}
        </p>
        <div className="landing-proof-grid">
          {hasTestimonials
            ? TESTIMONIALS.map((t) => (
                <figure key={t.name} className="landing-quote card">
                  {t.photo ? <span className="landing-quote-photo" role="img" aria-label={`Photo of ${t.name}`} style={{ backgroundImage: `url("${t.photo}")` }} /> : null}
                  <blockquote>“{t.quote}”</blockquote>
                  <figcaption><strong>{t.name}</strong><span>{t.detail}</span></figcaption>
                </figure>
              ))
            : BENEFITS.map((b) => (
                <div key={b.title} className="landing-benefit card">
                  <span className="landing-benefit-icon" aria-hidden="true"><b.icon className="h-5 w-5" /></span>
                  <h3 className="landing-benefit-title">{b.title}</h3>
                  <p className="landing-benefit-text">{b.text}</p>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: 'How much does it cost?', a: 'Creating and editing an event is free. Publishing costs R299.99 (about R300) once per event. There is no monthly subscription.' },
  { q: 'How long does my page stay up?', a: 'Your page stays published until you unpublish or archive it. You can also set an expiry date when you publish — after that, guests see a gentle “celebration has ended” notice.' },
  { q: 'How do guest messages work?', a: 'Guests open your link and leave a message — no account needed. You can approve or remove messages from your dashboard at any time.' },
  { q: 'Who can see an unlisted link?', a: 'Unlisted pages are hidden from any listings, but anyone with the link can open it. Choose Public only when you are happy for the page to be discoverable.' },
  { q: 'Can I edit my page after publishing?', a: 'Yes. Edit details, photos, programme and venue any time from your dashboard — changes appear on the live page immediately.' },
  { q: 'Is it safe and private?', a: 'Your account is password-protected and only you can edit your pages. Unlisted links are only visible to people you share them with.' },
];

export function Faq() {
  return (
    <section className="landing-section landing-faq" aria-labelledby="faq-heading">
      <div className="landing-wrap landing-faq-grid">
        <div>
          <p className="eyebrow landing-eyebrow">Quick answers</p>
          <h2 id="faq-heading" className="landing-h2">Questions, answered</h2>
          <p className="landing-sub">Everything you need to know before you get started.</p>
        </div>
        <div className="landing-faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="landing-faq-item card">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
