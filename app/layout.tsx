import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JT4 Automated Test Runner',
  description: 'Excel-driven Playwright test generation and execution',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
