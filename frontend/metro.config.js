/* eslint-disable @typescript-eslint/no-require-imports -- Metro config is CommonJS */
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);

module.exports = withSentryConfig(config);
