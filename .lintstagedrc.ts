import type { Configuration } from "lint-staged";

const config: Configuration = {
  "*.{ts,tsx}": "biome check --fix",
  "*.{json,md,yml,yaml}": "prettier --write",
};

export default config;
