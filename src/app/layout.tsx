import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Toàn Thắng - Quản Lý Kho Phụ Tùng",
  description: "Hệ thống quản lý kho phụ tùng ô tô chuyên nghiệp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} antialiased font-sans`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
