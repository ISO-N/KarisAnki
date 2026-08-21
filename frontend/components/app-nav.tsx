"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Layers, Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();

  if (!user) {
    return (
      <header className="border-b bg-panel/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex h-11 items-center gap-2 rounded-lg px-2 text-base font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              K
            </span>
            KarisAnki
          </Link>
        </div>
      </header>
    );
  }

  const links = [
    { href: "/", label: t("dashboard"), icon: Home, exact: true },
    { href: "/decks", label: t("decks"), icon: Layers },
    { href: "/statistics", label: t("statistics"), icon: BarChart3 },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-30 border-b bg-panel/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className="flex h-11 items-center gap-2 rounded-lg px-2 text-base font-semibold"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            K
          </span>
          <span className="hidden sm:inline">KarisAnki</span>
          <span className="sr-only sm:hidden">{t("dashboard")}</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label={t("dashboard")}>
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-11 min-w-11 gap-2 px-2 sm:px-3",
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
