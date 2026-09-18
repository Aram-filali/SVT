'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, password, role }),
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
      setError(msg || 'L\'inscription a échoué');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="p-8 bg-white shadow-md rounded w-[32rem]">
        <h1 className="text-2xl font-bold mb-6 text-center">Inscription</h1>
        {error && <div className="mb-4 text-red-600 bg-red-100 p-2 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 text-green-700 bg-green-100 p-2 rounded text-sm">Compte créé avec succès. Votre compte est en attente d'activation.</div>}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prénom</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border p-2 rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border p-2 rounded" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rôle</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full border p-2 rounded">
                <option value="STUDENT">Élève</option>
                <option value="PARENT">Parent</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Chargement...' : 'S\'inscrire'}
            </button>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          Déjà un compte ? <Link href="/login" className="text-blue-600 hover:underline">Se connecter</Link>
        </div>
      </div>
    </div>
  );
}
