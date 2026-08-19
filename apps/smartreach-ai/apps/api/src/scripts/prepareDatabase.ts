import { execSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const rootEnvPath = path.resolve(__dirname, "../../../.env");
const exampleEnvPath = path.resolve(__dirname, "../../../.env.example");

if (!fs.existsSync(rootEnvPath)) {
  fs.copyFileSync(exampleEnvPath, rootEnvPath);
  console.log("[prep] created .env from .env.example");
}

dotenv.config({ path: rootEnvPath });

// Make DATABASE_URL available to the child prisma process even when cwd
// is a subfolder that Prisma's own dotenv loader doesn't reach.
if (!process.env.DATABASE_URL && process.env.DATABASE_URL_LOCAL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_LOCAL;
}

const prismaDir = path.resolve(__dirname, "../../prisma");
execSync("prisma db push --skip-generate", { stdio: "inherit", cwd: prismaDir });

console.log("[prep] database is in sync with the Prisma schema");
