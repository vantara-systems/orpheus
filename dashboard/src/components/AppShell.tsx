import { CloudArrowDown, Pulse, SquaresFour, WarningCircle } from "@phosphor-icons/react"
import React from "react"

export type AppRoute = "overview" | "incidents" | "import" | "detail"

export interface AppShellProps {
  currentRoute?: AppRoute
  breadcrumbLabel?: string
  children: React.ReactNode
}

const NAV_ITEMS: { route: AppRoute; href: string; label: string; icon: React.ElementType }[] = [
  { route: "overview", href: "#/", label: "Overview", icon: SquaresFour },
  { route: "incidents", href: "#/incidents", label: "Incidents", icon: WarningCircle },
  { route: "import", href: "#/import", label: "Import Cloudflare", icon: CloudArrowDown },
]

const PAGE_META: Record<AppRoute, { title: string; subtitle: string }> = {
  overview: { title: "Overview", subtitle: "Service health at a glance" },
  incidents: { title: "Incidents", subtitle: "Open and resolved events" },
  import: { title: "Import Cloudflare", subtitle: "Add zones and Workers to monitoring" },
  detail: { title: "Project detail", subtitle: "Uptime, response time, and analytics" },
}

export function AppShell({ currentRoute = "overview", breadcrumbLabel, children }: AppShellProps) {
  const activeRoute = currentRoute === "detail" ? "overview" : currentRoute
  const meta = PAGE_META[currentRoute]

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)] font-sans antialiased">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="flex h-16 items-center px-5 border-b border-[var(--color-border)]">
          <a
            href="#/"
            className="flex items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-muted)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-[#0b0d10]">
              <Pulse size={19} weight="bold" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">Orpheus</span>
              <span className="block text-xs text-[var(--color-muted)]">Service monitoring</span>
            </span>
          </a>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.route} item={item} active={activeRoute === item.route} />
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--color-border)] text-xs text-[var(--color-muted)]">
          HTTP checks + Cloudflare analytics
        </div>
      </aside>

      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-page)]">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <a
                href="#/"
                className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-[#0b0d10] focus:outline-none focus:ring-2 focus:ring-[var(--color-muted)]"
              >
                <Pulse size={19} weight="bold" />
              </a>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-[var(--color-text)]">{meta.title}</h1>
                <p className="truncate text-xs text-[var(--color-muted)]">{meta.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-3 pb-2" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => (
              <MobileNavLink key={item.route} item={item} active={activeRoute === item.route} />
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {currentRoute === "detail" && (
            <nav aria-label="Breadcrumb" className="mb-4 min-w-0">
              <ol className="flex items-center gap-1.5 text-sm">
                <li>
                  <a
                    href="#/"
                    className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-muted)] rounded"
                  >
                    Overview
                  </a>
                </li>
                <li aria-hidden="true" className="text-[var(--color-muted)]">
                  &gt;
                </li>
                <li
                  aria-current="page"
                  className="truncate font-medium text-[var(--color-text)]"
                >
                  {breadcrumbLabel ?? "Project"}
                </li>
              </ol>
            </nav>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

function NavLink({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const Icon = item.icon
  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-muted)] ${
        active
          ? "bg-[var(--color-hover)] font-medium text-[var(--color-text)]"
          : "font-normal text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
      }`}
    >
      <Icon
        size={18}
        weight={active ? "fill" : "regular"}
        className={active ? "text-[var(--color-accent)]" : ""}
      />
      {item.label}
    </a>
  )
}

function MobileNavLink({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const Icon = item.icon
  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-muted)] ${
        active
          ? "bg-[var(--color-hover)] font-medium text-[var(--color-text)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
      }`}
    >
      <Icon size={14} weight={active ? "fill" : "regular"} />
      {item.label}
    </a>
  )
}

export default AppShell
