const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // npm workspace hoisting can prevent babel-preset-expo from auto-detecting expo-router.
    // Registering the router transform explicitly keeps EXPO_ROUTER_APP_ROOT inlining reliable.
    plugins: [expoRouterBabelPlugin],
  };
};
