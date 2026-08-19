import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.port, () => {
  console.log(`[api] SmartReach AI API listening on http://localhost:${config.port}`);
  console.log(`[api] AI provider: ${config.ai.provider} (fallback: ${config.ai.fallback})`);
});