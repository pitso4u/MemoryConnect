import { makeGenerator, type AIGenerator } from "@smartreach/ai";
import { config } from "../config";

let instance: AIGenerator | null = null;

export function getGenerator(): AIGenerator {
  if (!instance) {
    instance = makeGenerator({
      provider: config.ai.provider as "ollama" | "openrouter" | "template",
      fallback: config.ai.fallback as "ollama" | "openrouter" | "template",
      ollamaBaseUrl: config.ai.ollamaBaseUrl,
      ollamaModel: config.ai.ollamaModel,
      openrouterApiKey: config.ai.openrouterApiKey,
      openrouterModel: config.ai.openrouterModel,
      temperature: config.ai.temperature,
    });
  }
  return instance;
}

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}