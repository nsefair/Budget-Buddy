#!/usr/bin/env node
/**
 * Run Expo with a forced brand palette.
 *
 *   node scripts/with-brand.mjs <green|orange> [expo args...]
 *
 * Forces EXPO_PUBLIC_BRAND_PALETTE to win over .env. Expo's loader does not
 * override env vars that are already set in the process, so as long as we
 * set it here before spawning `expo`, the .env value is ignored.
 */
import { spawn } from "node:child_process";

const brand = process.argv[2];
if (brand !== "green" && brand !== "orange") {
  console.error("Usage: node scripts/with-brand.mjs <green|orange> [expo args...]");
  process.exit(1);
}

const expoArgs = process.argv.slice(3);
if (expoArgs.length === 0) {
  expoArgs.push("start", "--clear");
}

const env = { ...process.env, EXPO_PUBLIC_BRAND_PALETTE: brand };

console.log(`\n  Brand palette: ${brand.toUpperCase()} (restart Metro / reload app)\n`);

const child = spawn("npx", ["expo", ...expoArgs], {
  env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
