import React from "react"

export type AppRoute = "overview" | "incidents" | "import" | "detail"

export interface AppShellProps {
  currentRoute?: AppRoute
  children: React.ReactNode
}

export function AppShell({ currentRoute = "overview", children }: AppShellProps) {
  const isDetail = currentRoute === "detail"

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#111111] font-sans antialiased">
      {/* Header */}
      <header className="border-b border-[#e6e9ee] bg-[#ffffff]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="text-lg font-semibold tracking-tight text-[#111111] hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-gray-400 rounded"
            >
              Orpheus
            </a>
          </div>

          <nav className="flex items-center gap-6" aria-label="Main Navigation">
            {isDetail ? (
              <a
                href="#/"
                className="text-sm font-medium text-[#5b6573] hover:text-[#111111] transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 rounded py-2 px-1 flex items-center gap-1.5"
              >
                ← Overview
              </a>
            ) : (
              <>
                <a
                  href="#/"
                  className={`text-sm py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 rounded ${
                    currentRoute === "overview"
                      ? "font-semibold text-[#111111] border-b-2 border-[#111111]"
                      : "font-medium text-[#5b6573] hover:text-[#111111]"
                  }`}
                >
                  Overview
                </a>
                <a
                  href="#/incidents"
                  className={`text-sm py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 rounded ${
                    currentRoute === "incidents"
                      ? "font-semibold text-[#111111] border-b-2 border-[#111111]"
                      : "font-medium text-[#5b6573] hover:text-[#111111]"
                  }`}
                >
                  Incidents
                </a>
                <a
                  href="#/import"
                  className={`text-sm py-4 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 rounded ${
                    currentRoute === "import"
                      ? "font-semibold text-[#111111] border-b-2 border-[#111111]"
                      : "font-medium text-[#5b6573] hover:text-[#111111]"
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
