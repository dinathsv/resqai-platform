import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

export interface LocationMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
}

export function mapEmbedUrl(lat: number, lng: number, zoom = 11): string {
  const span = 360 / 2 ** zoom;
  const bbox = [Math.max(-180, lng - span), Math.max(-85, lat - span),
    Math.min(180, lng + span), Math.min(85, lat + span)].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export default function LocationMap({ lat, lng, zoom = 11, title = 'Location map' }: LocationMapProps) {
  const uri = mapEmbedUrl(lat, lng, zoom);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = failedUri === uri;
  return (
    <View style={styles.container} accessibilityLabel={title}>
      {!failed && <WebView
        key={uri}
        source={{ uri }}
        style={styles.container}
        originWhitelist={['https://*']}
        onError={() => setFailedUri(uri)}
        onHttpError={() => setFailedUri(uri)}
        startInLoadingState
      />}
      {failed && <Text style={styles.error}>Map could not load. Check your connection or open the map below.</Text>}
      <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`)}>
        <Text style={styles.linkText}>Open map ↗</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', minHeight: 150 },
  error: { padding: 16, color: '#334155' },
  link: { position: 'absolute', right: 8, top: 8, padding: 7, backgroundColor: '#FFFFFF', borderRadius: 6 },
  linkText: { color: '#164F43', fontSize: 12 },
});
