'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface SessionPlanning {
  id: string;
  startAt: string;
  endAt: string;
  mode: 'PRESENTIEL' | 'ONLINE';
  location?: string;
  meetingUrl?: string;
  notes?: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  group: {
    id: string;
    name: string;
    level: string;
  };
}

export default function MySessionsPage() {
  const mounted = useMounted();
  const [sessions, setSessions] = useState<SessionPlanning[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchPlanning = async () => {
      try {
        const data = await apiFetch<SessionPlanning[]>('/sessions');
        setSessions(data);
      } catch (err: any) {
        if (err.statusCode === 401) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPlanning();
  }, [router]);

  if (!mounted || loading) {
    return <div className="text-center py-12 text-gray-500">Chargement du planning...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Planning des Séances</h1>
          <p className="text-gray-500 mt-1">Vos prochaines séances de cours de SVT</p>
        </div>
        <Link href="/me" className="text-sm text-blue-600 hover:underline font-medium">
          &larr; Mon profil
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">Aucune séance planifiée pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const start = new Date(session.startAt);
            const end = new Date(session.endAt);

            return (
              <div
                key={session.id}
                className={`p-5 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  session.status === 'CANCELLED'
                    ? 'bg-red-50/40 border-red-200 opacity-60'
                    : session.status === 'COMPLETED'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-blue-200 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900 text-lg">{session.group.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {session.group.level}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-800">
                    Date : {start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-sm text-gray-600">
                    Horaires : {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {session.notes && <div className="text-xs text-gray-500 mt-1 italic">Programme : {session.notes}</div>}
                </div>

                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-semibold ${
                        session.mode === 'ONLINE' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {session.mode === 'ONLINE' ? 'En ligne' : 'Présentiel'}
                    </span>
                    <span className="text-xs text-gray-500">{session.status}</span>
                  </div>

                  {session.mode === 'ONLINE' && session.meetingUrl && session.status === 'SCHEDULED' && (
                    <a
                      href={session.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded font-medium hover:bg-purple-700 transition"
                    >
                      Rejoindre le cours
                    </a>
                  )}

                  {session.location && session.mode === 'PRESENTIEL' && (
                    <span className="text-xs text-gray-600">Lieu : {session.location}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}