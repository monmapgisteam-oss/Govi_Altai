import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';
import { getMeta } from '@/lib/data';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Говь-Алтай · Нийгмийн дэд бүтцийн хүртээмжийн атлас',
  description:
    'Говь-Алтай аймгийн сургууль, цэцэрлэг болон авто замын хүртээмжийн орон зайн шинжилгээ — ArcGIS вэб газрын зургийн өгөгдөл дээр суурилсан.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = await getMeta();
  return (
    <html lang="mn" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Shell generatedAt={meta.generatedAt} webmapUrl={meta.webmapUrl}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
