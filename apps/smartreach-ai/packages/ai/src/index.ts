import type { GeneratorPlatform } from "@smartreach/common";

export interface BusinessContext {
  name: string;
  industry: string;
  website?: string;
  description?: string;
  tone: string;
  audience: string;
  keywords: string[];
  primaryColor?: string;
  secondaryColor?: string;
  fonts?: string;
}

export interface ContentSourceContext {
  type: string;
  label: string;
  url?: string;
  content?: string;
}

export interface GenerationInput {
  business: BusinessContext;
  sources: ContentSourceContext[];
  platforms: GeneratorPlatform[];
  countPerPlatform?: number;
}

export interface GeneratedPost {
  platform: GeneratorPlatform;
  variant: string;
  title?: string;
  body: string;
}

export interface ProviderConfig {
  provider: "ollama" | "openrouter" | "template";
  fallback?: "ollama" | "openrouter" | "template";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  temperature?: number;
}

export interface AIGenerator {
  readonly provider: string;
  generate(input: GenerationInput): Promise<GeneratedPost[]>;
}

export function makeGenerator(config: ProviderConfig): AIGenerator {
  if (config.provider === "openrouter") {
    return new RemoteGenerator("openrouter", config, config.fallback);
  }
  if (config.provider === "ollama") {
    return new RemoteGenerator("ollama", config, config.fallback);
  }
  return new TemplateGenerator();
}

class RemoteGenerator implements AIGenerator {
  readonly provider: string;
  private client: OpenAICompatibleClient;
  private fallback: TemplateGenerator;

  constructor(
    provider: "ollama" | "openrouter",
    config: ProviderConfig,
    fallbackProvider?: "ollama" | "openrouter" | "template",
  ) {
    this.provider = provider;
    const baseUrl =
      provider === "ollama"
        ? (config.ollamaBaseUrl ?? "http://localhost:11434").replace(/\/$/, "") + "/v1"
        : "https://openrouter.ai/api/v1";
    const model =
      provider === "ollama" ? config.ollamaModel ?? "llama3.1" : config.openrouterModel ?? "openai/gpt-4o-mini";
    const apiKey = provider === "openrouter" ? config.openrouterApiKey ?? "" : "";
    this.client = new OpenAICompatibleClient(baseUrl, model, apiKey, config.temperature ?? 0.7);
    this.fallback = new TemplateGenerator();
    this.fallbackProvider = fallbackProvider;
  }

  private fallbackProvider?: "ollama" | "openrouter" | "template";

  async generate(input: GenerationInput): Promise<GeneratedPost[]> {
    try {
      const prompt = buildGenerationPrompt(input);
      const raw = await this.client.chat(prompt);
      const parsed = parseModelResponse(raw, input.platforms);
      if (parsed.length === 0) throw new Error("Model returned no usable content");
      return parsed;
    } catch (err) {
      const via = this.fallbackProvider ?? "template";
      console.warn(`[ai] ${this.provider} generation failed (${(err as Error).message}). Falling back to ${via}.`);
      if (via === "template") return this.fallback.generate(input);
      const fallbackRemote = new RemoteGenerator(via, {
        provider: via,
        ollamaBaseUrl: "http://localhost:11434",
      });
      return fallbackRemote.generate(input);
    }
  }
}

class OpenAICompatibleClient {
  constructor(
    private baseUrl: string,
    private model: string,
    private apiKey: string,
    private temperature: number,
  ) {}

