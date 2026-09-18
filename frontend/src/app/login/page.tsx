'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, setAccessToken } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(res.accessToken);
      router.push('/me');
    } catch (err: any) {
      if (err.statusCode === 401) setError('Identifiants incorrects');
      else if (err.statusCode === 403) setError('Compte en attente, suspendu ou archivé');
      else if (err.statusCode === 429) setError('Trop de tentatives. Réessayez plus tard.');
      else setError(err.message || 'La connexion a échoué');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-8 bg-white shadow-md rounded w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Connexion</h1>
        {error && <div className="mb-4 text-red-600 bg-red-100 p-2 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" required />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Chargement...' : 'Se connecter'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          Pas encore de compte ? <Link href="/register" className="text-blue-600 hover:underline">S'inscrire</Link>
        </div>
      </div>
    </div>
  );
}
