const FALLBACK_TEST_AUTH_PROVIDER_DOMAIN = 'http://127.0.0.1';
const RESEND_TEST_SENDER = 'onboarding@resend.dev';

export type ReadinessCheck = {
  status: 'pass' | 'warn' | 'fail';
  message: string;
};

export type DeploymentReadiness = {
  status: 'ready' | 'not_ready';
  checks: {
    authProviderDomain: ReadinessCheck;
    resendApiKey: ReadinessCheck;
    resendFromAddress: ReadinessCheck;
    moderationApiKey: ReadinessCheck;
  };
  timestamp: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getConfiguredAuthProviderDomain(): string | null {
  return (
    readEnv('CONVEX_SITE_URL') ?? readEnv('CONVEX_CLOUD_URL') ?? readEnv('CONVEX_SELF_HOSTED_URL')
  );
}

export function getAuthProviderDomain(): string {
  const configuredDomain = getConfiguredAuthProviderDomain();
  if (configuredDomain) {
    return configuredDomain;
  }

  if (process.env.NODE_ENV === 'test') {
    return FALLBACK_TEST_AUTH_PROVIDER_DOMAIN;
  }

  throw new Error(
    'Missing auth provider domain. Set CONVEX_SITE_URL in the Convex environment, or ensure Convex provides CONVEX_CLOUD_URL/CONVEX_SELF_HOSTED_URL.'
  );
}

export function getConfiguredResendApiKey(): string | null {
  return readEnv('AUTH_RESEND_KEY');
}

export function getConfiguredResendFromAddress(): string | null {
  return readEnv('AUTH_RESEND_FROM') ?? readEnv('RESEND_FROM');
}

export function isVerifiedResendSender(value: string | null): boolean {
  return !!value && !value.toLowerCase().includes(RESEND_TEST_SENDER);
}

export function getDeploymentReadiness(): DeploymentReadiness {
  const authProviderDomain = getConfiguredAuthProviderDomain();
  const resendApiKey = getConfiguredResendApiKey();
  const resendFromAddress = getConfiguredResendFromAddress();
  const moderationApiKey = readEnv('OPENAI_API_KEY');

  const checks = {
    authProviderDomain: authProviderDomain
      ? {
          status: 'pass',
          message: 'Auth provider domain is configured.',
        }
      : {
          status: 'fail',
          message:
            'Missing CONVEX_SITE_URL (or Convex-provided fallback URL). Auth callback URLs will be invalid.',
        },
    resendApiKey: resendApiKey
      ? {
          status: 'pass',
          message: 'AUTH_RESEND_KEY is configured for email OTP sign-in.',
        }
      : {
          status: 'fail',
          message: 'Missing AUTH_RESEND_KEY. Email OTP sign-in will fail in production.',
        },
    resendFromAddress: resendFromAddress
      ? isVerifiedResendSender(resendFromAddress)
        ? {
            status: 'pass',
            message: 'AUTH_RESEND_FROM is configured with a verified sender.',
          }
        : {
            status: 'fail',
            message:
              'AUTH_RESEND_FROM is still using Resend test mode. Configure a verified sender on your domain.',
          }
      : {
          status: 'fail',
          message: 'Missing AUTH_RESEND_FROM. Email OTP sign-in will fail in production.',
        },
    moderationApiKey: moderationApiKey
      ? {
          status: 'pass',
          message: 'OPENAI_API_KEY is configured for content moderation.',
        }
      : {
          status: 'warn',
          message:
            'OPENAI_API_KEY is not configured. Listings and messages will bypass moderation and rely on manual reporting only.',
        },
  } satisfies DeploymentReadiness['checks'];

  const hasFailure = Object.values(checks).some((check) => check.status === 'fail');

  return {
    status: hasFailure ? 'not_ready' : 'ready',
    checks,
    timestamp: new Date().toISOString(),
  };
}
