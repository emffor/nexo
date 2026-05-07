import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Organizar Markdown',
  description: 'Cole blocos em markdown, reordene os cards e gere a versão final.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-sand">{children}</body>
    </html>
  );
}
