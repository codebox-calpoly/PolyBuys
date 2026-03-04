const providerDomain = process.env.CONVEX_SITE_URL ?? process.env.CONVEX_SELF_HOSTED_URL;

export default {
  providers: [
    {
      domain: providerDomain,
      applicationID: 'convex',
    },
  ],
};
