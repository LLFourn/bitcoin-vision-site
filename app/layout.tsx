import type { Metadata, Viewport } from 'next';
import { Caveat, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-geist-mono' });
const caveat = Caveat({ subsets: ['latin'], weight: ['600'], variable: '--font-caveat' });

export const metadata: Metadata = {
  title: 'bitcoin-vision · Reads handwritten seed backups on-device',
  description:
    'Open-source vision models and a Rust library that turn a photo of a BIP39 recovery phrase or a Penlock share into words you can check. Nothing leaves the device.',
};

export const viewport: Viewport = {
  themeColor: '#FAFAF9',
};

// Light by default. Apply dark before first paint if the visitor picked it,
// so there is no flash.
const themeScript = `try{var t=localStorage.getItem('bv-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
