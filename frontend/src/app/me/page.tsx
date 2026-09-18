'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setAccessToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

export default function Me() {
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

  if (loading) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>;
  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="p-8 bg-white shadow-md rounded w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Mon Profil</h1>
        <div className="space-y-4 mb-6">
          <div><span className="font-semibold">Nom:</span> {user.firstName} {user.lastName}</div>
          <div><span className="font-semibold">Email:</span> {user.email}</div>
          <div><span className="font-semibold">Rôle:</span> {user.role}</div>
          <div>
            <span className="font-semibold">Statut:</span> 
            <span className={`ml-2 px-2 py-1 rounded text-sm ${user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {user.status}
            </span>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700">
          Déconnexion
        </button>
      </div>
    </div>
  );
}
