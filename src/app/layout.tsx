import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { GlobalLoadingProvider } from "@/components/global-loading-provider";
import { PageTopLoader } from "@/components/page-top-loader";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Telkomsel Poin Merchant Dashboard",
  description: "Dashboard overview merchant dan redeem poin Telkomsel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="dashboard-theme"
          themes={["light", "dark"]}
        >
          <GlobalLoadingProvider>
            <PageTopLoader />
            {children}
          </GlobalLoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
