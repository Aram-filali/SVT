'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface EvaluationItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  date: string;
  maxScore: string;
  coefficient?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  groupId: string;
  group: {
    id: string;
    name: string;
    level: string;
  };
  session?: {
    id: string;
    startAt: string;
    mode: string;
  };
  _count?: {
    results: number;
  };
}

interface GroupOption {
  id: string;
  name: string;
  level: string;
}

export default function EvaluationsListPage() {
  const mounted = useMounted();
  const router = useRouter();

  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvaluations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedGroup) params.append('groupId', selectedGroup);
      if (selectedStatus) params.append('status', selectedStatus);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<EvaluationItem[]>(`/evaluations${queryStr}`);
      setEvaluations(data);
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Erreur lors du chargement des évaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await apiFetch<GroupOption[]>('/groups');
        setGroups(data);
      } catch {
        // silent catch
      }
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchEvaluations();
  }, [selectedGroup, selectedStatus]);

  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/me" className="text-sm text-blue-600 hover:underline">
              ← Retour au profil
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Évaluations & Résultats</h1>
          <p className="text-gray-500 mt-1">Gérez les devoirs, interrogations, barèmes et notes des élèves</p>
        </div>
        <Link
          href="/evaluations/new"
          className="px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Créer une évaluation
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrer par groupe</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous mes groupes</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.level})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrer par statut</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="DRAFT">Brouillon (DRAFT)</option>
            <option value="PUBLISHED">Publiée (PUBLISHED)</option>
            <option value="ARCHIVED">Archivée (ARCHIVED)</option>
          </select>
        </div>

        {(selectedGroup || selectedStatus) && (
          <button
            onClick={() => {
              setSelectedGroup('');
              setSelectedStatus('');
            }}
            className="mt-5 text-sm text-gray-500 hover:text-gray-800 underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement des évaluations...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 font-medium text-lg">Aucune évaluation trouvée</p>
          <p className="text-gray-400 text-sm mt-1">Créez votre première évaluation pour ce groupe.</p>
          <Link
            href="/evaluations/new"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Créer une évaluation
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evaluations.map((ev) => {
            const dateFormatted = new Date(ev.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return (
              <div
                key={ev.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        ev.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : ev.status === 'DRAFT'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {ev.status === 'PUBLISHED'
                        ? 'Publiée'
                        : ev.status === 'DRAFT'
                        ? 'Brouillon'
                        : 'Archivée'}
                    </span>
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {ev.type}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 line-clamp-1 mb-1">{ev.title}</h2>
                  <p className="text-xs text-gray-500 mb-3">{ev.group.name} • {dateFormatted}</p>

                  {ev.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 bg-gray-50 p-2 rounded">
                      {ev.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg mb-4">
                    <div>
                      <span className="text-gray-400 block">Barème</span>
                      <span className="font-semibold text-gray-900">/{ev.maxScore}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Coefficient</span>
                      <span className="font-semibold text-gray-900">{ev.coefficient ?? '1.00 (défaut)'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {ev._count?.results !== undefined ? `${ev._count.results} note(s) saisie(s)` : ''}
                  </span>
                  <Link
                    href={`/evaluations/${ev.id}`}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium rounded-md transition"
                  >
                    Gérer & Noter →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}