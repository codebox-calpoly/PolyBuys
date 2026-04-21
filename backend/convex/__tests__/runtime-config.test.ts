describe('runtimeConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('uses a test fallback auth domain when env is missing', async () => {
    delete process.env.CONVEX_SITE_URL;
    delete process.env.CONVEX_CLOUD_URL;
    delete process.env.CONVEX_SELF_HOSTED_URL;
    process.env.NODE_ENV = 'test';

    const { getAuthProviderDomain } = await import('../lib/runtimeConfig');

    expect(getAuthProviderDomain()).toBe('http://127.0.0.1');
  });

  it('marks the deployment not ready when OTP auth config is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONVEX_SITE_URL = 'https://polybuys.com';
    delete process.env.AUTH_RESEND_KEY;
    delete process.env.AUTH_RESEND_FROM;
    delete process.env.RESEND_FROM;
    delete process.env.OPENAI_API_KEY;

    const { getDeploymentReadiness } = await import('../lib/runtimeConfig');

    expect(getDeploymentReadiness()).toEqual({
      status: 'not_ready',
      checks: {
        authProviderDomain: {
          status: 'pass',
          message: 'Auth provider domain is configured.',
        },
        resendApiKey: {
          status: 'fail',
          message: 'Missing AUTH_RESEND_KEY. Email OTP sign-in will fail in production.',
        },
        resendFromAddress: {
          status: 'fail',
          message: 'Missing AUTH_RESEND_FROM. Email OTP sign-in will fail in production.',
        },
        moderationApiKey: {
          status: 'warn',
          message:
            'OPENAI_API_KEY is not configured. Listings and messages will bypass moderation and rely on manual reporting only.',
        },
      },
      timestamp: expect.any(String),
    });
  });
});
