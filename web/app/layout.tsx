import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://brainstack.space"),
  title: {
    default: "BrainStack — Your company's second brain, fully stacked",
    template: "%s · BrainStack",
  },
  description:
    "BrainStack turns your company's documents and systems into an intelligent, conversational assistant — grounded answers with citations, a live view of the agent's reasoning, and real actions in your own tools.",
  openGraph: {
    title: "BrainStack — Your company's second brain, fully stacked",
    description:
      "Grounded, cited answers from your own knowledge. Real actions in your own systems. One AI workspace for the whole organization.",
    url: "https://brainstack.space",
    siteName: "BrainStack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BrainStack — Your company's second brain, fully stacked",
    description:
      "Grounded, cited answers from your own knowledge. Real actions in your own systems.",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f7",
};

/**
 * Re-applies persisted theme overrides BEFORE first paint (no flash of the
 * default theme). Reads the computed vars the theme store persisted — it
 * knows nothing about presets. Must stay dependency-free and tiny.
 */
const THEME_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("brainstack-theme"));var v=s&&s.state&&s.state.vars;if(v)for(var k in v)document.documentElement.style.setProperty(k,v[k]);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
