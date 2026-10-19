import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENT_TYPE_LABELS, type EventType } from '@memorialconnect/event-shared';
import { ApiError, eventsApi } from '../../lib/api';
import { ArrowIcon, CalendarIcon, MapPinIcon } from './icons';

export type Demo = { slug: string; type: EventType; title: string; date: string; venue: string };

const COVER_CLASS: Record<string, string> = {
  'sarah-john-wedding-demo': 'landing-cover-wedding',
  'thabo-50th-birthday-demo': 'landing-cover-birthday',
  'naledi-graduation-demo': 'landing-cover-graduation',
};

type CardState =
  | { status: 'loading' }
  | { status: 'live'; title: string; date: string; venue: string; type: EventType }
  | { status: 'fallback' }
  | { status: 'hidden' };

function formatDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ExampleCard({ demo }: { demo: Demo }) {
  // Live preview: fetched from the public API, never records a view.
  // 404 (showcase seed not run) hides the card; other errors keep static text.
  const [state, setState] = useState<CardState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .publicEvent(demo.slug)
      .then((data) => {
        if (cancelled) return;
        const locations = (data.locations as { name?: string }[] | undefined) ?? [];
        setState({
          status: 'live',
          title: String(data.title ?? demo.title),
          date: formatDate(data.startDateTime, demo.date),
          venue: locations[0]?.name ? String(locations[0].name) : demo.venue,
          type: (data.eventType as EventType | undefined) ?? demo.type,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof ApiError && err.status === 404 ? 'hidden' : 'fallback' });
      });
    return () => {
      cancelled = true;
    };
  }, [demo.slug, demo.title, demo.date, demo.venue, demo.type]);

  if (state.status === 'hidden') return null;

  if (state.status === 'loading') {
    return (
      <div className="landing-example-card landing-skeleton" role="status" aria-label={`Loading ${demo.title} preview`}>
        <span className="landing-skeleton-cover" aria-hidden="true" />
        <span className="landing-skeleton-line landing-skeleton-title" aria-hidden="true" />
        <span className="landing-skeleton-line" aria-hidden="true" />
        <span className="landing-skeleton-line landing-skeleton-short" aria-hidden="true" />
      </div>
    );
  }

  const live = state.status === 'live';
  const title = live ? state.title : demo.title;
  const date = live ? state.date : demo.date;
  const venue = live ? state.venue : demo.venue;
  const type = live ? state.type : demo.type;

  return (
    <Link to={`/${demo.slug}`} className="landing-example-card card-hover" aria-label={`View example: ${title}`}>
      <span className={`landing-example-cover ${COVER_CLASS[demo.slug] ?? ''}`} role="img" aria-label={`Photo from ${title}`}>
        <span className="landing-example-pill">{EVENT_TYPE_LABELS[type]}</span>
      </span>
      <span className="landing-example-body">
        <span className="landing-example-title">{title}</span>
        <span className="landing-mini-meta">
          <span><CalendarIcon /> {date}</span>
          <span><MapPinIcon /> {venue}</span>
        </span>
      </span>
      <span className="landing-example-foot">
        <span>Open example</span>
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export default function Examples({ demos }: { demos: Demo[] }) {
  return (
    <section id="examples" className="landing-section landing-examples" aria-labelledby="examples-heading">
      <div className="landing-wrap landing-examples-grid">
        <div className="landing-examples-copy">
          <p className="eyebrow landing-eyebrow">Real pages, ready to share</p>
          <h2 id="examples-heading" className="landing-h2">See real examples</h2>
          <p className="landing-sub">Open one — every page below is a live event page made with Events.</p>
          <a href="#examples" className="landing-cta-ghost" aria-label="View all examples">
            View all examples <ArrowIcon />
          </a>
        </div>
        <div className="landing-example-grid">
          {demos.map((d) => (
            <ExampleCard key={d.slug} demo={d} />
          ))}
        </div>
      </div>
    </section>
  );
}
