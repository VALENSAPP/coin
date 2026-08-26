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

/** Metro is resolving date-fns to its ESM index, but this install only bundles the CJS entry reliably. */
function resolveDateFnsCjs(moduleName) {
  if (moduleName !== 'date-fns') return null;
  return path.join(__dirname, 'node_modules', 'date-fns', 'index.cjs');
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
        const dateFns = resolveDateFnsCjs(moduleName);
        if (dateFns) {
          return { filePath: dateFns, type: 'sourceFile' };
        }
        return metroResolve(context, moduleName, platform);
      },
    },
  });
})();
