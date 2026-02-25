import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skitour Planer — Swiss Ski Mountaineering',
  description: 'Plan safe weekend ski tours in Switzerland with AI-powered route planning, avalanche bulletins, and swisstopo maps.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="bg-slate-900 text-slate-100 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
