import { Link } from 'react-router-dom';
import Hero, { LandingHeader } from '../components/landing/Hero';
import Examples from '../components/landing/Examples';
import { Faq, HowItWorks, Occasions, ShareSection, SocialProof } from '../components/landing/ContentSections';
import { ClosingCta, StickyCta } from '../components/landing/Closing';

const DEMOS = [
  { slug: 'sarah-john-wedding-demo', type: 'WEDDING' as const, title: "Sarah & John's Wedding", date: '21 November 2026', venue: 'Johannesburg' },
  { slug: 'thabo-50th-birthday-demo', type: 'BIRTHDAY' as const, title: "Thabo's 50th Birthday", date: 'A golden celebration', venue: 'Sandton' },
  { slug: 'naledi-graduation-demo', type: 'GRADUATION' as const, title: "Naledi's Graduation", date: 'Class of 2026', venue: 'Pretoria' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen landing-page">
      <a href="#main" className="landing-skip">Skip to content</a>
      <LandingHeader />

      <main id="main">
        <Hero />
        <Examples demos={DEMOS} />
        <Occasions />
        <HowItWorks />
        <ShareSection />
        <SocialProof />
        <Faq />
        <ClosingCta />
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <img src="/South Africa logo.png" alt="Events Connect — Plan. Celebrate. Together. Life’s important moments, all in one place." className="landing-footer-logo" />
          <span className="landing-footer-word">Events Connect <span style={{ fontWeight: 400, fontSize: '0.8rem' }}>by MemoryConnect</span></span>
          <span>Plan. Celebrate. Together. · Made in South Africa</span>
        </div>
      </footer>
      <StickyCta />
    </div>
  );
}
