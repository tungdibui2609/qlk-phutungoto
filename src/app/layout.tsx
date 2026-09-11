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
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic"; // Force dynamic rendering to avoid caching

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Metadata generation generally should not set cookies
        },
      },
    });

    const { data, error } = await supabase
      .from("company_settings")
      .select("name, short_name")
      .limit(1)
      .maybeSingle();

    if (error) {
      // console.error("Supabase metadata fetch error details:", JSON.stringify(error, null, 2));
    }

    // console.log("Fetched company name:", data?.name);

    const baseMeta = {
      manifest: '/manifest.webmanifest',
      appleWebApp: {
        capable: true,
        statusBarStyle: 'default' as const,
        title: 'Chánh Thu',
      },
    }

    if ((data as any)?.short_name) {
      return {
        ...baseMeta,
        title: generateAppTitle((data as any).short_name),
        description: "Hệ thống quản lý kho và giao việc chuyên nghiệp",
      };
    }

    if ((data as any)?.name) {
      return {
        ...baseMeta,
        title: generateAppTitle((data as any).name),
        description: "Hệ thống quản lý kho và giao việc chuyên nghiệp",
      };
    }
  } catch (error) {
    console.error("Error fetching company title:", error);
  }

  return {
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Chánh Thu',
    },
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
