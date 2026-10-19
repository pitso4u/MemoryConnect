import { CalendarIcon, HeartIcon, MapPinIcon } from './icons';

/** CSS phone mock of the wedding demo page. Decorative preview — the real page lives at /sarah-john-wedding-demo. */
export default function PhoneMockup() {
  return (
    <div className="landing-phone" role="img" aria-label="Preview of the Sarah and John wedding event page on a phone">
      <div className="landing-phone-notch" aria-hidden="true" />
      <div className="landing-phone-screen">
        <div className="landing-phone-photo">
          <p className="landing-phone-kicker">We are getting married</p>
          <p className="landing-phone-title">Sarah &amp; John</p>
          <p className="landing-phone-sub">21 November 2026 · Johannesburg</p>
        </div>
        <div className="landing-phone-body">
          <div className="landing-phone-row">
            <span className="landing-phone-chip">
              <CalendarIcon /> Sat 11:00
            </span>
            <span className="landing-phone-chip">
              <MapPinIcon /> Country Club
            </span>
          </div>
          <div className="landing-phone-gallery" aria-hidden="true">
            <span className="landing-phone-thumb" />
            <span className="landing-phone-thumb" />
            <span className="landing-phone-thumb" />
          </div>
          <div className="landing-phone-agenda">
            <p className="landing-phone-h">Programme</p>
            <p className="landing-phone-line"><span>11:00</span> Ceremony on the lawn</p>
            <p className="landing-phone-line"><span>14:00</span> Reception &amp; dinner</p>
          </div>
          <div className="landing-phone-msg">
            <HeartIcon className="h-4 w-4 shrink-0" />
            <p><strong>Aunt Maria:</strong> So happy for you both — cannot wait to celebrate!</p>
          </div>
          <span className="landing-phone-cta">Open invitation</span>
        </div>
      </div>
    </div>
  );
}