  async chat(prompt: string): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are SmartReach AI, a marketing content engine. You produce platform-ready marketing copy that is respectful, brand-consistent and conversion-focused. Always return valid JSON. Never wrap JSON in markdown fences.",
            },
            { role: "user", content: prompt },
          ],
          temperature: this.temperature,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`provider HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      if (!content) throw new Error("empty completion");
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildGenerationPrompt(input: GenerationInput): string {
  const sourceLines = input.sources
    .map(
      (s) =>
        `- [${s.type}] ${s.label}${s.url ? ` (${s.url})` : ""}${s.content ? `: ${s.content.slice(0, 400)}` : ""}`,
    )
    .join("\n");

  return [
    `Generate marketing content for the business below.`,
    ``,
    `BUSINESS`,
    `Name: ${input.business.name}`,
    `Industry: ${input.business.industry}`,
    `Website: ${input.business.website ?? "n/a"}`,
    `Description: ${input.business.description ?? "n/a"}`,
    `Tone: ${input.business.tone}`,
    `Target audience: ${input.business.audience}`,
    `Keywords: ${input.business.keywords.join(", ") || "none"}`,
    ``,
    `CONTENT SOURCES (what the AI may reference):`,
    sourceLines || "none available — invent plausible, generic copy.",
    ``,
    `TASK: Create one piece of content per requested platform with a distinct variant per tone.`,
    ``,
    `Return ONLY a JSON object of the form:`,
    `{ "posts": [ { "platform": "<facebook|linkedin|instagram|tiktok|youtube|blog|newsletter>", "variant": "Friendly", "title": "optional short title", "body": "<full content>" } ] }`,
    ``,
    `PLATFORM FORMAT RULES:`,
    `- facebook: engaging post, under 280 words, includes a call to action and a URL if the business has one.`,
    `- linkedin: professional, value-led, 120-200 words, plain tone, no emoji.`,
    `- instagram: short, punchy caption under 150 words with hashtags.`,
    `- tiktok: a 30-second video script with clear scene directions in [BRACKETS].`,
    `- youtube: a 2-minute script with an intro, hook, body, and outro.`,
    `- blog: a 800-1000 word article in markdown with headings and a strong headline.`,
    `- newsletter: a friendly email of 150-250 words with a subject line in the title field and a CTA.`,
    ``,
    `Requested platforms: ${input.platforms.join(", ")}.`,
  ].join("\n");
}

function parseModelResponse(raw: string, requested: GeneratorPlatform[]): GeneratedPost[] {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

  let data: { posts?: unknown };
  try {
    data = JSON.parse(cleaned) as { posts?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(data.posts)) return [];
  return data.posts
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      platform: String(p.platform ?? ""),
      variant: String(p.variant ?? "Modern"),
      title: p.title ? String(p.title) : undefined,
      body: String(p.body ?? ""),
    }))
    .filter((p) => requested.includes(p.platform as GeneratorPlatform) && p.body.length > 0) as GeneratedPost[];
}

class TemplateGenerator implements AIGenerator {
  readonly provider = "template";

  async generate(input: GenerationInput): Promise<GeneratedPost[]> {
    const posts: GeneratedPost[] = [];
    for (const platform of input.platforms) {
      for (const variant of ["Friendly", "Professional", "Modern"]) {
        posts.push(this.render(platform, variant, input));
      }
    }
    return posts;
  }

  private render(
    platform: GeneratorPlatform,
    variant: string,
    input: GenerationInput,
  ): GeneratedPost {
    const b = input.business;
    const kw = b.keywords.length ? b.keywords.slice(0, 3) : ["memorial", "remembrance", "care"];
    const source = input.sources.find((s) => s.content) ?? input.sources[0];
    const topic = source ? source.content!.slice(0, 140) : `${b.industry} services`;
    const cta = b.website ? `Visit ${b.website}` : `Contact ${b.name}`;

    switch (platform) {
      case "facebook":
        return {
          platform,
          variant,
          body: [
            `${opener(variant)} ${b.name} helps families across ${b.audience} connect with what matters most.`,
            ``,
            topic.trim()
              ? `Right now, ${friendlyAction(topic)} — beautifully, simply, and at their own pace.`
              : `We make ${b.industry.toLowerCase()} easier, more personal, and more accessible.`,
            ``,
            `${cta}. ${b.website ? `Discover more at ${b.website}.` : "Ask us how we can help today."}`,
            ``,
            hashtags(kw),
          ].join("\n"),
        };
      case "linkedin":
        return {
          platform,
          variant,
          title: `How ${b.name} is modernising ${b.industry}`,
          body: [
            `At ${b.name}, we believe consistent, caring service is built on clear communication.`,
            ``,
            `Across the ${audience(b)} market, ${b.industry.toLowerCase()} teams face the same challenge: reaching the right families at the right moment. Our approach pairs technology with a human touch.`,
            ``,
            `${topic.trim() ? `Today we're focused on ${lower(topic)}. ` : ""}It's part of a larger commitment to reliability, transparency, and dignity in every interaction.`,
            ``,
            `We'd value the chance to connect with partners who share that commitment. ${b.website ? `Learn more at ${b.website}.` : "Get in touch."}`,
          ].join("\n"),
        };
      case "instagram":
        return {
          platform,
          variant,
          body: [
            `Small moments. Meaningful care. ${b.website ? `Visit ${b.website}. ` : ""}✨`,
            ``,
            hashtags([...kw, "memories", "family", "care"]),
          ].join("\n"),
        };
      case "tiktok":
        return {
          platform,
          variant,
          title: "30-second script",
          body: [
            `[HOOK — 0-3s] On-screen text: "This is what ${lower(b.industry)} can look like."`,
            `[INTRO — 3-8s] Host speaks to camera: "Families deserve clarity on their hardest days."`,
            `[BODY — 8-22s] Quick cuts showing ${kw.join(", ")}. Voiceover: "${b.name} makes the process simple, dignified and personal."`,
            `[CTA — 22-30s] Host: "Follow us to see more. ${b.website ? `Link in bio — ${b.website}` : "We're here when you need us."}"`,
            ``,
            hashtags(["viral", ...kw]),
          ].join("\n"),
        };
      case "youtube":
        return {
          platform,
          variant,
          title: "2-minute script",
          body: [
            `[0:00-0:15] INTRO — Soft visuals, host: "Hi, welcome. Today we're talking about how ${b.name} is changing ${b.industry.toLowerCase()} for the better."`,
            `[0:15-0:45] THE PROBLEM — "For most families, the process feels overwhelming. Schedules, paperwork, decisions."`,
            `[0:45-1:30] THE SOLUTION — "${b.name} simplifies it — one place for ${kw.slice(0, 2).join(" and ")}, with a team that treats your family like their own."`,
            `[1:30-2:00] OUTRO + CTA — "Thanks for watching. ${b.website ? `Visit ${b.website} or ` : ""}subscribe to follow our story."`,
          ].join("\n"),
        };
      case "blog":
        return {
          platform,
          variant,
          title: `A Modern Guide to ${capitalize(b.industry)} — from ${b.name}`,
          body: [
            `# A Modern Guide to ${capitalize(b.industry)}`,
            ``,
            `When it comes to ${b.industry.toLowerCase()}, clarity matters. This guide explains how ${b.name} approaches the work, what families should expect, and why the right support changes everything.`,
            ``,
            `## Why it matters`,
            `Decisions made under pressure are rarely the best ones. Having a calm, structured process — one source of truth for ${kw.slice(0, 2).join(", ")} — gives families back their peace of mind.`,
            ``,
            `## What ${b.name} does`,
            `${topic.trim() ? `${capitalize(lower(topic))} is central to what we do. ` : ""}Every engagement starts with listening, then builds a clear plan around the needs of the family, not the convenience of the organisation.`,
            ``,
            `## What good looks like`,
            `Clear communication. Transparent timelines. A point of contact who never makes you repeat yourself. These are not extras — they are the baseline.`,
            ``,
            `## Working with us`,
            `If you are planning ahead or need support today, ${b.website ? `visit ${b.website}` : "reach out to us"} to start the conversation. We are here when you need us.`,
            ``,
            `*${b.name} · ${b.audience} · ${b.industry}*`,
          ].join("\n"),
        };
      case "newsletter":
        return {
          platform,
          variant,
          title: `From ${b.name} — what's new in ${b.industry}`,
          body: [
            `Subject: From ${b.name} — what's new in ${b.industry}`,
            ``,
            `Hello,`,
            ``,
            `Welcome to the latest update from ${b.name}. We believe ${lower(b.industry)} should feel simpler, more personal, and more transparent.`,
            ``,
            `This week: ${topic.trim() ? lower(topic) : `a look at how we keep families informed every step of the way.`}`,
            ``,
            `Why does this matter? Because the families we serve deserve more than a checklist — they deserve a partner who anticipates what comes next.`,
            ``,
            `${cta}. ${b.website ? `More at ${b.website}.` : ""}`,
            ``,
            `Warm regards,`,
            `The ${b.name} team`,
          ].join("\n"),
        };
      default:
        return { platform, variant, body: `Update from ${b.name}. ${cta}.` };
    }
  }
}

