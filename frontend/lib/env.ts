const PUBLIC = {
  EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
} as const;

type PublicEnvName = keyof typeof PUBLIC;

function readEnv(name: PublicEnvName): string | null {
  const value = PUBLIC[name];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getRequiredExpoPublicEnv(name: PublicEnvName): string {
  const value = readEnv(name);
  if (value) {
    return value;
  }

  throw new Error(
    `Missing required environment variable ${name}. Set it in frontend/.env.local for local runs or configure it in the deployment environment before starting the app.`
  );
}
