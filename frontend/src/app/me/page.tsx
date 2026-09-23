'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, setAccessToken } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';
  status: string;
}

export default function Me() {
  const mounted = useMounted();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiFetch<User>('/auth/me');
        setUser(data);
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setAccessToken(null);
      router.push('/login');
    }
  };

  if (!mounted || loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Chargement...</div>;
  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="p-8 bg-white shadow-lg rounded-xl w-full max-w-md border border-gray-100">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">Mon Profil & Espace</h1>
        <div className="space-y-4 mb-6 bg-gray-50 p-4 rounded-lg">
          <div><span className="font-semibold text-gray-700">Nom :</span> {user.firstName} {user.lastName}</div>
          <div><span className="font-semibold text-gray-700">Email :</span> {user.email}</div>
          <div><span className="font-semibold text-gray-700">Rôle :</span> <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-sm">{user.role}</span></div>
          <div>
            <span className="font-semibold text-gray-700">Statut :</span> 
            <span className={`ml-2 px-2 py-0.5 rounded text-sm font-medium ${user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {user.status}
            </span>
          </div>
        </div>

        {/* Shortcuts depending on role */}
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Accès rapide</h2>
          {user.role === 'TEACHER' && (
            <>
              <Link href="/registration-requests" className="block w-full text-center bg-amber-600 text-white p-2.5 rounded font-medium hover:bg-amber-700 transition">
                Demandes d'inscription
              </Link>
              <Link href="/groups" className="block w-full text-center bg-blue-600 text-white p-2.5 rounded font-medium hover:bg-blue-700 transition">
                Gérer mes Groupes & Séances
              </Link>
              <Link href="/evaluations" className="block w-full text-center bg-violet-600 text-white p-2.5 rounded font-medium hover:bg-violet-700 transition">
                Évaluations & Notes
              </Link>
              <Link href="/my-sessions" className="block w-full text-center bg-gray-100 text-gray-700 p-2 rounded text-sm hover:bg-gray-200 transition font-medium">
                Planning global
              </Link>
            </>
          )}

          {user.role === 'STUDENT' && (
            <>
              <Link href="/my-registration-requests" className="block w-full text-center bg-indigo-600 text-white p-2.5 rounded font-medium hover:bg-indigo-700 transition">
                Mes Demandes d'Inscription
              </Link>
              <Link href="/my-groups" className="block w-full text-center bg-blue-600 text-white p-2.5 rounded font-medium hover:bg-blue-700 transition">
                Mes Groupes de SVT
              </Link>
              <Link href="/my-evaluations" className="block w-full text-center bg-violet-600 text-white p-2.5 rounded font-medium hover:bg-violet-700 transition">
                Mes Évaluations & Notes
              </Link>
              <Link href="/my-progress" className="block w-full text-center bg-fuchsia-600 text-white p-2.5 rounded font-medium hover:bg-fuchsia-700 transition">
                Ma Progression
              </Link>
              <Link href="/my-sessions" className="block w-full text-center bg-emerald-600 text-white p-2.5 rounded font-medium hover:bg-emerald-700 transition">
                Mon Planning & Séances
              </Link>
              <Link href="/my-attendances" className="block w-full text-center bg-teal-600 text-white p-2.5 rounded font-medium hover:bg-teal-700 transition">
                Historique de mes Présences
              </Link>
            </>
          )}

          {user.role === 'PARENT' && (
            <>
              <Link href="/my-registration-requests" className="block w-full text-center bg-indigo-600 text-white p-2.5 rounded font-medium hover:bg-indigo-700 transition">
                Mes Demandes d'Inscription
              </Link>
              <Link href="/my-children" className="block w-full text-center bg-purple-600 text-white p-2.5 rounded font-medium hover:bg-purple-700 transition">
                Suivi de mes enfants
              </Link>
              <Link href="/my-attendances" className="block w-full text-center bg-teal-600 text-white p-2.5 rounded font-medium hover:bg-teal-700 transition">
                Suivi des Présences
              </Link>
              <Link href="/my-sessions" className="block w-full text-center bg-blue-600 text-white p-2.5 rounded font-medium hover:bg-blue-700 transition">
                Planning des cours
              </Link>
            </>
          )}

          {user.role === 'ADMIN' && (
            <>
              <Link href="/registration-requests" className="block w-full text-center bg-amber-600 text-white p-2.5 rounded font-medium hover:bg-amber-700 transition">
                Gestion des Demandes d'Inscription
              </Link>
              <Link href="/groups" className="block w-full text-center bg-blue-600 text-white p-2.5 rounded font-medium hover:bg-blue-700 transition">
                Administration des Groupes
              </Link>
              <Link href="/my-sessions" className="block w-full text-center bg-gray-100 text-gray-700 p-2 rounded text-sm hover:bg-gray-200 transition font-medium">
                Planning global
              </Link>
            </>
          )}
        </div>

        <button onClick={handleLogout} className="w-full bg-red-600 text-white p-2.5 rounded font-medium hover:bg-red-700 transition">
          Déconnexion
        </button>
      </div>
    </div>
  );
}