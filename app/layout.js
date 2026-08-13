import { Bevan, Anton, Roboto_Slab } from 'next/font/google';
import './globals.css';

const bevan = Bevan({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bevan',
  display: 'swap',
});

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const robotoSlab = Roboto_Slab({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-roboto-slab',
  display: 'swap',
});

export const metadata = {
  title: 'Hacker Goa House 2026 — Builder ID Card Generator',
  description: 'Create your personalized Builder ID Card for Hacker Goa House 2026. Upload a photo, pick your role, and download your badge instantly. #FrameInGoa',
  openGraph: {
    title: 'Hacker Goa House 2026 — Builder ID Card',
    description: 'Generate your Builder Pass for HH Goa 2026 🌴',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bevan.variable} ${anton.variable} ${robotoSlab.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
