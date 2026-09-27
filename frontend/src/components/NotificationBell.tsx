'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface UnreadCountResponse {
  unreadCount: number;
}

export function NotificationBell() {
  const mounted = useMounted();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!mounted) return;

    const fetchCount = async () => {
      try {
        const res = await apiFetch<UnreadCountResponse>('/notifications/unread-count');
        setUnreadCount(res.unreadCount || 0);
      } catch {
        // silent catch
      }
    };

    fetchCount();
    // Poll unread count every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <Link
      href="/notifications"
      className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition inline-flex items-center"
      title="Notifications"
    >
      <span className="text-xl">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}