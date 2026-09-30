import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Web-only root HTML: PWA manifest, iOS home-screen meta, theme color, service worker. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Pobe Coins</title>
        <meta name="description" content="Earn coins for chores, spend them at Chubbybara's POBE Shop." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F9B9CD" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#2A1C22" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pobe" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#FFF5F8}@media (prefers-color-scheme: dark){html,body{background:#1E1418}}' }} />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
