'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
}

interface RegistrationRequestItem {
  id: string;
  studentId: string;
  parentId?: string;
  groupId?: string;
  requestedLevel?: string;
  message?: string;
  status: 'PENDING' | 'NEED_INFO' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  teacherMessage?: string;
  responseMessage?: string;
  processedAt?: string;
  createdAt: string;
  student: {
    user: UserInfo;
  };
  parent?: {
    user: UserInfo;
  };
  group?: {
    id: string;
    name: string;
    level: string;
    capacity: number;
  };
  processedBy?: UserInfo;
}

interface GroupOption {
  id: string;
  name: string;
  level: string;
  capacity: number;
  status: string;
}

interface PendingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  createdAt: string;
}

export default function RegistrationRequestsPage() {
  const mounted = useMounted();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [requests, setRequests] = useState<RegistrationRequestItem[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<GroupOption[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'PENDING_USERS'>('REQUESTS');
  const [adminActionStatus, setAdminActionStatus] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequestItem | null>(null);

  // Accept modal
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptGroupId, setAcceptGroupId] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  // Request info modal
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [requestingInfo, setRequestingInfo] = useState(false);
  const [infoError, setInfoError] = useState('');

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const loadCurrentUser = async () => {
    try {
      const me = await apiFetch<UserInfo>('/auth/me');
      setCurrentUser(me);
      if (me.role === 'ADMIN') {
        loadPendingUsers();
      }
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      }
    }
  };

  const loadPendingUsers = async () => {
    try {
      const data = await apiFetch<PendingUser[]>('/admin/users/pending');
      setPendingUsers(data);
    } catch (err) {
      console.error('Erreur chargement comptes en attente', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const url = filterStatus === 'ALL' ? '/registration-requests' : `/registration-requests?status=${filterStatus}`;
      const data = await apiFetch<RegistrationRequestItem[]>(url);
      setRequests(data);
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await apiFetch<GroupOption[]>('/groups/available');
      setTeacherGroups(data.filter((g) => g.status === 'ACTIVE'));
    } catch (err) {
      console.error('Erreur chargement groupes', err);
    }
  };

  useEffect(() => {
    loadCurrentUser();
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const handleActivateUser = async (userId: string) => {
    setAdminActionStatus(null);
    try {
      await apiFetch(`/admin/users/${userId}/activate`, { method: 'PATCH' });
      setAdminActionStatus({ id: userId, msg: 'Compte activé avec succès !', type: 'success' });
      loadPendingUsers();
    } catch (err: any) {
      setAdminActionStatus({ id: userId, msg: err.message || 'Erreur activation', type: 'error' });
    }
  };

  const handleRejectUser = async (userId: string) => {
    setAdminActionStatus(null);
    try {
      await apiFetch(`/admin/users/${userId}/reject`, { method: 'PATCH' });
      setAdminActionStatus({ id: userId, msg: 'Compte rejeté / suspendu.', type: 'success' });
      loadPendingUsers();
    } catch (err: any) {
      setAdminActionStatus({ id: userId, msg: err.message || 'Erreur rejet', type: 'error' });
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setAcceptError('');
    setAccepting(true);

    try {
      const targetGroupId = acceptGroupId || selectedRequest.groupId;
      await apiFetch(`/registration-requests/${selectedRequest.id}/accept`, {
        method: 'PATCH',
        body: JSON.stringify(targetGroupId ? { groupId: targetGroupId } : {}),
      });
      setShowAcceptModal(false);
      setSelectedRequest(null);
      setAcceptGroupId('');
      fetchRequests();
    } catch (err: any) {
      setAcceptError(Array.isArray(err.message) ? err.message.join(', ') : err.message || "Erreur lors de l'acceptation");
    } finally {
      setAccepting(false);
    }
  };

  const handleRequestInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setInfoError('');
    setRequestingInfo(true);

    try {
      await apiFetch(`/registration-requests/${selectedRequest.id}/request-info`, {
        method: 'PATCH',
        body: JSON.stringify({ teacherMessage: infoMessage }),
      });
      setShowInfoModal(false);
      setSelectedRequest(null);
      setInfoMessage('');
      fetchRequests();
    } catch (err: any) {
      setInfoError(Array.isArray(err.message) ? err.message.join(', ') : err.message || "Erreur lors de la demande d'information");
    } finally {
      setRequestingInfo(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setRejectError('');
    setRejecting(true);

    try {
      await apiFetch(`/registration-requests/${selectedRequest.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectReason('');
      fetchRequests();
    } catch (err: any) {
      setRejectError(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'Erreur lors du rejet');
    } finally {
      setRejecting(false);
    }
  };

  if (!mounted || loading) {
    return <div className="text-center py-12 text-gray-500">Chargement des demandes d'inscription...</div>;
  }

  const getStatusBadge = (status: RegistrationRequestItem['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">🟠 En attente</span>;
      case 'NEED_INFO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">🟡 Infos demandées</span>;
      case 'ACCEPTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">🟢 Acceptée</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">🔴 Refusée</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">⚪ Annulée</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {currentUser?.role === 'ADMIN' ? 'Gestion des Inscriptions & Comptes' : "Demandes d'inscription"}
          </h1>
          <p className="text-gray-500 mt-1">
            {currentUser?.role === 'ADMIN'
              ? 'Validez les nouveaux comptes et traitez les demandes d\'inscription aux groupes.'
              : 'Gérez et validez les demandes d\'inscription soumises par les parents et élèves.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/me" className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium">
            &larr; Mon profil
          </Link>
          <Link href="/groups" className="px-4 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm font-medium">
            Voir les groupes
          </Link>
        </div>
      </div>

      {/* Admin navigation switch */}
      {currentUser?.role === 'ADMIN' && (
        <div className="flex gap-3 bg-gray-100 p-1.5 rounded-lg max-w-md">
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              activeTab === 'REQUESTS' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Demandes de cours ({requests.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('PENDING_USERS');
              loadPendingUsers();
            }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              activeTab === 'PENDING_USERS' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Comptes à activer ({pendingUsers.length})
          </button>
        </div>
      )}

      {/* SECTION 1: ADMIN PENDING USERS */}
      {activeTab === 'PENDING_USERS' && currentUser?.role === 'ADMIN' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
            <strong>Activation des nouveaux comptes :</strong> Les utilisateurs inscrits restent en statut PENDING jusqu'à validation manuelle par l'administrateur.
          </div>

          {pendingUsers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">Aucun compte en attente de validation.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
              <table className="min-w-[700px] w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-700 font-semibold whitespace-nowrap">
                  <tr>
                    <th className="px-6 py-3 text-left">Utilisateur</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Rôle</th>
                    <th className="px-6 py-3 text-left">Téléphone</th>
                    <th className="px-6 py-3 text-left">Date d'inscription</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{u.phone || '—'}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        {adminActionStatus?.id === u.id && (
                          <span className={`inline-block mr-2 text-xs font-medium ${adminActionStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {adminActionStatus.msg}
                          </span>
                        )}
                        <button
                          onClick={() => handleActivateUser(u.id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-semibold"
                        >
                          Activer
                        </button>
                        <button
                          onClick={() => handleRejectUser(u.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-semibold"
                        >
                          Refuser
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: REGISTRATION REQUESTS */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-6">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {[
              { label: 'Toutes les demandes', value: 'ALL' },
              { label: 'En attente', value: 'PENDING' },
              { label: 'Infos demandées', value: 'NEED_INFO' },
              { label: 'Acceptées', value: 'ACCEPTED' },
              { label: 'Refusées', value: 'REJECTED' },
              { label: 'Annulées', value: 'CANCELLED' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
                  filterStatus === tab.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Requests List */}
          {requests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">Aucune demande d'inscription dans cette catégorie.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 text-lg">
                        {req.student.user.firstName} {req.student.user.lastName}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                    <span className="text-xs text-gray-400">
                      Soumise le {new Date(req.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Contact élève :</span>{' '}
                      <span className="font-medium text-gray-800">{req.student.user.email}</span>
                      {req.student.user.phone && <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">Tel: {req.student.user.phone}</span>}
                    </div>

                    {req.parent && (
                      <div>
                        <span className="text-gray-500">Parent responsable :</span>{' '}
                        <span className="font-medium text-gray-800">{req.parent.user.firstName} {req.parent.user.lastName}</span>{' '}
                        <span className="text-xs text-gray-500">({req.parent.user.email})</span>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-500">Cible demandée :</span>{' '}
                      {req.group ? (
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Groupe : {req.group.name} ({req.group.level})
                        </span>
                      ) : (
                        <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                          Niveau souhaité : {req.requestedLevel}
                        </span>
                      )}
                    </div>

                    {req.message && (
                      <div className="md:col-span-2 bg-gray-50 p-3 rounded border text-gray-700">
                        <span className="font-semibold text-gray-900">Message :</span> {req.message}
                      </div>
                    )}

                    {req.teacherMessage && (
                      <div className="md:col-span-2 bg-amber-50 p-3 rounded border border-amber-200 text-amber-900">
                        <span className="font-semibold">Message enseignant :</span> {req.teacherMessage}
                      </div>
                    )}

                    {req.responseMessage && (
                      <div className="md:col-span-2 bg-blue-50 p-3 rounded border border-blue-200 text-blue-900">
                        <span className="font-semibold">Réponse du demandeur :</span> {req.responseMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(req.status === 'PENDING' || req.status === 'NEED_INFO') && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t justify-end">
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setInfoMessage(req.teacherMessage || '');
                          setShowInfoModal(true);
                        }}
                        className="px-3.5 py-1.5 text-sm bg-yellow-50 text-yellow-800 border border-yellow-300 rounded font-medium hover:bg-yellow-100 transition"
                      >
                        Demander des informations
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setRejectReason('');
                          setShowRejectModal(true);
                        }}
                        className="px-3.5 py-1.5 text-sm bg-red-50 text-red-700 border border-red-300 rounded font-medium hover:bg-red-100 transition"
                      >
                        Refuser
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setAcceptGroupId(req.groupId || '');
                          setShowAcceptModal(true);
                        }}
                        className="px-4 py-1.5 text-sm bg-green-600 text-white rounded font-medium hover:bg-green-700 shadow-sm transition"
                      >
                        Accepter et Inscrire
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Acceptation */}
      {showAcceptModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-3">Accepter la demande d'inscription</h2>
            <p className="text-sm text-gray-600 mb-4">
              L'élève <strong>{selectedRequest.student.user.firstName} {selectedRequest.student.user.lastName}</strong> sera automatiquement inscrit dans le groupe sélectionné.
            </p>
            {acceptError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{acceptError}</div>}
            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Groupe d'affectation *</label>
                <select
                  required
                  value={acceptGroupId}
                  onChange={(e) => setAcceptGroupId(e.target.value)}
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Sélectionnez un groupe</option>
                  {teacherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.level}) — Capacité : {g.capacity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={accepting}
                  className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {accepting ? 'Validation...' : 'Confirmer l\'inscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Demande d'infos */}
      {showInfoModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-3">Demander des informations complémentaires</h2>
            <p className="text-sm text-gray-600 mb-4">
              Indiquez les détails ou documents manquants nécessaires pour traiter la demande.
            </p>
            {infoError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{infoError}</div>}
            <form onSubmit={handleRequestInfo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message pour le demandeur *</label>
                <textarea
                  required
                  rows={4}
                  value={infoMessage}
                  onChange={(e) => setInfoMessage(e.target.value)}
                  placeholder="Ex: Merci de préciser le lycée d'origine et vos disponibilités pour les séances du samedi..."
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={requestingInfo}
                  className="px-4 py-2 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 disabled:opacity-50"
                >
                  {requestingInfo ? 'Envoi...' : 'Envoyer la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rejet */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-3">Refuser la demande</h2>
            <p className="text-sm text-gray-600 mb-4">
              Veuillez indiquer le motif du refus. Cette information sera communiquée au demandeur.
            </p>
            {rejectError && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{rejectError}</div>}
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motif du refus *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Tous les groupes de ce niveau sont complets pour ce trimestre..."
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {rejecting ? 'Traitement...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}