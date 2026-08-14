'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/requests', label: 'Requests' },
  { href: '/missions', label: 'Missions' },
  { href: '/users', label: 'Users' },
  { href: '/reports', label: 'Reports' },
];

function Sidebar() {
  const pathname = usePathname();

  // Don't show sidebar on login page
  if (pathname === '/login') return null;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>ResQAI Admin</div>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? styles.navLinkActive : styles.navLink}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="en">
      <head>
        <title>ResQAI Admin Dashboard</title>
        <meta name="description" content="ResQAI Emergency Relief Administration Dashboard for Sri Lanka" />
      </head>
      <body>
        <div className={styles.container}>
          <Sidebar />
          <main className={isLoginPage ? undefined : styles.main}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
