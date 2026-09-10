'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import styles from './layout.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Command Center' },
  { href: '/alerts', label: 'Disaster Alerts' },
  { href: '/requests', label: 'Live Triage' },
  { href: '/missions', label: 'Rescue Missions' },
  { href: '/users', label: 'Personnel & Volunteers' },
  { href: '/reports', label: 'Situational Intel' },
];

function Sidebar({ isOpen, onClose, theme, onToggleTheme }: { isOpen: boolean; onClose: () => void; theme: string; onToggleTheme: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  const handleLogout = () => {
    Cookies.remove('admin_token');
    router.replace('/login');
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoGroup}>
            <div className={styles.logoIcon}>🛡️</div>
            <div>
              <div className={styles.sidebarTitle}>ResQAI Ops</div>
              <div className={styles.sidebarSubtitle}>Disaster Response Sri Lanka</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className={styles.themeToggle} onClick={onToggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.telemetryStatus}>
          <span className={styles.telemetryDot} />
          <span className={styles.telemetryLabel}>TELEMETRY ACTIVE</span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? styles.navLinkActive : styles.navLink}
                onClick={onClose}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {isActive && <span className={styles.activePill} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminBadge}>
            <div className={styles.adminAvatar}>HQ</div>
            <div className={styles.adminInfo}>
              <div className={styles.adminName}>DMC Coordinator</div>
              <div className={styles.adminRole}>Level 5 Clearance</div>
            </div>
          </div>
          <button onClick={handleLogout} className={`outline ${styles.logoutBtn}`}>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('resqai-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('resqai-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }

    const token = Cookies.get('admin_token');
    if (!token) {
      router.replace('/login');
    } else {
      setAuthChecked(true);
    }
  }, [pathname, isLoginPage, router]);

  return (
    <html lang="en">
      <head>
        <title>ResQAI Admin Dashboard</title>
        <meta name="description" content="ResQAI Emergency Relief Administration Dashboard for Sri Lanka" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className={styles.container}>
          {!isLoginPage && authChecked && (
            <button
              className={styles.hamburger}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
          <main className={isLoginPage ? styles.mainLogin : styles.main}>
            {isLoginPage || authChecked ? children : null}
          </main>
        </div>
      </body>
    </html>
  );
}

