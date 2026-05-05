const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

const nobleAliases = new Map([
  ['@noble/ciphers/aes', 'node_modules/@noble/ciphers/aes.js'],
  ['@noble/ciphers/aes.js', 'node_modules/@noble/ciphers/aes.js'],
  ['@noble/hashes/crypto', 'node_modules/@noble/hashes/crypto.js'],
  ['@noble/hashes/crypto.js', 'node_modules/@noble/hashes/crypto.js'],
  ['@noble/hashes/pbkdf2', 'node_modules/@noble/hashes/pbkdf2.js'],
  ['@noble/hashes/pbkdf2.js', 'node_modules/@noble/hashes/pbkdf2.js'],
  ['@noble/hashes/sha2', 'node_modules/@noble/hashes/sha2.js'],
  ['@noble/hashes/sha2.js', 'node_modules/@noble/hashes/sha2.js'],
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const aliasPath = nobleAliases.get(moduleName);
  if (aliasPath) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, aliasPath),
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
