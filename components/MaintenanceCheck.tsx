'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function MaintenanceCheck({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check maintenance mode
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.maintenanceMode && !pathname?.startsWith('/admin') && pathname !== '/maintenance') {
          router.push('/maintenance');
        } else if (data.maintenanceMode === false && pathname === '/maintenance') {
          router.push('/');
        }
      })
      .catch(() => {
        // Ignore errors, allow site to function
      });
  }, [pathname, router]);

  return <>{children}</>;
}

