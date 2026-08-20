"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Layers, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export function AppNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();

  if (!user) {
    return (
      <header className="border-b border-line bg-panel/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-base font-black tracking-wide">
            KarisAnki
          </Link>
        </div>
      </header>
    );
  }

  const links = [
    { href: "/decks", label: t("decks"), icon: Layers },
    { href: "/statistics", label: t("statistics"), icon: BarChart3 },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/decks" className="flex items-center gap-2 text-base font-black tracking-wide">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            K
          </span>
          KarisAnki
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-panel-strong hover:text-foreground"
                }`}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
