'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface StudentProfile {
  id: string;
  user: User;
}

interface Enrollment {
  id: string;
  studentId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'COMPLETED';
  startDate: string;
  student: StudentProfile;
}

interface ClassSession {
  id: string;
  startAt: string;
  endAt: string;
  mode: 'PRESENTIEL' | 'ONLINE';
  location?: string;
  meetingUrl?: string;
  notes?: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  level: string;
  capacity: number;
  status: 'ACTIVE' | 'ARCHIVED';
  teacher: {
    user: User;
  };
  enrollments: Enrollment[];
  sessions: ClassSession[];
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const mounted = useMounted();
  const resolvedParams = use(params);
  const groupId = resolvedParams.id;
  const router = useRouter();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentInput, setStudentInput] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd, setSessionEnd] = useState('');
  const [sessionMode, setSessionMode] = useState<'PRESENTIEL' | 'ONLINE'>('PRESENTIEL');
  const [sessionLocation, setSessionLocation] = useState('Salle SVT 1');
  const [sessionUrl, setSessionUrl] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const [onlineModalSessionId, setOnlineModalSessionId] = useState<string | null>(null);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [onlineError, setOnlineError] = useState('');

  const fetchGroup = async () => {
    try {
      const data = await apiFetch<GroupDetail>(`/groups/${groupId}`);
      setGroup(data);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger le groupe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError('');
    setEnrolling(true);
    try {
      const trimmed = studentInput.trim();
      const isEmail = trimmed.includes('@');
      const isPhone = /^[0-9+ \-]+$/.test(trimmed) && trimmed.length >= 6;
      const payload = isEmail
        ? { studentEmail: trimmed }
        : isPhone
        ? { studentPhone: trimmed }
        : { studentId: trimmed };

      await apiFetch(`/groups/${groupId}/enrollments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowEnrollModal(false);
      setStudentInput('');
      fetchGroup();
    } catch (err: any) {
      setEnrollError(Array.isArray(err.message) ? err.message.join(', ') : err.message || "Erreur d'inscription");
    } finally {
      setEnrolling(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError('');
    setCreatingSession(true);
    try {
      await apiFetch(`/groups/${groupId}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          startAt: new Date(sessionStart).toISOString(),
          endAt: new Date(sessionEnd).toISOString(),
          mode: sessionMode,
          location: sessionMode === 'PRESENTIEL' ? sessionLocation : undefined,
          meetingUrl: sessionMode === 'ONLINE' ? sessionUrl : undefined,
          notes: sessionNotes || undefined,
        }),
      });
      setShowSessionModal(false);
      fetchGroup();
    } catch (err: any) {
      setSessionError(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'Erreur de planification');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    if (!confirm('Voulez-vous vraiment annuler cette séance ?')) return;
    try {
      await apiFetch(`/sessions/${sessionId}/cancel`, { method: 'PATCH' });
      fetchGroup();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'annulation");
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      await apiFetch(`/sessions/${sessionId}/complete`, { method: 'PATCH' });
      fetchGroup();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const handleSwitchOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineModalSessionId) return;
    setOnlineError('');
    try {
      await apiFetch(`/sessions/${onlineModalSessionId}/online`, {
        method: 'PATCH',
        body: JSON.stringify({ meetingUrl: onlineUrl }),
      });
      setOnlineModalSessionId(null);
      setOnlineUrl('');
      fetchGroup();
    } catch (err: any) {
      setOnlineError(err.message || 'Erreur');
    }
  };

  const handleArchiveGroup = async () => {
    if (!confirm('Êtes-vous sûr de vouloir archiver ce groupe ? Cette action est irréversible.')) return;
    try {
      await apiFetch(`/groups/${groupId}/archive`, { method: 'PATCH' });
      fetchGroup();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'archivage");
    }
  };

  if (!mounted || loading) return <div className="p-8 text-center text-gray-500">Chargement des détails du groupe...</div>;
  if (error || !group) return <div className="p-8 text-center text-red-600 font-medium">{error || 'Groupe introuvable'}</div>;

  const activeEnrollments = group.enrollments.filter((e) => e.status === 'ACTIVE');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/groups" className="text-blue-600 hover:underline text-sm font-medium">
              &larr; Retour aux groupes
            </Link>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
              {group.level}
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                group.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {group.status === 'ACTIVE' ? 'Actif' : 'Archivé'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mt-2">{group.name}</h1>
          {group.description && <p className="text-gray-600 mt-1">{group.description}</p>}
        </div>

        <div className="flex gap-2">
          {group.status === 'ACTIVE' && (
            <button
              onClick={handleArchiveGroup}
              className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 transition"
            >
              Archiver le groupe
            </button>
          )}
        </div>
      </div>

      {/* Grid: Students & Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enrollments / Students Section */}
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Élèves inscrits</h2>
              <p className="text-sm text-gray-500">
                {activeEnrollments.length} / {group.capacity} places occupées
              </p>
            </div>
            {group.status === 'ACTIVE' && (
              <button
                onClick={() => setShowEnrollModal(true)}
                disabled={activeEnrollments.length >= group.capacity}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                + Inscrire un élève
              </button>
            )}
          </div>

          {group.enrollments.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Aucun élève inscrit dans ce groupe.</p>
          ) : (
            <div className="divide-y">
              {group.enrollments.map((enrollment) => (
                <div key={enrollment.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">
                      {enrollment.student.user.firstName} {enrollment.student.user.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{enrollment.student.user.email}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      enrollment.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {enrollment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sessions Section */}
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Séances de cours</h2>
              <p className="text-sm text-gray-500">{group.sessions.length} séances programmées</p>
            </div>
            {group.status === 'ACTIVE' && (
              <button
                onClick={() => setShowSessionModal(true)}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                + Planifier une séance
              </button>
            )}
          </div>

          {group.sessions.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Aucune séance planifiée.</p>
          ) : (
            <div className="space-y-3">
              {group.sessions.map((session) => {
                const startDate = new Date(session.startAt);
                const endDate = new Date(session.endAt);

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded border ${
                      session.status === 'CANCELLED'
                        ? 'bg-red-50/50 border-red-200 opacity-60'
                        : session.status === 'COMPLETED'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50/40 border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {startDate.toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          Horaires : {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            session.mode === 'ONLINE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {session.mode === 'ONLINE' ? 'En ligne' : 'Présentiel'}
                        </span>
                        <span className="text-xs text-gray-500">{session.status}</span>
                      </div>
                    </div>

                    {session.mode === 'ONLINE' && session.meetingUrl && (
                      <div className="mt-2 text-xs">
                        Lien Visio :{' '}
                        <a
                          href={session.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-600 underline font-medium"
                        >
                          Rejoindre la réunion
                        </a>
                      </div>
                    )}

                    {session.location && session.mode === 'PRESENTIEL' && (
                      <div className="mt-2 text-xs text-gray-600">Lieu : {session.location}</div>
                    )}

                    {session.notes && (
                      <div className="mt-1 text-xs text-gray-500 italic">Programme : {session.notes}</div>
                    )}

                    {session.status === 'SCHEDULED' && (
                      <div className="flex gap-2 mt-3 pt-2 border-t text-xs">
                        {session.mode === 'PRESENTIEL' && group.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setOnlineModalSessionId(session.id);
                              setOnlineUrl('');
                            }}
                            className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
                          >
                            Basculer en ligne
                          </button>
                        )}
                        <button
                          onClick={() => handleCompleteSession(session.id)}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100"
                        >
                          Terminer
                        </button>
                        <button
                          onClick={() => handleCancelSession(session.id)}
                          className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Inscription Élève */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Inscrire un élève</h2>
            {enrollError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{enrollError}</div>}
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email ou Numéro WhatsApp de l'élève *
                </label>
                <input
                  type="text"
                  required
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value)}
                  placeholder="Ex: student@svt.dev ou 0612345678"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Saisissez l'adresse email ou le numéro de téléphone WhatsApp de l'élève.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={enrolling}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {enrolling ? 'Inscription...' : 'Inscrire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Planifier Séance */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Planifier une séance</h2>
            {sessionError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{sessionError}</div>}
            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de début *</label>
                <input
                  type="datetime-local"
                  required
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                  className="w-full p-2 border rounded outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de fin *</label>
                <input
                  type="datetime-local"
                  required
                  value={sessionEnd}
                  onChange={(e) => setSessionEnd(e.target.value)}
                  className="w-full p-2 border rounded outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de cours *</label>
                <select
                  value={sessionMode}
                  onChange={(e) => setSessionMode(e.target.value as any)}
                  className="w-full p-2 border rounded outline-none"
                >
                  <option value="PRESENTIEL">Présentiel</option>
                  <option value="ONLINE">En ligne (Visio)</option>
                </select>
              </div>
              {sessionMode === 'PRESENTIEL' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salle / Lieu</label>
                  <input
                    type="text"
                    value={sessionLocation}
                    onChange={(e) => setSessionLocation(e.target.value)}
                    className="w-full p-2 border rounded outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lien de la réunion (URL) *</label>
                  <input
                    type="url"
                    required
                    value={sessionUrl}
                    onChange={(e) => setSessionUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full p-2 border rounded outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Programme</label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border rounded outline-none"
                  placeholder="Ex: TP SVT"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingSession}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {creatingSession ? 'Planification...' : 'Planifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Basculer en ligne */}
      {onlineModalSessionId && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Basculer la séance en ligne</h2>
            {onlineError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{onlineError}</div>}
            <form onSubmit={handleSwitchOnline} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lien de visioconférence (URL) *</label>
                <input
                  type="url"
                  required
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  placeholder="https://meet.google.com/xyz"
                  className="w-full p-2 border rounded outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setOnlineModalSessionId(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                  Confirmer le passage en ligne
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}