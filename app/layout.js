import './globals.css';
import { StoreProvider } from '@/lib/store';

export const metadata = {
  title: 'SKM Stores',
  description: 'Billing & Inventory',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/skm-logo.png', type: 'image/png', sizes: '192x192' },
      { url: '/skm-logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/skm-logo.png', type: 'image/png', sizes: '180x180' },
      { url: '/skm-logo.png', type: 'image/png', sizes: '192x192' },
      { url: '/skm-logo.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: [{ url: '/skm-logo.png', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'SKM Stores',
    statusBarStyle: 'default',
  },
};

export const viewport = {
  themeColor: '#D9466F',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
