import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { businessRouter } from "./routes/business";
import { contentSourcesRouter } from "./routes/content-sources";
import { connectionsRouter } from "./routes/connected-accounts";
import { postsRouter } from "./routes/posts";
import { calendarRouter } from "./routes/calendar";
import { dashboardRouter } from "./routes/dashboard";
import { analyticsRouter } from "./routes/analytics";
import { leadsRouter } from "./routes/leads";
import { usersRouter } from "./routes/users";
import { notFound, errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: [config.webUrl, /localhost:5\d{3}$/, /127.0.0.1:5\d{3}$/],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  if (config.nodeEnv !== "test") app.use(morgan("dev"));

  app.get("/", (_req, res) => {
    res.json({ name: "SmartReach AI API", version: "0.1.0", healthy: true });
  });

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/business", businessRouter);
  app.use("/api/v1/content-sources", contentSourcesRouter);
  app.use("/api/v1/connections", connectionsRouter);
  app.use("/api/v1/posts", postsRouter);
  app.use("/api/v1/calendar", calendarRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/leads", leadsRouter);
  app.use("/api/v1/users", usersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}