import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "DMS Connect", description: "Stay connected with people who matter.", applicationName: "DMS Connect" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bn"><body>{children}</body></html>;
}
