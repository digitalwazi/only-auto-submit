import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutDashboard, Send, BarChart3, Settings } from "lucide-react";
import Link from "next/link";
import CreateCampaignModal from "@/components/CreateCampaignModal";

import AuthGate from "@/components/AuthGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Auto-Submitter Pro",
  description: "High-performance automated form submission system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex flex-col min-h-screen bg-slate-950 text-slate-50 relative`}>
        <AuthGate>
          {/* Horizontal Header */}
          <header className="w-full glass-card border-x-0 border-t-0 border-b border-white/10 flex items-center justify-between p-4 sticky top-0 z-50">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Send className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                AutoSubmit
              </h1>
            </div>

            <nav className="flex items-center gap-2">
              <NavLink href="/" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active />
              <NavLink href="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
              <NavLink href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" />
            </nav>

            <div>
              <CreateCampaignModal />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 w-full max-w-7xl mx-auto p-6 overflow-auto">
            {children}
          </main>
        </AuthGate>
      </body>
    </html>
  );
}

function NavLink({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${active
        ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
        : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}
