import type { Metadata } from 'next';
import '@/styles/style.css';

export const metadata: Metadata = {
  title: 'CrewSplit',
  description: 'Self-hosted trip management for sailing crews',
  icons: { icon: '/img/logo.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var t = localStorage.getItem('theme');
              if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              document.documentElement.setAttribute('data-theme', t);
            })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
