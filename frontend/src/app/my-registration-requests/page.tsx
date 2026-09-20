'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';
}

interface ChildItem {
  id: string; // Group / ParentStudent representation
  child?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface RegistrationRequestItem {
  id: string;
  studentId: string;
  groupId?: string;
  requestedLevel?: string;
  message?: string;
  status: 'PENDING' | 'NEED_INFO' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  teacherMessage?: string;
  responseMessage?: string;
  createdAt: string;
  student?: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  group?: {
    name: string;
    level: string;
  };
}

interface GroupOption {
  id: string;
  name: string;
  level: string;
  status: string;
}

export default function MyRegistrationRequestsPage() {
  const mounted = useMounted();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<RegistrationRequestItem[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [childrenList, setChildrenList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // New Request Form
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [requestTargetType, setRequestTargetType] = useState<'GROUP' | 'LEVEL'>('GROUP');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [requestedLevel, setRequestedLevel] = useState('Terminale');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Respond to info modal
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequestItem | null>(null);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState('');

  const router = useRouter();

  const loadData = async () => {
    try {
      const user = await apiFetch<UserProfile>('/auth/me');
      setCurrentUser(user);

      const reqs = await apiFetch<RegistrationRequestItem[]>('/registration-requests');
      setRequests(reqs);

      const groups = await apiFetch<GroupOption[]>('/groups/available');
      setAvailableGroups(groups);

      if (user.role === 'PARENT') {
        try {
          const myKids = await apiFetch<Array<{ studentId: string; firstName: string; lastName: string; email: string }>>('/parents/my-children');
          const list = myKids.map((k) => ({
            id: k.studentId,
            name: `${k.firstName} ${k.lastName} (${k.email})`,
          }));
          setChildrenList(list);
          if (list.length > 0) {
            setSelectedStudentId(list[0].id);
          }
        } catch (err) {
          console.error('Erreur chargement enfants', err);
        }
      }
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      let targetStudentId = selectedStudentId;

      if (currentUser?.role === 'PARENT') {
        if (!selectedStudentId) {
          throw new Error("Veuillez renseigner ou sélectionner l'enfant concerné");
        }

        if (childrenList.length === 0) {
          // Auto-link child by email/phone
          const linked = await apiFetch<{ studentId: string }>('/parents/link-child', {
            method: 'POST',
            body: JSON.stringify({ studentEmailOrPhone: selectedStudentId }),
          });
          targetStudentId = linked.studentId;
        }
      }

      const payload: any = {
        message: message || undefined,
      };

      if (currentUser?.role === 'PARENT') {
        payload.studentId = targetStudentId;
      }

      if (requestTargetType === 'GROUP') {
        if (!selectedGroupId) {
          throw new Error('Veuillez sélectionner un groupe');
        }
        payload.groupId = selectedGroupId;
      } else {
        if (!requestedLevel) {
          throw new Error('Veuillez spécifier le niveau');
        }
        payload.requestedLevel = requestedLevel;
      }

      await apiFetch('/registration-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowNewModal(false);
      setMessage('');
      loadData();
    } catch (err: any) {
      setFormError(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette demande ?')) return;

    try {
      await apiFetch(`/registration-requests/${id}/cancel`, { method: 'PATCH' });
      loadData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'annulation");
    }
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setRespondError('');
    setResponding(true);

    try {
      await apiFetch(`/registration-requests/${selectedRequest.id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ responseMessage }),
      });
      setShowRespondModal(false);
      setSelectedRequest(null);
      setResponseMessage('');
      loadData();
    } catch (err: any) {
      setRespondError(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'Erreur lors de la réponse');
    } finally {
      setResponding(false);
    }
  };

  if (!mounted || loading) {
    return <div className="text-center py-12 text-gray-500">Chargement de vos demandes...</div>;
  }

  const getStatusBadge = (status: RegistrationRequestItem['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">🟠 En attente de validation</span>;
      case 'NEED_INFO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">🟡 Informations requises</span>;
      case 'ACCEPTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">🟢 Inscription Acceptée</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">🔴 Demande Refusée</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">⚪ Annulée</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Mes Demandes d'Inscription</h1>
          <p className="text-gray-500 mt-1">Suivez le statut de vos demandes de cours de SVT</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/me" className="px-3.5 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium">
            &larr; Mon profil
          </Link>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm transition text-sm"
          >
            + Nouvelle Demande
          </button>
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-4">Vous n'avez soumis aucune demande d'inscription pour le moment.</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            Faire une demande d'inscription
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                <div className="flex items-center gap-3">
                  {req.student && (
                    <span className="font-bold text-gray-900">
                      Élève : {req.student.user.firstName} {req.student.user.lastName}
                    </span>
                  )}
                  {getStatusBadge(req.status)}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(req.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Choix :</span>{' '}
                  {req.group ? (
                    <span className="font-semibold text-blue-700">Groupe {req.group.name} ({req.group.level})</span>
                  ) : (
                    <span className="font-semibold text-purple-700">Niveau souhaité : {req.requestedLevel}</span>
                  )}
                </div>

                {req.message && (
                  <div className="bg-gray-50 p-3 rounded border text-gray-700 text-xs">
                    <span className="font-semibold">Votre message :</span> {req.message}
                  </div>
                )}

                {req.teacherMessage && (
                  <div className={`p-3 rounded border text-xs ${req.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-yellow-50 border-yellow-200 text-yellow-900'}`}>
                    <span className="font-semibold">Message du professeur :</span> {req.teacherMessage}
                  </div>
                )}

                {req.responseMessage && (
                  <div className="bg-blue-50 p-3 rounded border border-blue-200 text-blue-900 text-xs">
                    <span className="font-semibold">Votre réponse :</span> {req.responseMessage}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                {req.status === 'NEED_INFO' && (
                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setResponseMessage('');
                      setShowRespondModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-yellow-500 text-white rounded text-sm font-medium hover:bg-yellow-600 transition"
                  >
                    Répondre au professeur
                  </button>
                )}

                {(req.status === 'PENDING' || req.status === 'NEED_INFO') && (
                  <button
                    onClick={() => handleCancelRequest(req.id)}
                    className="px-3.5 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded font-medium transition"
                  >
                    Annuler la demande
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nouvelle Demande */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-3">Nouvelle demande d'inscription</h2>
            <p className="text-xs text-gray-500 mb-4">
              Votre demande sera examinée par le professeur avant d'être validée.
            </p>
            {formError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{formError}</div>}
            <form onSubmit={handleCreateRequest} className="space-y-4">
              {currentUser?.role === 'PARENT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Élève concerné (votre enfant) *</label>
                  {childrenList.length > 0 ? (
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full p-2 border rounded outline-none"
                    >
                      {childrenList.map((kid) => (
                        <option key={kid.id} value={kid.id}>{kid.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Email ou téléphone de votre enfant"
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full p-2 border rounded outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Indiquez l'email ou le téléphone de compte de votre enfant.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de choix *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={requestTargetType === 'GROUP'}
                      onChange={() => setRequestTargetType('GROUP')}
                    />
                    Groupe spécifique
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={requestTargetType === 'LEVEL'}
                      onChange={() => setRequestTargetType('LEVEL')}
                    />
                    Niveau scolaire uniquement
                  </label>
                </div>
              </div>

              {requestTargetType === 'GROUP' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Groupe souhaité *</label>
                  <select
                    required
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full p-2 border rounded outline-none"
                  >
                    <option value="">Sélectionnez un groupe</option>
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.level})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire *</label>
                  <input
                    type="text"
                    required
                    value={requestedLevel}
                    onChange={(e) => setRequestedLevel(e.target.value)}
                    placeholder="Ex: Terminale, 1ère, 2nde, 3ème..."
                    className="w-full p-2 border rounded outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message / Remarques (Optionnel)</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Précisez les objectifs, disponibilités ou antécédents de l'élève..."
                  className="w-full p-2 border rounded outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Envoi en cours...' : 'Envoyer la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Réponse aux infos */}
      {showRespondModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-2">Répondre au professeur</h2>
            <div className="p-3 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded text-xs">
              <span className="font-semibold">Message du professeur :</span> {selectedRequest.teacherMessage}
            </div>
            {respondError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{respondError}</div>}
            <form onSubmit={handleRespond} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre réponse *</label>
                <textarea
                  required
                  rows={4}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Apportez les précisions demandées par le professeur..."
                  className="w-full p-2 border rounded outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRespondModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={responding}
                  className="px-4 py-2 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 disabled:opacity-50"
                >
                  {responding ? 'Envoi...' : 'Envoyer ma réponse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}