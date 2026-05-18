const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite (web) imports a `.wasm` file. Ensure Metro treats it as an asset.
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, "wasm"]));

module.exports = withNativeWind(config, { input: "./global.css" });

