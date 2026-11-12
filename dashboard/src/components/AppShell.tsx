import React from "react"

export type AppRoute = "overview" | "incidents" | "import" | "detail"

export interface AppShellProps {
  currentRoute?: AppRoute
  children: React.ReactNode
}

export function AppShell({ currentRoute = "overview", children }: AppShellProps) {
  const isDetail = currentRoute === "detail"

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)] font-sans antialiased">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="text-lg font-semibold tracking-tight text-[var(--color-text)] hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-[var(--color-muted)] rounded"
            >
              Orpheus
            </a>
          </div>

          <nav className="flex items-center gap-6" aria-label="Main Navigation">
            {isDetail ? (
              <a
                href="#/"
                className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-muted)] rounded py-2 px-1 flex items-center gap-1.5"
              >
                ← Overview
              </a>
            ) : (
              <>
                <a
                  href="#/"
                  className={`text-sm py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-muted)] rounded ${
                    currentRoute === "overview"
                      ? "font-semibold text-[var(--color-text)] border-b-2 border-[var(--color-text)]"
                      : "font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Overview
                </a>
                <a
                  href="#/incidents"
                  className={`text-sm py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-muted)] rounded ${
                    currentRoute === "incidents"
                      ? "font-semibold text-[var(--color-text)] border-b-2 border-[var(--color-text)]"
                      : "font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Incidents
                </a>
                <a
                  href="#/import"
                  className={`text-sm py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-muted)] rounded ${
                    currentRoute === "import"
                      ? "font-semibold text-[var(--color-text)] border-b-2 border-[var(--color-text)]"
                      : "font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Import Cloudflare
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  )
}

export default AppShell
