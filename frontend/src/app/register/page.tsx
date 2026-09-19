'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

export default function Register() {
  const mounted = useMounted();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          role,
          phone: phone || undefined,
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      if (err.statusCode === 409) setError('Cet email est déjà utilisé');
      else setError(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'Échec de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-8 bg-white shadow-md rounded w-96 text-center text-gray-500">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="p-8 bg-white shadow-md rounded w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Inscription</h1>
        {error && <div className="mb-4 text-red-600 bg-red-100 p-2 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 text-green-600 bg-green-100 p-2 rounded text-sm">Compte créé avec succès ! En attente d'activation. Redirection vers la connexion...</div>}
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
          <div>
            <label className="block text-sm font-medium mb-1">Téléphone (Optionnel)</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <button type="submit" disabled={loading || success} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Création en cours...' : 'Créer mon compte'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          Vous avez déjà un compte ? <Link href="/login" className="text-blue-600 hover:underline">Se connecter</Link>
        </div>
      </div>
    </div>
  );
}