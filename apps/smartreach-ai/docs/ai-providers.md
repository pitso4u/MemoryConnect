# AI Providers

SmartReach AI talks to three backends through one `AIGenerator` interface (`packages/ai`). Two are live LLM providers and one is an offline fallback.

## How the client works

Ollama and OpenRouter both expose an OpenAI-compatible `POST /chat/completions` endpoint, so a single shared client handles both. The system prompt asks for strict JSON of the form:

```json
{
  "posts": [
    { "platform": "facebook", "variant": "Friendly", "title": "…", "body": "…" }
  ]
}
```

The response is parsed, filtered to the requested platforms, and stored as post drafts.

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `template` | `ollama` \| `openrouter` \| `template` |
| `AI_PROVIDER_FALLBACK` | `template` | Used if the provider errors or times out |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `llama3.1` | Model to use locally |
| `OPENROUTER_API_KEY` | — | Key from https://openrouter.ai |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Hosted model |
| `AI_TEMPERATURE` | `0.7` | Creativity |

## Ollama (local, private)

```bash
# install: https://ollama.com
ollama pull llama3.1
ollama serve
```

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

No API key, no data leaves the machine. Good for testing generation offline.

## OpenRouter (hosted)

```bash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Swap `OPENROUTER_MODEL` for any OpenRouter model id (e.g. `anthropic/claude-3.5-sonnet`, `deepseek/deepseek-chat`).

## Template fallback

When `AI_PROVIDER=template` (the default) or a provider fails, a deterministic generator in `packages/ai/src/index.ts` builds platform-specific copy from the business profile, keywords, and content sources. It is what makes the whole demo run with zero keys.

## Adding another provider

Implement the same interface and register it in `makeGenerator(config)`:

```ts
export interface AIGenerator {
  readonly provider: string;
  generate(input: GenerationInput): Promise<GeneratedPost[]>;
}
```
