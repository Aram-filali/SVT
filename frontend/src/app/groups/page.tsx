'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Group {
  id: string;
  name: string;
  description?: string;
  level: string;
  capacity: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  _count?: {
    enrollments: number;
    sessions: number;
  };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('Terminale');
  const [capacity, setCapacity] = useState(15);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const fetchGroups = async () => {
    try {
      const data = await apiFetch<Group[]>('/groups');
      setGroups(data);
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description || undefined,
          level,
          capacity: Number(capacity),
        }),
      });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      fetchGroups();
    } catch (err: any) {
      setError(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-gray-600">Chargement des groupes...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestion des Groupes Pédagogiques</h1>
          <p className="text-gray-500 mt-1">Créez et gérez vos groupes d'élèves, inscriptions et séances</p>
        </div>
        <div className="flex gap-4">
          <Link href="/my-sessions" className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            Planning global
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition"
          >
            + Nouveau Groupe
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-4">Aucun groupe créé pour le moment</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Créer votre premier groupe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className={`block p-6 rounded-lg border transition hover:shadow-lg ${
                group.status === 'ARCHIVED'
                  ? 'bg-gray-50 border-gray-200 opacity-75'
                  : 'bg-white border-gray-200 hover:border-blue-400'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {group.level}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    group.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {group.status === 'ACTIVE' ? 'Actif' : 'Archivé'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h2>
              {group.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{group.description}</p>
              )}
              <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-3 mt-auto">
                <span>
                  👥 {group._count?.enrollments ?? 0} / {group.capacity} élèves
                </span>
                <span>📅 {group._count?.sessions ?? 0} séances</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Créer un nouveau groupe</h2>
            {error && (
              <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">{error}</div>
            )}
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du groupe *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: SVT Terminale Groupe A"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire *</label>
                <input
                  type="text"
                  required
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="Ex: Terminale, 1ère, 2nde, 3ème..."
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacité maximale *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnelle)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Objectifs, prérequis, etc."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Création...' : 'Créer le groupe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
