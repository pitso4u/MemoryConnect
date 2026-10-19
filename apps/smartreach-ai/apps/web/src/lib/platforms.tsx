import type { SocialPlatform } from "@smartreach/common";

export const PLATFORM_META: Record<
  string,
  { label: string; color: string; short: string }
> = {
  facebook: { label: "Facebook", color: "#1877F2", short: "f" },
  instagram: { label: "Instagram", color: "#E1306C", short: "ig" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", short: "in" },
  tiktok: { label: "TikTok", color: "#69C9D0", short: "tk" },
  x: { label: "X", color: "#E7E9EA", short: "X" },
  google: { label: "Google Business", color: "#34A853", short: "G" },
  youtube: { label: "YouTube", color: "#FF0000", short: "▶" },
  whatsapp: { label: "WhatsApp", color: "#25D366", short: "wa" },
  blog: { label: "Blog", color: "#E8A23D", short: "B" },
  newsletter: { label: "Newsletter", color: "#C792EA", short: "@" },
};

export function PlatformMark({ platform, size = 28 }: { platform: string; size?: number }) {
  const meta = PLATFORM_META[platform] ?? { label: platform, color: "#888", short: "•" };
  return (
    <span
      title={meta.label}
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-display font-semibold text-ink-950"
      style={{ width: size, height: size, backgroundColor: meta.color, fontSize: size * 0.4 }}
    >
      {meta.short}
    </span>
  );
}

export function platformColor(platform: string) {
  return PLATFORM_META[platform]?.color ?? "#888";
}

export function platformLabel(platform: string) {
  return PLATFORM_META[platform]?.label ?? platform;
}