function opener(variant: string): string {
  switch (variant) {
    case "Friendly":
      return "Hello, and thank you for being part of our community.";
    case "Professional":
      return `${"Update from our team at"}`;
    case "Luxury":
      return "Considered care, quietly delivered.";
    default:
      return "Something worth sharing.";
  }
}

function audience(b: BusinessContext): string {
  return b.audience && b.audience !== "South Africa" ? b.audience : "South African";
}

function hashtags(kw: string[]): string {
  return kw
    .map((k) =>
      "#" +
      k
        .replace(/[^a-zA-Z0-9]/g, "")
        .split(" ")
        .join("")
        .toLowerCase(),
    )
    .join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Turn a raw content-source snippet into a conversational facebook line.
 * e.g. "Families can now honour loved ones with a beautiful online memorial — …"
 *      -> "families can honour loved ones with a beautiful online memorial…"
 */
function friendlyAction(topic: string): string {
  let t = topic.trim();
  t = t.split(/[—–-]/)[0].trim();
  t = t.replace(/^families can\s+/i, "").replace(/^(now|right now)\s+/i, "").trim();
  if (t.length > 140) t = t.slice(0, t.lastIndexOf(" ", 140)) + "…";
  return lower(t);
}

function lower(s: string): string {
  const first = s.charAt(0).toLowerCase();
  return first + s.slice(1);
}

