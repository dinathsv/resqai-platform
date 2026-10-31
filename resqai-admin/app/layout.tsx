"use client";

import "./globals.css";

import Link from "next/link";
import Image from "next/image";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useSyncExternalStore } from "react";

import Cookies from "js-cookie";
import styles from "./layout.module.css";
import { AUTH_EVENT } from "@/lib/auth-events";
import { disconnectSocket } from "@/lib/socket";

// ---------------------------------------------
// Types and constants
// ---------------------------------------------

type Theme = "light" | "dark";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/requests", label: "Requests" },
  { href: "/missions", label: "Missions" },
  { href: "/goods", label: "Goods & Deliveries" },
  { href: "/coordination", label: "Agency Coordination" },
  { href: "/users", label: "Users" },
  { href: "/guest-verification", label: "NIC Verification" },
  { href: "/reports", label: "Reports" },
];

const THEME_EVENT = "resqai-theme-change";

// ---------------------------------------------
// Browser state subscriptions
// ---------------------------------------------

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("resqai-theme");
  return saved === "dark" ? "dark" : "light";
}

function getServerTheme(): Theme {
  return "light";
}

function subscribeAuth(callback: () => void) {
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("focus", callback);
  window.addEventListener("pageshow", callback);

  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("focus", callback);
    window.removeEventListener("pageshow", callback);
  };
}

function getAuthSnapshot(): boolean {
  return Boolean(Cookies.get("admin_token"));
}

function getServerAuthSnapshot(): boolean {
  return false;
}

// ---------------------------------------------
// Sidebar
// ---------------------------------------------

function Sidebar({ isOpen, onClose, theme, onToggleTheme }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    Cookies.remove("admin_token", { path: "/" });
    localStorage.removeItem('admin_token');
    disconnectSocket();

    window.dispatchEvent(new Event(AUTH_EVENT));

    onClose();
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.logoGroup}>
            <Image
              src="/resqai_logo.png"
              alt="ResQAI Logo"
              width={32}
              height={32}
              className={styles.logoIcon}
            />

            <div>
              <div className={styles.sidebarTitle}>ResQAI</div>

              <div className={styles.sidebarSubtitle}>Admin Panel</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <button
              type="button"
              className={styles.themeToggle}
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close menu"
            >
              Close
            </button>
          </div>
        </div>

        <div className={styles.telemetryStatus}>
          <span className={styles.telemetryDot} />
          <span className={styles.telemetryLabel}>TELEMETRY ACTIVE</span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? styles.navLinkActive : styles.navLink}
                onClick={onClose}
              >
                <span className={styles.navLabel}>{item.label}</span>

                {isActive && <span className={styles.activePill} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminBadge}>
            <div className={styles.adminAvatar}>A</div>

            <div className={styles.adminInfo}>
              <div className={styles.adminName}>Admin</div>

              <div className={styles.adminRole}>Coordinator</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`outline ${styles.logoutBtn}`}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------
// Application layout
// ---------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerTheme,
  );

  const hasToken = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );

  const canViewPage = isLoginPage || hasToken;

  // -------------------------------------------
  // Synchronize document theme
  // -------------------------------------------

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // -------------------------------------------
  // Theme switching
  // -------------------------------------------

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";

    localStorage.setItem("resqai-theme", next);

    window.dispatchEvent(new Event(THEME_EVENT));
  };

  // -------------------------------------------
  // Authentication navigation
  // -------------------------------------------

  useEffect(() => {
    if (!isLoginPage && !hasToken) {
      router.replace("/login");
    }
  }, [isLoginPage, hasToken, router]);

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>ResQAI Admin</title>

        <meta
          name="description"
          content="ResQAI Emergency Relief Administration Panel"
        />

        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('resqai-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`,
          }}
        />
      </head>

      <body>
        <div className={styles.container}>
          {!isLoginPage && hasToken && (
            <button
              type="button"
              className={styles.hamburger}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              Menu
            </button>
          )}

          {!isLoginPage && hasToken && (
            <Sidebar
              key={pathname}
              isOpen={sidebarOpen}
              onClose={closeSidebar}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          )}

          <main className={isLoginPage ? styles.mainLogin : styles.main}>
            {canViewPage ? children : null}
          </main>
        </div>
      </body>
    </html>
  );
}
