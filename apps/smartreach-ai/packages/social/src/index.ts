export interface PublishPayload {
  platform: string;
  body: string;
  title?: string;
  handle?: string;
}

export interface PublishResult {
  ok: boolean;
  externalId?: string;
  url?: string;
  error?: string;
  simulated: boolean;
}

/**
 * Publish adapters for the MVP.
 *
 * Real platform integrations (Facebook Graph API, LinkedIn, X, Google Business,
 * Instagram, TikTok, YouTube) plug in behind this same interface in Phase 2+.
 * The default adapter simulates a successful publish so the whole pipeline
 * (schedule -> publish -> analytics) is demonstrable without API keys.
 */
export class SocialPublisher {
  private real: Record<string, RealAdapter> = {};

  constructor(adapters?: Record<string, RealAdapter>) {
    this.real = adapters ?? {};
  }

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const adapter = this.real[payload.platform];
    if (adapter) return adapter.publish(payload);
    return simulatePublish(payload);
  }
}

export interface RealAdapter {
  publish(payload: PublishPayload): Promise<PublishResult>;
}

function simulatePublish(payload: PublishPayload): PublishResult {
  const id = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const base = { simulated: true, ok: true, externalId: id };
  switch (payload.platform) {
    case "instagram":
      return { ...base, url: `https://www.instagram.com/p/${id}` };
    case "linkedin":
      return { ...base, url: `https://www.linkedin.com/feed/update/${id}` };
    case "x":
      return { ...base, url: `https://x.com/${payload.handle ?? "you"}/status/${id}` };
    case "youtube":
      return { ...base, url: `https://www.youtube.com/watch?v=${id}` };
    case "tiktok":
      return { ...base, url: `https://www.tiktok.com/@${payload.handle ?? "you"}/video/${id}` };
    case "google":
      return { ...base, url: `https://business.google.com/posts/${id}` };
    case "whatsapp":
      return { ...base };
    default:
      return { ...base, url: `https://www.facebook.com/${payload.handle ?? "you"}/posts/${id}` };
  }
}
