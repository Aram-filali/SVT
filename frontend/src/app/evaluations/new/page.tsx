'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface GroupOption {
  id: string;
  name: string;
  level: string;
}

interface SessionOption {
  id: string;
  startAt: string;
  mode: string;
}

function NewEvaluationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultGroupId = searchParams.get('groupId') || '';

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupId, setGroupId] = useState(defaultGroupId);
  const [sessionId, setSessionId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('TEST');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxScore, setMaxScore] = useState('20');
  const [coefficient, setCoefficient] = useState('1');

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await apiFetch<GroupOption[]>('/groups');
        setGroups(data);
        if (!groupId && data.length > 0) {
          setGroupId(data[0].id);
        }
      } catch {
        // silent catch
      }
    };
    fetchGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!groupId) {
      setSessions([]);
      setSessionId('');
      return;
    }
    const fetchSessions = async () => {
      try {
        const data = await apiFetch<SessionOption[]>(`/class-sessions?groupId=${groupId}`);
        setSessions(data);
      } catch {
        setSessions([]);
      }
    };
    fetchSessions();
  }, [groupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        date: new Date(date).toISOString(),
        maxScore: parseFloat(maxScore),
        groupId,
      };

      if (coefficient && parseFloat(coefficient) > 0) {
        payload.coefficient = parseFloat(coefficient);
      }

      if (sessionId) {
        payload.sessionId = sessionId;
      }

      const created: { id: string } = await apiFetch('/evaluations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(`/evaluations/${created.id}`);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || "Erreur lors de la creation de l'evaluation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/evaluations" className="text-sm text-blue-600 hover:underline">
          &larr; Retour aux evaluations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Creer une nouvelle evaluation</h1>
        <p className="text-gray-500 text-sm">Definissez le bareme, la date et le groupe concerne</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        {/* Groupe */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Groupe d&apos;eleves <span className="text-red-500">*</span>
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selectionnez un groupe</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.level})
              </option>
            ))}
          </select>
        </div>

        {/* Titre & Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Titre de l&apos;evaluation <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: DS 1 Genetique mendelienne"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TEST">Controle / Test (TEST)</option>
              <option value="EXAM">Examen (EXAM)</option>
              <option value="QUIZ">Interrogation (QUIZ)</option>
              <option value="HOMEWORK">Devoir maison (HOMEWORK)</option>
              <option value="PRACTICAL">Travaux Pratiques (PRACTICAL)</option>
              <option value="OTHER">Autre (OTHER)</option>
            </select>
          </div>
        </div>

        {/* Date & Seance optionnelle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Date de l&apos;evaluation <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400 mt-0.5 block">
              Determine l&apos;eligibilite historique des inscriptions
            </span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Seance rattachee <span className="text-xs text-gray-400">(optionnelle)</span>
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucune seance specifique</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.startAt).toLocaleString('fr-FR')} ({s.mode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bareme & Coefficient */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Bareme maximal (maxScore) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400 text-sm">/</span>
              <input
                type="number"
                step="0.25"
                min="0.1"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="20"
                required
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-gray-400 mt-0.5 block">ex: 20, 10, 40</span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Coefficient <span className="text-xs text-gray-400">(defaut: 1.00)</span>
            </label>
            <input
              type="number"
              step="0.25"
              min="0.1"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              placeholder="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400 mt-0.5 block">Ponderation dans la progression</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Description / Consignes <span className="text-xs text-gray-400">(optionnel)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Consignes particulieres, chapitres revises..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t flex justify-end gap-3">
          <Link
            href="/evaluations"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition disabled:opacity-50"
          >
            {loading ? "Creation en cours..." : "Creer l'evaluation"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewEvaluationPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-500">Chargement du formulaire...</div>}>
      <NewEvaluationForm />
    </Suspense>
  );
}