import React from 'react';

interface LocationMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
}

export default function LocationMap({ lat, lng, zoom = 11, title = 'Location map' }: LocationMapProps) {
  const span = 360 / 2 ** zoom;
  const bbox = [Math.max(-180, lng - span), Math.max(-85, lat - span),
    Math.min(180, lng + span), Math.min(85, lat + span)].join(',');
  return <iframe
    title={title}
    src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`}
    style={{ display: 'block', width: '100%', height: '100%', minHeight: 150, border: 0 }}
    allowFullScreen
    referrerPolicy="strict-origin-when-cross-origin"
  />;
}
