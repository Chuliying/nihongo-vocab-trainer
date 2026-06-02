"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Library", icon: Layers },
  { href: "/practice", label: "Practice", icon: Sparkles },
  { href: "/sources", label: "Sources", icon: Info }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-svh">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-baseline gap-2"
            aria-label="Nihongo 首頁"
          >
            <span className="font-serif text-xl leading-none text-primary">日</span>
            <span className="font-display text-base italic tracking-tight">
              Nihongo
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="主要導覽">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="relative z-10 pt-14">{children}</div>
    </div>
  );
}
