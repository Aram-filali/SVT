'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface StudentGroup {
  id: string;
  name: string;
  description?: string;
  level: string;
  status: 'ACTIVE' | 'ARCHIVED';
  enrollmentStatus: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'COMPLETED';
  enrollmentStartDate: string;
  enrollmentEndDate?: string;
  teacher?: {
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export default function MyGroupsPage() {
  const mounted = useMounted();
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();

  const fetchGroups = async (includeHistory: boolean) => {
    setLoading(true);
    try {
      const data = await apiFetch<StudentGroup[]>(`/groups${includeHistory ? '?includeHistory=true' : ''}`);
      setGroups(data);
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups(showHistory);
  }, [showHistory]);

  if (!mounted || loading) {
    return <div className="text-center py-12 text-gray-500">Chargement de vos groupes...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Groupes de SVT</h1>
          <p className="text-gray-500 mt-1">Consultez vos groupes de cours et vos professeurs</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/my-sessions" className="px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded hover:bg-blue-100 transition text-sm">
            Mon planning de séances
          </Link>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer bg-gray-50 px-3 py-2 rounded border">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Inclure l'historique</span>
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">Vous n'êtes actuellement inscrit dans aucun groupe actif.</p>
          {!showHistory && (
            <button
              onClick={() => setShowHistory(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Afficher les groupes passés (historique)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map((group) => (
            <div key={group.id} className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded">
                  {group.level}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded ${
                    group.enrollmentStatus === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Statut : {group.enrollmentStatus}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h2>
              {group.description && <p className="text-gray-600 text-sm mb-4">{group.description}</p>}
              {group.teacher && (
                <div className="text-sm text-gray-600 border-t pt-3 flex items-center justify-between">
                  <span>Enseignant : <strong className="text-gray-900">{group.teacher.user.firstName} {group.teacher.user.lastName}</strong></span>
                  <span className="text-xs text-gray-500">{group.teacher.user.email}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}