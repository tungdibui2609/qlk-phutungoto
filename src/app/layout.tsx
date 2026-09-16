import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SystemProvider } from "@/contexts/SystemContext";
import { UserProvider } from "@/contexts/UserContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

import { COMPANY_INFO } from "@/lib/constants";
import { generateAppTitle } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

// Cached metadata to eliminate repeated DB requests on every page navigation
let cachedCompanyTitle: string | null = null;
let lastMetaFetch = 0;
const META_CACHE_TTL = 3600 * 1000; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const baseMeta = {
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default' as const,
      title: 'Chánh Thu',
    },
  };

  const now = Date.now();
  if (cachedCompanyTitle && now - lastMetaFetch < META_CACHE_TTL) {
    return {
      ...baseMeta,
      title: generateAppTitle(cachedCompanyTitle),
      description: "Hệ thống quản lý kho và giao việc chuyên nghiệp",
    };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data } = await supabase
      .from("company_settings")
      .select("name, short_name")
      .limit(1)
      .maybeSingle();

    const titleName = (data as any)?.short_name || (data as any)?.name;
    if (titleName) {
      cachedCompanyTitle = titleName;
      lastMetaFetch = now;
      return {
        ...baseMeta,
        title: generateAppTitle(titleName),
        description: "Hệ thống quản lý kho và giao việc chuyên nghiệp",
      };
    }
  } catch (error) {
    console.error("Error fetching company title:", error);
  }

  return {
    ...baseMeta,
    title: generateAppTitle(COMPANY_INFO.name),
    description: "Hệ thống quản lý kho và giao việc chuyên nghiệp",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="theme-color" content="#059669" />
      </head>
      <body className={`${inter.variable} antialiased font-sans`}>
        <UserProvider>
          <SystemProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SystemProvider>
        </UserProvider>
      </body>
    </html>
  );
}
