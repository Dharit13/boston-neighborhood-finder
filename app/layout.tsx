import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import UserMenu from "@/components/UserMenu";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boston Neighbourhood Finder",
  description:
    "Find your perfect Boston-area neighborhood based on budget, commute, lifestyle, safety, and community vibe.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const hideMenu = pathname === "/sign-in" || pathname === "/auth/callback";

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {user && !hideMenu && (
          <UserMenu
            email={user.email ?? ""}
            avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}
          />
        )}
      </body>
    </html>
  );
}
