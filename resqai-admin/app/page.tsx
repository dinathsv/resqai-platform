'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get('admin_token');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
