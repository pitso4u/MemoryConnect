import { Link } from 'react-router-dom';
import PhoneMockup from './PhoneMockup';
import { ArrowIcon, CheckIcon, PhoneIcon, ShieldIcon, WhatsAppIcon } from './icons';

export function TrustStrip() {
  return (
    <div className="landing-trust" aria-label="Trust highlights">
      <span className="landing-trust-item">
        <ShieldIcon className="h-5 w-5" />
        Built in South Africa
      </span>
      <span className="landing-trust-item">
        <WhatsAppIcon className="h-5 w-5" />
        Made for WhatsApp sharing
      </span>
      <span className="landing-trust-item">
        <PhoneIcon className="h-5 w-5" />
        No app download needed
      </span>
    </div>
  );
}

export function LandingHeader() {
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <Link to="/" className="landing-wordmark" aria-label="Events Connect home">
          <img src="/events-connect-mark.png" alt="" />
          <span>Events <strong>Connect</strong><small>PLAN. CELEBRATE. TOGETHER.</small></span>
        </Link>
        <nav className="flex gap-2" aria-label="Main">
          <Link to="/login" className="landing-header-login">Log in</Link>
          <Link to="/register" className="landing-header-cta">Create an Event</Link>
        </nav>
      </div>
    </header>
  );
}

export default function Hero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-heading">
      <div className="landing-hero-photo" role="img" aria-label="Sunset over Cape Town and Table Mountain with proteas in the foreground" />
      <div className="landing-hero-inner">
        <div className="landing-hero-copy">
          <p className="eyebrow landing-eyebrow">Weddings · Birthdays · Graduations · More</p>
          <h1 id="landing-hero-heading" className="landing-h1">
            One beautiful page for your special event.
          </h1>
          <p className="landing-lede">
            Details, photos, programme and guest messages together in one link
            that opens perfectly on any phone.
          </p>
          <div id="hero-cta" className="landing-cta-row">
            <Link to="/register" className="landing-cta-primary">
              Create an Event <ArrowIcon />
            </Link>
            <a href="#examples" className="landing-cta-ghost">View Examples</a>
          </div>
          <p className="landing-free">
            <CheckIcon className="h-4 w-4" /> Create for free. Publish for R299.99 once per event.
          </p>
          <TrustStrip />
        </div>
        <div className="landing-hero-visual">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
