import { ReactNode } from 'react';
import { LocalizationProvider } from '@/lib/localization';
import { ThemeProvider } from 'next-themes';
import { Inter, Cairo } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' });

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${cairo.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <LocalizationProvider>
            {children}
          </LocalizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
