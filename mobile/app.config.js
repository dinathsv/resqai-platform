module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    nativeMapsEnabled: Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
