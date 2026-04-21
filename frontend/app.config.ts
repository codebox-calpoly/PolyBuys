import appJson from './app.json';
import type { ExpoConfig } from 'expo/config';

type AppJsonShape = {
  expo: ExpoConfig;
};

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

const DEFAULT_APP_ORIGIN = 'https://poly-buys.vercel.app';
const baseConfig = (appJson as AppJsonShape).expo;

function normalizeOrigin(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  return withProtocol.endsWith('/') ? withProtocol.slice(0, -1) : withProtocol;
}

function getAppOrigin(): string {
  const explicitOrigin = normalizeOrigin(process.env.EXPO_PUBLIC_APP_ORIGIN);
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const previewOrigin = normalizeOrigin(process.env.VERCEL_URL);
  const productionOrigin = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  switch (process.env.VERCEL_ENV) {
    case 'preview':
      return previewOrigin ?? productionOrigin ?? DEFAULT_APP_ORIGIN;
    case 'production':
      return productionOrigin ?? previewOrigin ?? DEFAULT_APP_ORIGIN;
    default:
      return productionOrigin ?? previewOrigin ?? DEFAULT_APP_ORIGIN;
  }
}

function getRouterExtra(extra: ExpoConfig['extra'] | undefined): Record<string, unknown> {
  const router = extra?.router;
  if (router && typeof router === 'object' && !Array.isArray(router)) {
    return router as Record<string, unknown>;
  }
  return {};
}

function withRouterOrigin(
  plugins: ExpoConfig['plugins'] | undefined,
  origin: string
): ExpoConfig['plugins'] {
  return plugins?.map((plugin): PluginEntry => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-router') {
      const existingOptions =
        plugin.length > 1 && plugin[1] && typeof plugin[1] === 'object' && !Array.isArray(plugin[1])
          ? (plugin[1] as Record<string, unknown>)
          : {};

      return ['expo-router', { ...existingOptions, origin }];
    }

    return plugin;
  });
}

const origin = getAppOrigin();

const config: ExpoConfig = {
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    appOrigin: origin,
    router: {
      ...getRouterExtra(baseConfig.extra),
      origin,
    },
  },
  plugins: withRouterOrigin(baseConfig.plugins, origin),
};

export default config;
