// Mock for Convex _generated/server module for testing

module.exports = {
  query: (config) => {
    return async (...args) => {
      if (config.handler) {
        return config.handler(...args);
      }
      return config;
    };
  },
  mutation: (config) => {
    return async (...args) => {
      if (config.handler) {
        return config.handler(...args);
      }
      return config;
    };
  },
  action: (config) => {
    return async (...args) => {
      if (config.handler) {
        return config.handler(...args);
      }
      return config;
    };
  },
  internalQuery: (config) => config,
  internalMutation: (config) => config,
  internalAction: (config) => config,
  httpAction: (config) => config,
};
