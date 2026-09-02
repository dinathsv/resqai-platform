'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import styles from './layout.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/requests', label: 'Requests' },
  { href: '/missions', label: 'Missions' },
  { href: '/users', label: 'Users' },
  { href: '/reports', label: 'Reports' },
];

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>ResQAI Admin</div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            ✕
          </button>
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
                {item.label}
              </Link>
            );
          })}
        </nav>
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
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className={isLoginPage ? undefined : styles.main}>
            {isLoginPage || authChecked ? children : null}
          </main>
        </div>
      </body>
    </html>
  );
}

