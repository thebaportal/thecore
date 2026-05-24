import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "The Core",
    template: "%s · The Core",
  },
  description: "The central workspace where projects, communication, and delivery live.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full">
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
