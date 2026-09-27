'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface NotificationItem {
  id: string;
  userId: string;
  type: 'REGISTRATION_REQUEST' | 'EVALUATION' | 'EVALUATION_RESULT' | 'RESOURCE' | 'CLASS_SESSION' | 'SYSTEM';
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  };
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) {
      return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays < 7) return `Il y a ${diffDays} jours`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getTypeBadge(type: NotificationItem['type']) {
  switch (type) {
    case 'REGISTRATION_REQUEST':
      return {
        label: "Inscription",
        icon: '👥',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'EVALUATION':
      return {
        label: 'Évaluation',
        icon: '📝',
        color: 'bg-violet-100 text-violet-800 border-violet-200',
      };
    case 'EVALUATION_RESULT':
      return {
        label: 'Note',
        icon: '🎯',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'RESOURCE':
      return {
        label: 'Ressource',
        icon: '📁',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
      };
    case 'CLASS_SESSION':
      return {
        label: 'Cours',
        icon: '📅',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      };
    case 'SYSTEM':
    default:
      return {
        label: 'Système',
        icon: '🔔',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
      };
  }
}

export default function NotificationsPage() {
  const mounted = useMounted();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (filter === 'UNREAD') {
        params.set('isRead', 'false');
      }

      const res = await apiFetch<NotificationsResponse>(`/notifications?${params.toString()}`);
      setNotifications(res.data);
      setTotalPages(res.meta.totalPages);
      setUnreadCount(res.meta.unreadCount);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Impossible de charger les notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    if (mounted) {
      fetchNotifications();
    }
  }, [mounted, fetchNotifications]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await apiFetch(`/notifications/${notif.id}/read`, { method: 'PATCH' });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silent catch
      }
    }

    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors du marquage des notifications');
    } finally {
      setMarkingAll(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
        <div>
          <Link href="/me" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mb-1">
            <span>&larr;</span> Retour à mon profil
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Centre de notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Suivez en temps réel les cours, évaluations et demandes</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll || loading}
            className="self-start md:self-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            <span>✓✓</span>
            {markingAll ? 'Marquage en cours...' : 'Tout marquer comme lu'}
          </button>
        )}
      </div>

      {/* Tabs & Filters */}
      <div className="flex gap-2 mb-6 border-b border-gray-100 pb-2">
        <button
          onClick={() => {
            setFilter('ALL');
            setPage(1);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Toutes les notifications
        </button>
        <button
          onClick={() => {
            setFilter('UNREAD');
            setPage(1);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            filter === 'UNREAD'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span>Non lues uniquement</span>
          {unreadCount > 0 && (
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                filter === 'UNREAD' ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchNotifications} className="underline text-sm font-medium ml-4">
            Réessayer
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-2 bg-gray-100 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl p-8">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-lg font-semibold text-gray-900">Aucune notification</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {filter === 'UNREAD'
              ? 'Vous avez lu toutes vos notifications. Tout est à jour !'
              : "Vous n'avez reçu aucune notification pour le moment."}
          </p>
          {filter === 'UNREAD' && (
            <button
              onClick={() => setFilter('ALL')}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:underline font-medium"
            >
              Afficher toutes les notifications
            </button>
          )}
        </div>
      ) : (
        /* Notifications List */
        <div className="space-y-3">
          {notifications.map((notif) => {
            const badge = getTypeBadge(notif.type);
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`group relative bg-white border rounded-xl p-4 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md ${
                  notif.isRead
                    ? 'border-gray-200 hover:border-gray-300 opacity-80'
                    : 'border-blue-300 bg-blue-50/20 hover:border-blue-400'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Type Icon Badge */}
                  <div className="text-2xl flex-shrink-0 mt-0.5" title={badge.label}>
                    {badge.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      <h4
                        className={`text-sm font-semibold truncate ${
                          notif.isRead ? 'text-gray-800' : 'text-gray-950 font-bold'
                        }`}
                      >
                        {notif.title}
                      </h4>
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed break-words">{notif.message}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{formatRelativeTime(notif.createdAt)}</span>
                      {notif.link && (
                        <span className="text-blue-600 group-hover:underline inline-flex items-center gap-0.5">
                          Consulter &rarr;
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notif.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 mt-2" title="Non lu" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 font-medium"
          >
            &larr; Précédent
          </button>
          <span className="text-gray-500">
            Page <strong className="text-gray-900">{page}</strong> sur <strong className="text-gray-900">{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 font-medium"
          >
            Suivant &rarr;
          </button>
        </div>
      )}
    </div>
  );
}