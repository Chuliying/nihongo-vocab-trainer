"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Info, Layers, List } from "lucide-react";
import { cn } from "@/lib/utils";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewMode = searchParams.get("view");
  const collection = searchParams.get("collection");
  const isOnHome = pathname === "/";
  const isCardMode = isOnHome && viewMode === "card";
  const isListMode = isOnHome && !isCardMode;
  // When no collection is selected ("all"), default to popular-verbs in card mode
  // so the header link never lands on the empty "please pick a collection" state.
  const cardHref = `/?view=card&collection=${collection ?? "popular-verbs"}`;

  return (
    <div className="relative min-h-svh">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Nihongo 首頁"
          >
            <span className="font-serif text-[0.95rem] leading-none text-primary">
              日
            </span>
            <span className="font-logo text-lg font-bold uppercase leading-none tracking-[0.16em]">
              Nihongo
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="主要導覽">
            <Link
              href="/"
              aria-current={isListMode ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isListMode
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-4" />
              <span className="hidden sm:inline">列表</span>
            </Link>
            <Link
              href={cardHref}
              aria-current={isCardMode ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isCardMode
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="size-4" />
              <span className="hidden sm:inline">卡片</span>
            </Link>
            <Link
              href="/sources"
              aria-current={pathname === "/sources" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === "/sources"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Info className="size-4" />
              <span className="hidden sm:inline">資料來源</span>
            </Link>
          </nav>
        </div>
      </header>
      <div className="relative z-10 pt-14">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
