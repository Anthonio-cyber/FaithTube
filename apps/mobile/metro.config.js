const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// This app lives in an npm workspace, so Metro has to be told about the root:
// it must watch shared code there, and resolve from both node_modules trees.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Do not walk up past the two paths above. Without this, a package deep in the
// tree can resolve React from the root while the app resolves it locally, and
// two copies of React in one bundle fail at runtime with an internals mismatch.
config.resolver.disableHierarchicalLookup = true;

// React and its renderer must be a single instance. The mobile app pins the
// versions React Native expects, which differ from the web app's, so these are
// forced to the copies inside this package.
const singletons = ['react', 'react-dom', 'react-native', 'react-native-web', 'scheduler'];
config.resolver.extraNodeModules = singletons.reduce((acc, name) => {
  const local = path.resolve(projectRoot, 'node_modules', name);
  acc[name] = local;
  return acc;
}, {});

module.exports = config;
