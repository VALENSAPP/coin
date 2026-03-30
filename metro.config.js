const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {writeEnvShim} = require('./scripts/writeEnvShim');

/** Generate `src/shims/env.js` from `.env` before bundling (Metro cannot resolve `@env`). */
writeEnvShim();

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

const defaultConfig = getDefaultConfig(__dirname);

module.exports = (async () => {
  const {
    resolver: {sourceExts, assetExts},
  } = await defaultConfig;

  return mergeConfig(defaultConfig, {
    transformer: {
      babelTransformerPath: require.resolve('react-native-svg-transformer'),
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
    resolver: {
      assetExts: assetExts.filter(ext => ext !== 'svg'),
      sourceExts: [...sourceExts, 'svg'],
    },
  });
})();
