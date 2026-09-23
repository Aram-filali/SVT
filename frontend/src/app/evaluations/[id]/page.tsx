'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface StudentInfo {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ResultRecord {
  id?: string;
  score: string;
  comment?: string;
  gradedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  updatedAt?: string;
}

interface EligibleStudentItem {
  student: StudentInfo;
  result: ResultRecord | null;
}

interface EvaluationSummary {
  totalEligible: number;
  totalGraded: number;
  minScore: string | null;
  maxScore: string | null;
  averageScore: string | null;
  averagePercentage: string | null;
}

interface EvaluationDetail {
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
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface ResultsResponse {
  evaluation: EvaluationDetail;
  summary: EvaluationSummary;
  results: EligibleStudentItem[];
}

export default function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const evaluationId = resolvedParams.id;

  const mounted = useMounted();
  const router = useRouter();

  const [data, setData] = useState<ResultsResponse | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ResultsResponse>(`/evaluations/${evaluationId}/results`);
      setData(res);

      // Initialize inputs with existing results
      const initialScores: Record<string, string> = {};
      const initialComments: Record<string, string> = {};
      for (const item of res.results) {
        if (item.result) {
          initialScores[item.student.id] = item.result.score;
          initialComments[item.student.id] = item.result.comment || '';
        }
      }
      setScores(initialScores);
      setComments(initialComments);
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Erreur lors du chargement des résultats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [evaluationId]);

  const handleScoreChange = (studentId: string, val: string) => {
    setScores((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleCommentChange = (studentId: string, val: string) => {
    setComments((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleSaveAll = async () => {
    if (!data) return;
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    const payloadResults = [];
    const maxScoreNum = parseFloat(data.evaluation.maxScore);

    for (const item of data.results) {
      const sId = item.student.id;
      const scoreStr = scores[sId]?.trim();
      if (scoreStr !== undefined && scoreStr !== '') {
        const scoreNum = parseFloat(scoreStr);
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScoreNum) {
          setError(
            `La note pour ${item.student.user.firstName} ${item.student.user.lastName} est invalide (doit être entre 0 et ${maxScoreNum}).`,
          );
          setSaving(false);
          return;
        }
        payloadResults.push({
          studentId: sId,
          score: scoreNum,
          comment: comments[sId]?.trim() || undefined,
        });
      }
    }

    if (payloadResults.length === 0) {
      setError('Veuillez saisir au moins une note avant d\'enregistrer.');
      setSaving(false);
      return;
    }

    try {
      const updated = await apiFetch<ResultsResponse>(`/evaluations/${evaluationId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: payloadResults }),
      });
      setData(updated);
      setSuccessMsg('Notes enregistrées avec succès !');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement des notes');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publier cette évaluation ? Les élèves et parents pourront consulter leurs notes.')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/evaluations/${evaluationId}/publish`, { method: 'POST' });
      await fetchResults();
      setSuccessMsg('Évaluation publiée avec succès !');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la publication');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archiver cette évaluation ? Plus aucune note ne pourra être modifiée.')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/evaluations/${evaluationId}/archive`, { method: 'POST' });
      await fetchResults();
      setSuccessMsg('Évaluation archivée.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'archivage');
    } finally {
      setActionLoading(false);
    }
  };

  if (!mounted || loading) {
    return <div className="text-center py-16 text-gray-500">Chargement de l'évaluation...</div>;
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-red-600 mb-4">{error || 'Évaluation introuvable'}</p>
        <Link href="/evaluations" className="text-blue-600 hover:underline">
          ← Retour aux évaluations
        </Link>
      </div>
    );
  }

  const { evaluation, summary, results } = data;
  const isArchived = evaluation.status === 'ARCHIVED';

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Navigation & Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/evaluations" className="text-sm text-blue-600 hover:underline">
            ← Toutes les évaluations
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  evaluation.status === 'PUBLISHED'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : evaluation.status === 'DRAFT'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {evaluation.status === 'PUBLISHED'
                  ? 'Publiée'
                  : evaluation.status === 'DRAFT'
                  ? 'Brouillon'
                  : 'Archivée'}
              </span>
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {evaluation.type}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(evaluation.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{evaluation.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Groupe : <strong className="text-gray-800">{evaluation.group.name}</strong> ({evaluation.group.level})
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {evaluation.status === 'DRAFT' && (
              <button
                onClick={handlePublish}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                Publier l'évaluation
              </button>
            )}

            {!isArchived && (
              <button
                onClick={handleArchive}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                Archiver
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 font-bold ml-4">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm">
          {successMsg}
        </div>
      )}

      {/* Meta info & Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Barème */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 uppercase tracking-wider block font-semibold">Barème & Coeff</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">/{evaluation.maxScore}</span>
            <span className="text-sm text-gray-500">Coeff. {evaluation.coefficient ?? '1.00'}</span>
          </div>
        </div>

        {/* Notés / Éligibles */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 uppercase tracking-wider block font-semibold">Élèves notés</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">{summary.totalGraded}</span>
            <span className="text-sm text-gray-400">/ {summary.totalEligible} éligibles</span>
          </div>
        </div>

        {/* Moyenne groupe */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 uppercase tracking-wider block font-semibold">Moyenne groupe</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {summary.averageScore ? `${summary.averageScore} /${evaluation.maxScore}` : '—'}
            </span>
            {summary.averagePercentage && (
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                {summary.averagePercentage}%
              </span>
            )}
          </div>
        </div>

        {/* Min / Max */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 uppercase tracking-wider block font-semibold">Min / Max</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-700">{summary.minScore ?? '—'}</span>
            <span className="text-gray-300">/</span>
            <span className="text-lg font-bold text-gray-700">{summary.maxScore ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Description if present */}
      {evaluation.description && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
          <strong className="block text-gray-900 mb-1">Consignes :</strong>
          {evaluation.description}
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Feuille de notes</h2>
            <p className="text-xs text-gray-500">Saisissez les notes sur {evaluation.maxScore} points</p>
          </div>
          {!isArchived && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les notes'}
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun élève inscrit dans ce groupe à la date de l'évaluation ({new Date(evaluation.date).toLocaleDateString('fr-FR')}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Élève</th>
                  <th className="py-3 px-4 w-36">Note (/{evaluation.maxScore})</th>
                  <th className="py-3 px-4 w-28">Pourcentage</th>
                  <th className="py-3 px-4">Commentaire pour l'élève</th>
                  <th className="py-3 px-4 w-40 text-right">Dernière modif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map(({ student, result }) => {
                  const currentScore = scores[student.id] ?? '';
                  const scoreNum = parseFloat(currentScore);
                  const maxScoreNum = parseFloat(evaluation.maxScore);
                  const percentage =
                    !isNaN(scoreNum) && maxScoreNum > 0
                      ? ((scoreNum / maxScoreNum) * 100).toFixed(1) + '%'
                      : '—';

                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition">
                      {/* Élève */}
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        <div>{student.user.firstName} {student.user.lastName}</div>
                        <div className="text-xs text-gray-400 font-normal">{student.user.email}</div>
                      </td>

                      {/* Note Input */}
                      <td className="py-3.5 px-4">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={evaluation.maxScore}
                          value={currentScore}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          disabled={isArchived}
                          placeholder="—"
                          className={`w-full border rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 ${
                            isArchived
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                              : 'bg-white border-gray-300 focus:ring-blue-500 text-gray-900'
                          }`}
                        />
                      </td>

                      {/* Pourcentage */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {percentage}
                        </span>
                      </td>

                      {/* Commentaire */}
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={comments[student.id] ?? ''}
                          onChange={(e) => handleCommentChange(student.id, e.target.value)}
                          disabled={isArchived}
                          placeholder="Commentaire ou appréciation..."
                          className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                            isArchived
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                              : 'bg-white border-gray-300 focus:ring-blue-500 text-gray-900'
                          }`}
                        />
                      </td>

                      {/* Dernière modif */}
                      <td className="py-3.5 px-4 text-right text-xs text-gray-400">
                        {result?.updatedAt ? (
                          <div>
                            <div>{new Date(result.updatedAt).toLocaleDateString('fr-FR')}</div>
                            <div className="text-gray-400 font-mono text-[10px]">
                              par {result.gradedBy?.firstName || 'prof'}
                            </div>
                          </div>
                        ) : (
                          <span className="italic text-gray-300">Non noté</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer save */}
        {!isArchived && results.length > 0 && (
          <div className="p-4 border-t bg-gray-50 flex justify-end">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer toutes les notes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}