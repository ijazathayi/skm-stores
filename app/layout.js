import './globals.css';
import { StoreProvider } from '@/lib/store';

export const metadata = {
  title: 'SKM Stores',
  description: 'Billing & Inventory',
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
