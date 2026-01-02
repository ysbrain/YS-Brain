const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Firebase Auth + Metro module resolution
config.resolver.sourceExts.push('cjs');

module.exports = config;
