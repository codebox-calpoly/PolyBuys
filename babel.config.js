module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: 'commonjs',
      },
    ],
    [
      '@babel/preset-typescript',
      {
        allowDeclareFields: true,
      },
    ],
  ],
  plugins: [
    [
      'babel-plugin-transform-import-meta',
      {
        module: 'CommonJS',
      },
    ],
    './babel-plugin-replace-import-meta-glob.js',
  ],
};
