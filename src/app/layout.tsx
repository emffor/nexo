import type { Metadata } from "next";
import "./globals.css";
import { UI_THEME_CSS } from "../lib/uiTheme";

export const metadata: Metadata = {
  title: "Nexo",
  description:
    "Cole blocos em markdown, reordene os cards e gere a versão final.",
  icons: {
    icon: "/favicon.svg",
  },
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('organizar-markdown:theme');if(t!=='light'){t='dark';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;if(document.body){document.body.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><style>{UI_THEME_CSS}</style></head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
