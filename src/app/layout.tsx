import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skitour Planer — Swiss Ski Mountaineering',
  description: 'Plan safe weekend ski tours in Switzerland with AI-powered route planning, avalanche bulletins, and swisstopo maps.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://unpkg.com" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body
        className="bg-black text-white/90 overflow-hidden"
        style={{
          height: '100dvh',
          minHeight: '100dvh',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
