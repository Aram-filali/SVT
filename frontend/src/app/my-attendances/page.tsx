'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useMounted } from '@/lib/useMounted';

interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note?: string;
  createdAt: string;
  session: {
    id: string;
    startAt: string;
    endAt: string;
    mode: 'PRESENTIEL' | 'ONLINE';
    location?: string;
    group: {
      id: string;
      name: string;
    };
  };
}

interface ParentChildGroup {
  student: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  attendances: AttendanceRecord[];
}

export default function MyAttendancesPage() {
  const mounted = useMounted();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentAttendances, setStudentAttendances] = useState<AttendanceRecord[] | null>(null);
  const [parentGroups, setParentGroups] = useState<ParentChildGroup[] | null>(null);

  useEffect(() => {
    const fetchAttendanceHistory = async () => {
      try {
        const data = await apiFetch<any>('/attendances/my-history');
        if (Array.isArray(data)) {
          if (data.length > 0 && 'student' in data[0] && 'attendances' in data[0]) {
            // Parent response (array of { student, attendances })
            setParentGroups(data as ParentChildGroup[]);
          } else {
            // Student response (array of AttendanceRecord)
            setStudentAttendances(data as AttendanceRecord[]);
          }
        } else if (data && 'student' in data && 'attendances' in data) {
          // Single child parent response
          setParentGroups([data as ParentChildGroup]);
        } else {
          setStudentAttendances([]);
        }
      } catch (err: any) {
        if (err.statusCode === 401) {
          router.push('/login');
        } else {
          setError(err.message || 'Impossible de charger les présences');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceHistory();
  }, [router]);

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'PRESENT':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">Présent</span>;
      case 'ABSENT':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Absent</span>;
      case 'LATE':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">En retard</span>;
      case 'EXCUSED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Excusé</span>;
    }
  };

  if (!mounted || loading) {
    return <div className="p-8 text-center text-gray-500">Chargement de l'historique des présences...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
            <Link href="/me" className="hover:underline">
              &larr; Mon profil
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Historique des présences</h1>
          <p className="text-sm text-gray-500">Suivi des séances et assiduité aux cours de SVT</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {/* Parent View */}
      {parentGroups && (
        <div className="space-y-6">
          {parentGroups.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
              Aucun enfant lié ou aucun historique de présence disponible.
            </div>
          ) : (
            parentGroups.map((group) => {
              const total = group.attendances.length;
              const presents = group.attendances.filter((a) => a.status === 'PRESENT').length;
              const absents = group.attendances.filter((a) => a.status === 'ABSENT').length;
              const lates = group.attendances.filter((a) => a.status === 'LATE').length;
              const excused = group.attendances.filter((a) => a.status === 'EXCUSED').length;

              return (
                <div key={group.student.id} className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {group.student.user.firstName} {group.student.user.lastName}
                      </h2>
                      <p className="text-xs text-gray-500">{total} séance(s) enregistrée(s)</p>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded">
                        {presents} Présence(s)
                      </span>
                      <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded">
                        {absents} Absence(s)
                      </span>
                      {lates > 0 && (
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                          {lates} Retard(s)
                        </span>
                      )}
                      {excused > 0 && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          {excused} Excusé(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {group.attendances.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">Aucune présence enregistrée pour cet élève.</p>
                  ) : (
                    <div className="divide-y">
                      {group.attendances.map((att) => {
                        const date = new Date(att.session.startAt);
                        return (
                          <div key={att.id} className="py-3 flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">
                                {att.session.group?.name || 'Séance'} —{' '}
                                {date.toLocaleDateString('fr-FR', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} •{' '}
                                {att.session.mode === 'ONLINE' ? 'En ligne' : att.session.location || 'Présentiel'}
                              </div>
                              {att.note && <div className="text-xs text-gray-600 mt-1 italic">Note : {att.note}</div>}
                            </div>
                            <div>{getStatusBadge(att.status)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Student View */}
      {studentAttendances && (
        <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Mes présences aux séances</h2>

          {studentAttendances.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Aucun enregistrement de présence pour le moment.</p>
          ) : (
            <div className="divide-y">
              {studentAttendances.map((att) => {
                const date = new Date(att.session.startAt);
                return (
                  <div key={att.id} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {att.session.group?.name || 'Séance'} —{' '}
                        {date.toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {att.session.mode === 'ONLINE' ? 'En ligne' : att.session.location || 'Présentiel'}
                      </div>
                      {att.note && <div className="text-xs text-gray-600 mt-1 italic">Note : {att.note}</div>}
                    </div>
                    <div>{getStatusBadge(att.status)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
