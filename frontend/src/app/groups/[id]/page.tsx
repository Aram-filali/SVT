'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getAccessToken } from '@/lib/api';
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
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
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

interface Resource {
  id: string;
  title: string;
  description?: string;
  type: 'PDF' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'LINK' | 'OTHER';
  storageKey?: string;
  externalUrl?: string;
  mimeType?: string;
  fileSize?: number;
  groupId?: string;
  sessionId?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note?: string;
  student: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
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
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals - Enroll
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentInput, setStudentInput] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Modals - Session
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd, setSessionEnd] = useState('');
  const [sessionMode, setSessionMode] = useState<'PRESENTIEL' | 'ONLINE'>('PRESENTIEL');
  const [sessionLocation, setSessionLocation] = useState('Salle SVT 1');
  const [sessionUrl, setSessionUrl] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  // Modals - Online Switch
  const [onlineModalSessionId, setOnlineModalSessionId] = useState<string | null>(null);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [onlineError, setOnlineError] = useState('');

  // Modals - Resource
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceType, setResourceType] = useState<'PDF' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'LINK' | 'OTHER'>('PDF');
  const [resourceExternalUrl, setResourceExternalUrl] = useState('');
  const [resourceSessionId, setResourceSessionId] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceError, setResourceError] = useState('');
  const [uploadingResource, setUploadingResource] = useState(false);

  // Modals - Attendance Roll Call
  const [attendanceSession, setAttendanceSession] = useState<ClassSession | null>(null);
  const [attendanceList, setAttendanceList] = useState<Array<{ studentId: string; name: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; note: string }>>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');

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

  const fetchResources = async () => {
    try {
      const data = await apiFetch<Resource[]>(`/resources?groupId=${groupId}`);
      setResources(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchResources();
  }, [groupId]);

  // Handlers - Enroll
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

  // Handlers - Sessions
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

  // Handlers - Resources
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setResourceError('');
    setUploadingResource(true);

    try {
      if (resourceType === 'LINK') {
        await apiFetch('/resources', {
          method: 'POST',
          body: JSON.stringify({
            title: resourceTitle,
            description: resourceDescription || undefined,
            type: 'LINK',
            externalUrl: resourceExternalUrl,
            groupId,
            sessionId: resourceSessionId || undefined,
          }),
        });
      } else {
        if (!resourceFile) {
          throw new Error('Veuillez sélectionner un fichier');
        }
        const formData = new FormData();
        formData.append('title', resourceTitle);
        if (resourceDescription) formData.append('description', resourceDescription);
        formData.append('type', resourceType);
        formData.append('groupId', groupId);
        if (resourceSessionId) formData.append('sessionId', resourceSessionId);
        formData.append('file', resourceFile);

        await apiFetch('/resources', {
          method: 'POST',
          body: formData,
        });
      }

      setShowResourceModal(false);
      setResourceTitle('');
      setResourceDescription('');
      setResourceType('PDF');
      setResourceExternalUrl('');
      setResourceFile(null);
      setResourceSessionId('');
      fetchResources();
    } catch (err: any) {
      setResourceError(Array.isArray(err.message) ? err.message.join(', ') : err.message || "Erreur lors de l'ajout");
    } finally {
      setUploadingResource(false);
    }
  };

  const handleArchiveResource = async (resourceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir archiver cette ressource ?')) return;
    try {
      await apiFetch(`/resources/${resourceId}/archive`, { method: 'PATCH' });
      fetchResources();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'archivage");
    }
  };

  const handleDownloadResource = async (resource: Resource) => {
    if (resource.type === 'LINK' && resource.externalUrl) {
      window.open(resource.externalUrl, '_blank');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/resources/${resource.id}/download`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Téléchargement impossible');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du téléchargement');
    }
  };

  // Handlers - Attendance
  const openAttendanceModal = async (session: ClassSession) => {
    setAttendanceSession(session);
    setAttendanceLoading(true);
    setAttendanceError('');

    try {
      const records = await apiFetch<AttendanceRecord[]>(`/sessions/${session.id}/attendance`);
      const recordMap = new Map(records.map((r) => [r.studentId, r]));

      const activeStudents = (group?.enrollments || [])
        .filter((e) => e.status === 'ACTIVE')
        .map((e) => {
          const rec = recordMap.get(e.studentId);
          return {
            studentId: e.studentId,
            name: `${e.student.user.firstName} ${e.student.user.lastName}`,
            status: rec?.status || 'PRESENT',
            note: rec?.note || '',
          };
        });

      setAttendanceList(activeStudents);
    } catch (err: any) {
      setAttendanceError(err.message || 'Erreur lors du chargement des présences');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceSession) return;
    setAttendanceSaving(true);
    setAttendanceError('');

    try {
      await apiFetch(`/sessions/${attendanceSession.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({
          attendances: attendanceList.map((a) => ({
            studentId: a.studentId,
            status: a.status,
            note: a.note || undefined,
          })),
        }),
      });
      setAttendanceSession(null);
    } catch (err: any) {
      setAttendanceError(Array.isArray(err.message) ? err.message.join(', ') : err.message || "Erreur d'enregistrement");
    } finally {
      setAttendanceSaving(false);
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

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/evaluations?groupId=${groupId}`}
            className="px-3 py-2 text-sm text-violet-700 border border-violet-200 rounded hover:bg-violet-50 transition font-medium"
          >
            📝 Évaluations du groupe
          </Link>
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

                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t text-xs">
                      {session.status !== 'CANCELLED' && group.status === 'ACTIVE' && (
                        <button
                          onClick={() => openAttendanceModal(session)}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 font-medium"
                        >
                          📋 Faire l'appel
                        </button>
                      )}

                      {session.status === 'SCHEDULED' && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resources Section */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ressources pédagogiques</h2>
            <p className="text-sm text-gray-500">{resources.length} ressources disponibles</p>
          </div>
          {group.status === 'ACTIVE' && (
            <button
              onClick={() => setShowResourceModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Ajouter une ressource
            </button>
          )}
        </div>

        {resources.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Aucune ressource partagée pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((res) => (
              <div key={res.id} className="p-4 border rounded-lg hover:shadow-md transition flex flex-col justify-between bg-gray-50/50">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                      {res.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(res.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{res.title}</h3>
                  {res.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{res.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Ajouté par {res.uploadedBy.firstName} {res.uploadedBy.lastName}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t">
                  <button
                    onClick={() => handleDownloadResource(res)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {res.type === 'LINK' ? '🔗 Ouvrir le lien' : '📥 Télécharger'}
                  </button>

                  {group.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleArchiveResource(res.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Archiver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* Modal Ajouter Ressource */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Ajouter une ressource</h2>
            {resourceError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{resourceError}</div>}
            <form onSubmit={handleCreateResource} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la ressource *</label>
                <input
                  type="text"
                  required
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="Ex: Fiche de révision Chapitre 2"
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnelle)</label>
                <textarea
                  value={resourceDescription}
                  onChange={(e) => setResourceDescription(e.target.value)}
                  rows={2}
                  placeholder="Détails ou consignes pour les élèves..."
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de ressource *</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as any)}
                    className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PDF">PDF</option>
                    <option value="DOCUMENT">Document</option>
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Vidéo</option>
                    <option value="LINK">Lien externe</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Séance associée (optionnel)</label>
                  <select
                    value={resourceSessionId}
                    onChange={(e) => setResourceSessionId(e.target.value)}
                    className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Aucune séance (Groupe entier) --</option>
                    {group.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.startAt).toLocaleDateString('fr-FR')} - {s.notes || s.mode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {resourceType === 'LINK' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL externe *</label>
                  <input
                    type="url"
                    required
                    value={resourceExternalUrl}
                    onChange={(e) => setResourceExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fichier à téléverser *</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                    className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingResource ? 'Envoi en cours...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Faire l'appel */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Feuille de présence (Appel)</h2>
                <p className="text-xs text-gray-500">
                  Séance du {new Date(attendanceSession.startAt).toLocaleDateString('fr-FR')} (
                  {new Date(attendanceSession.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(attendanceSession.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                </p>
              </div>
              <button
                onClick={() => setAttendanceSession(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            {attendanceError && <div className="p-3 my-3 bg-red-100 text-red-700 rounded text-sm">{attendanceError}</div>}

            {attendanceLoading ? (
              <div className="py-8 text-center text-gray-500">Chargement de la liste d'appel...</div>
            ) : attendanceList.length === 0 ? (
              <div className="py-8 text-center text-gray-500">Aucun élève inscrit actif dans ce groupe.</div>
            ) : (
              <form onSubmit={handleSaveAttendance} className="space-y-4 overflow-y-auto flex-1 py-4">
                <div className="space-y-3">
                  {attendanceList.map((item, idx) => (
                    <div key={item.studentId} className="p-3 bg-gray-50 border rounded-lg space-y-2">
                      <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((status) => (
                          <label
                            key={status}
                            className={`px-3 py-1.5 rounded cursor-pointer border font-medium transition ${
                              item.status === status
                                ? status === 'PRESENT'
                                  ? 'bg-green-600 text-white border-green-600'
                                  : status === 'ABSENT'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : status === 'LATE'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`attendance-${item.studentId}`}
                              value={status}
                              checked={item.status === status}
                              onChange={() => {
                                const next = [...attendanceList];
                                next[idx].status = status;
                                setAttendanceList(next);
                              }}
                              className="hidden"
                            />
                            {status === 'PRESENT' && 'Présent'}
                            {status === 'ABSENT' && 'Absent'}
                            {status === 'LATE' && 'En retard'}
                            {status === 'EXCUSED' && 'Excusé'}
                          </label>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Remarque / note (optionnelle)..."
                        value={item.note}
                        onChange={(e) => {
                          const next = [...attendanceList];
                          next[idx].note = e.target.value;
                          setAttendanceList(next);
                        }}
                        className="w-full p-1.5 text-xs border rounded bg-white outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setAttendanceSession(null)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    disabled={attendanceSaving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {attendanceSaving ? 'Enregistrement...' : 'Enregistrer les présences'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}