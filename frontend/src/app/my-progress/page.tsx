'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface HistoryItem {
  evaluationId: string;
  title: string;
  type: string;
  date: string;
  score: string;
  maxScore: string;
  coefficient: string | null;
  effectiveCoefficient: string;
  normalizedPercentage: string;
  comment?: string;
  groupId: string;
  groupName: string;
}

interface GroupProgression {
  group: {
    id: string;
    name: string;
    level: string;
  };
  count: number;
  averagePercentage: string;
  minPercentage: string;
  maxPercentage: string;
  evolution: string | null;
  history: HistoryItem[];
}

interface ProgressionData {
  count: number;
  averagePercentage: string | null;
  minPercentage: string | null;
  maxPercentage: string | null;
  evolution: string | null;
  history: HistoryItem[];
  byGroup: Record<string, GroupProgression>;
}

export default function MyProgressPage() {
  const mounted = useMounted();
  const router = useRouter();

  const [data, setData] = useState<ProgressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await apiFetch<ProgressionData>('/students/me/progression');
        setData(res);
      } catch (err: any) {
        if (err.statusCode === 401) {
          router.push('/login');
          return;
        }
        setError(err.message || 'Erreur lors du chargement de la progression');
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [router]);

  if (!mounted || loading) {
    return <div className="text-center py-16 text-gray-500">Calcul de votre progression...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/my-evaluations" className="text-sm text-blue-600 hover:underline">
              ← Retour à mes évaluations
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Ma Progression en SVT</h1>
          <p className="text-gray-500 mt-1">Indicateurs de progression, moyenne générale pondérée et évolution</p>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 mb-6">{error}</div>
      ) : !data || data.count === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p className="text-gray-600 font-medium text-lg">Aucun résultat disponible pour calculer la progression</p>
          <p className="text-gray-400 text-sm mt-1">Vos indicateurs apparaîtront dès que vos premières notes seront enregistrées.</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {/* Moyenne Générale Pondérée */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Moyenne globale pondérée
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600">
                  {data.averagePercentage}%
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-1 block">
                Normalisée sur l'ensemble des barèmes
              </span>
            </div>

            {/* Évolution */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Évolution récente
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                {data.evolution ? (
                  <span
                    className={`text-3xl font-black ${
                      data.evolution.startsWith('+')
                        ? 'text-green-600'
                        : data.evolution.startsWith('-')
                        ? 'text-red-600'
                        : 'text-gray-800'
                    }`}
                  >
                    {data.evolution} pts
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-gray-400">N/A</span>
                )}
              </div>
              <span className="text-xs text-gray-400 mt-1 block">
                Points de pourcentage vs devoir précédent
              </span>
            </div>

            {/* Meilleure & Moins bonne note */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Min. / Max. obtenus
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-700">{data.minPercentage}%</span>
                <span className="text-gray-300">/</span>
                <span className="text-xl font-bold text-emerald-600">{data.maxPercentage}%</span>
              </div>
              <span className="text-xs text-gray-400 mt-1 block">
                Plage de performance
              </span>
            </div>

            {/* Nombre d'évaluations */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Évaluations comptabilisées
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-gray-900">{data.count}</span>
                <span className="text-sm text-gray-500">notée(s)</span>
              </div>
              <span className="text-xs text-gray-400 mt-1 block">
                Exclut les brouillons
              </span>
            </div>
          </div>

          {/* Breakdown By Group */}
          {Object.keys(data.byGroup).length > 1 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Progression par groupe</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.byGroup).map(([gId, g]) => (
                  <div key={gId} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900">{g.group.name}</h3>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                        {g.group.level}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-3 rounded-lg mt-3 text-xs">
                      <div>
                        <span className="text-gray-400 block">Moyenne</span>
                        <span className="font-bold text-blue-700 text-sm">{g.averagePercentage}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Évolution</span>
                        <span className="font-bold text-gray-800 text-sm">{g.evolution ? `${g.evolution} pts` : '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Évaluations</span>
                        <span className="font-bold text-gray-800 text-sm">{g.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Timeline / Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Historique chronologique des résultats</h2>
              <p className="text-xs text-gray-500">Par ordre de passage des épreuves</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Évaluation</th>
                    <th className="py-3 px-4">Groupe</th>
                    <th className="py-3 px-4 text-center">Note brute</th>
                    <th className="py-3 px-4 text-center">Pourcentage</th>
                    <th className="py-3 px-4 text-center">Coeff.</th>
                    <th className="py-3 px-4">Appréciation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.history.map((item) => (
                    <tr key={item.evaluationId} className="hover:bg-gray-50 transition">
                      <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {item.title}
                        <span className="ml-2 text-xs font-normal text-gray-400 font-mono">[{item.type}]</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600">{item.groupName}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-900">
                        {item.score} <span className="text-xs font-normal text-gray-400">/{item.maxScore}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                          {item.normalizedPercentage}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-500 font-mono">
                        {item.effectiveCoefficient}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600 italic">
                        {item.comment || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}