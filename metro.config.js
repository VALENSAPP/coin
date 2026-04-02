const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const metroResolve = require(
  require.resolve('metro-resolver', {
    paths: [path.join(__dirname, 'node_modules/@react-native/community-cli-plugin/node_modules')],
  }),
).resolve;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

const defaultConfig = getDefaultConfig(__dirname);

/** Hermes does not support `import.meta`; valtio's ESM build uses import.meta.env. Force CJS entry points. */
function resolveValtioCjs(moduleName) {
  const root = path.join(__dirname, 'node_modules', 'valtio');
  const map = {
    valtio: 'index.js',
    'valtio/vanilla': 'vanilla.js',
    'valtio/react': 'react.js',
    'valtio/utils': 'utils.js',
    'valtio/macro': 'macro.js',
  };
  const file = map[moduleName];
  return file ? path.join(root, file) : null;
}

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
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
      unstable_enablePackageExports: false,
      assetExts: assetExts.filter(ext => ext !== 'svg'),
      sourceExts: [...sourceExts, 'svg'],
      resolveRequest: (context, moduleName, platform) => {
        const cjs = resolveValtioCjs(moduleName);
        if (cjs) {
          return { filePath: cjs, type: 'sourceFile' };
        }
        return metroResolve(context, moduleName, platform);
      },
    },
  });
})();
