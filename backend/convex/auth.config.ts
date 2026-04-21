import { getAuthProviderDomain } from './lib/runtimeConfig';

export default {
  providers: [
    {
      domain: getAuthProviderDomain(),
      applicationID: 'convex',
    },
  ],
};
