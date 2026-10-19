import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowIcon, MountainSilhouette, ProteaBloom, QrIcon, SaHeartIcon } from './icons';

export function ClosingCta() {
  return (
    <section className="landing-closing" aria-labelledby="closing-heading">
      <ProteaBloom className="landing-closing-protea" />
      <MountainSilhouette className="landing-closing-silhouette" />
      <div className="landing-closing-inner">
        <div className="landing-closing-qr" aria-hidden="true">
          <span className="landing-closing-qr-tile"><QrIcon className="h-14 w-14" /></span>
          <span className="landing-closing-qr-tile landing-dim"><QrIcon className="h-14 w-14" /></span>
        </div>
        <div>
          <h2 id="closing-heading" className="landing-h2 landing-closing-title">Put your celebration on one page.</h2>
          <p className="landing-closing-sub">Create it in minutes, share it everywhere, keep the memories.</p>
          <div className="landing-closing-ctas">
            <Link to="/register" className="landing-cta-primary">
              Create your event <ArrowIcon />
            </Link>
            <Link to="/login" className="landing-cta-outline">Log in</Link>
          </div>
        </div>
        <div className="landing-sa-script">
          <p>Proudly<br />South African</p>
          <span className="landing-sa-heart"><SaHeartIcon className="h-7 w-7" /></span>
        </div>
      </div>
    </section>
  );
}

export function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const heroCta = document.getElementById('hero-cta');
    if (!heroCta || !('IntersectionObserver' in window)) {
      setShow(true);
      return;
    }
    const obs = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 });
    obs.observe(heroCta);
    return () => obs.disconnect();
  }, []);

  if (!show) return null;
  return (
    <div className="landing-sticky">
      <Link to="/register" className="landing-sticky-btn" aria-label="Create an Event — go to registration">
        Create an Event
      </Link>
    </div>
  );
}
