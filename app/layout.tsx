import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Confidence Pharma | Admin Business Control Center",
  description: "One Stop B2B Healthcare & Business Marketplace Operations & Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-slate-50 antialiased text-slate-900">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-x-hidden">
          <Header />
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

