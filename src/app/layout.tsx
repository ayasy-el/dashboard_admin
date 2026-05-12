import type { Metadata } from "next";
import "./globals.css";

import { GlobalLoadingProvider } from "@/components/global-loading-provider";
import { PageTopLoader } from "@/components/page-top-loader";
import { ThemeProvider } from "@/components/theme-provider";

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
      <body className="antialiased">
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
