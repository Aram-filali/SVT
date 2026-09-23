'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface MyEvaluationItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  date: string;
  maxScore: string;
  coefficient?: string | null;
  status: 'PUBLISHED' | 'ARCHIVED';
  group: {
    id: string;
    name: string;
    level: string;
  };
  result?: {
    id: string;
    score: string;
    comment?: string;
    updatedAt: string;
  } | null;
}

export default function MyEvaluationsPage() {
  const mounted = useMounted();
  const router = useRouter();

  const [evaluations, setEvaluations] = useState<MyEvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvals = async () => {
      try {
        const data = await apiFetch<MyEvaluationItem[]>('/students/me/evaluations');
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
    fetchEvals();
  }, [router]);

  if (!mounted || loading) {
    return <div className="text-center py-16 text-gray-500">Chargement de vos évaluations...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/me" className="text-sm text-blue-600 hover:underline">
              ← Retour au profil
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Évaluations & Notes</h1>
          <p className="text-gray-500 mt-1">Consultez vos devoirs, interrogations et appréciations</p>
        </div>

        <Link
          href="/my-progress"
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Voir ma progression globale
        </Link>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 font-medium text-lg">Aucune évaluation disponible pour l'instant</p>
          <p className="text-gray-400 text-sm mt-1">Vos évaluations publiées s'afficheront ici dès leur parution.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {evaluations.map((ev) => {
            const dateFormatted = new Date(ev.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            const hasResult = ev.result !== null && ev.result !== undefined;
            const scoreNum = hasResult ? parseFloat(ev.result!.score) : 0;
            const maxScoreNum = parseFloat(ev.maxScore);
            const percentage = hasResult && maxScoreNum > 0 ? ((scoreNum / maxScoreNum) * 100).toFixed(1) : null;

            return (
              <div
                key={ev.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                      {ev.type}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 font-medium">{ev.group.name}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{dateFormatted}</span>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 mb-1">{ev.title}</h2>

                  {ev.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 mb-2">{ev.description}</p>
                  )}

                  {ev.result?.comment && (
                    <div className="mt-2 bg-amber-50 border-l-2 border-amber-400 px-3 py-1.5 rounded-r text-xs text-amber-900">
                      <strong>Appréciation :</strong> {ev.result.comment}
                    </div>
                  )}
                </div>

                {/* Score badge */}
                <div className="flex flex-row md:flex-col items-end gap-1 shrink-0 bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-lg w-full md:w-auto justify-between md:justify-center">
                  <span className="text-xs text-gray-400 block md:text-right">
                    Coeff. {ev.coefficient ?? '1.00'}
                  </span>

                  {hasResult ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-gray-900">
                        {ev.result!.score}
                        <span className="text-sm font-semibold text-gray-400">/{ev.maxScore}</span>
                      </span>
                      {percentage && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {percentage}%
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm italic text-gray-400 bg-gray-100 px-3 py-1 rounded">
                      En attente de correction
                    </div>
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