import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./sidebar";

export const metadata: Metadata = {
  title: "ClawDash",
  description: "Ein lokales Dashboard fuer OpenClaw.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <div className="min-h-screen md:flex">
          <Sidebar />
          <main className="app-main min-w-0 flex-1 px-4 py-4 md:px-8 md:py-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
