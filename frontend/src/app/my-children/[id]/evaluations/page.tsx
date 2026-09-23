'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface ChildEvaluationItem {
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

export default function ChildEvaluationsPage({ params }: { params: Promise<{ id: string }> }) {
  const mounted = useMounted();
  const resolvedParams = use(params);
  const studentId = resolvedParams.id;
  const router = useRouter();

  const [evaluations, setEvaluations] = useState<ChildEvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradesHidden, setGradesHidden] = useState(false);

  useEffect(() => {
    const fetchChildEvals = async () => {
      try {
        const data = await apiFetch<ChildEvaluationItem[]>(`/children/${studentId}/evaluations`);
        setEvaluations(data);
      } catch (err: any) {
        if (err.statusCode === 401) {
          router.push('/login');
          return;
        }
        if (err.statusCode === 403) {
          setGradesHidden(true);
          return;
        }
        setError(err.message || 'Erreur lors du chargement des evaluations');
      } finally {
        setLoading(false);
      }
    };
    fetchChildEvals();
  }, [studentId, router]);

  if (!mounted || loading) {
    return <div className="text-center py-16 text-gray-500">Chargement des evaluations de votre enfant...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/my-children" className="text-sm text-purple-600 hover:underline">
              &larr; Retour au suivi de mes enfants
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluations &amp; Notes</h1>
          <p className="text-gray-500 mt-1">Resultats, devoirs et appreciations du professeur de SVT</p>
        </div>

        {!gradesHidden && !error && (
          <Link
            href={`/my-children/${studentId}/progress`}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 shadow-sm transition flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Voir la progression
          </Link>
        )}
      </div>

      {gradesHidden ? (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-4">
          <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-bold text-base mb-1">Acces restreint aux notes</h3>
            <p className="text-sm">La consultation des notes par les parents n&apos;est pas activee actuellement par l&apos;etablissement.</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 font-medium text-lg">Aucune evaluation publiee pour cet eleve</p>
          <p className="text-gray-400 text-sm mt-1">Les evaluations apparaitront ici des que le professeur les aura publiees.</p>
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
                    <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-mono">
                      {ev.type}
                    </span>
                    <span className="text-xs text-gray-400">&bull;</span>
                    <span className="text-xs text-gray-500 font-medium">{ev.group.name}</span>
                    <span className="text-xs text-gray-400">&bull;</span>
                    <span className="text-xs text-gray-500">{dateFormatted}</span>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 mb-1">{ev.title}</h2>

                  {ev.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 mb-2">{ev.description}</p>
                  )}

                  {ev.result?.comment && (
                    <div className="mt-2 bg-amber-50 border-l-2 border-amber-400 px-3 py-1.5 rounded-r text-xs text-amber-900">
                      <strong>Appreciation :</strong> {ev.result.comment}
                    </div>
                  )}
                </div>

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