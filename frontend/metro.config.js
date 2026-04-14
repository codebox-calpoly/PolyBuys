/* eslint-disable @typescript-eslint/no-require-imports -- Metro config is CommonJS */
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
