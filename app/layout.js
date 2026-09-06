import './globals.css';
import { StoreProvider } from '@/lib/store';

export const metadata = {
  title: 'SKM Stores',
  description: 'Billing & Inventory',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/skm-logo.png', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/skm-logo.png', type: 'image/png', sizes: '512x512' }],
  },
  appleWebApp: {
    capable: true,
    title: 'SKM Stores',
    statusBarStyle: 'default',
  },
};

export const viewport = {
  themeColor: '#F1F0E4',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
