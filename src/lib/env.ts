export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** Required in production — throws at runtime if missing */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return "";
}
