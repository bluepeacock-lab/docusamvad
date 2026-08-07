import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "DocuSamvad",
  description: "Chat with your documents using Sarvam AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lora.variable} font-sans antialiased bg-background text-body`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
