'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface ChildGroup {
  id: string;
  name: string;
  level: string;
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
  enrollmentStatus: string;
}

export default function MyChildrenPage() {
  const mounted = useMounted();
  const [groups, setGroups] = useState<ChildGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchChildrenGroups = async () => {
      try {
        const data = await apiFetch<ChildGroup[]>('/groups');
        setGroups(data);
      } catch (err: any) {
        if (err.statusCode === 401) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchChildrenGroups();
  }, [router]);

  if (!mounted || loading) {
    return <div className="text-center py-12 text-gray-500">Chargement des informations...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Espace Parent — Suivi Pédagogique</h1>
          <p className="text-gray-500 mt-1">Consultez les groupes et plannings de vos enfants</p>
        </div>
        <Link href="/my-sessions" className="px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded hover:bg-blue-100 text-sm">
          Planning global des cours
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">Aucun enfant inscrit dans un groupe actif pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map((item) => (
            <div key={`${item.id}-${item.child.id}`} className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2 py-1 bg-purple-100 text-purple-800 rounded">
                  Enfant : {item.child.firstName} {item.child.lastName}
                </span>
                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {item.level}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{item.name}</h2>
              <div className="text-sm text-gray-500 border-t pt-3 flex justify-between">
                <span>Statut : {item.enrollmentStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}