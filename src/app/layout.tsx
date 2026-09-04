import type { Metadata } from 'next';
import { Nunito, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Horas Grupo',
  description: 'Imputación de horas y reporting FTE del grupo',
};

const THEME_INIT_SCRIPT = `
(function () {
  var stored = localStorage.getItem('theme');
  var theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${ibmPlexMono.variable}`}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
