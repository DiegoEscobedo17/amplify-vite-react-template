import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { getCurrentUser } from 'aws-amplify/auth';

const client = generateClient<Schema>();

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Usa la identidad actual y consulta el perfil
        await getCurrentUser();
        const raw = localStorage.getItem('app:user');
        const email = raw ? (JSON.parse(raw).email as string) : '';
        if (!email) { if (mounted) setIsAdmin(false); return; }
        const res = await client.models.User.list({ filter: { email: { eq: email } }, limit: 1 });
        const role = res.data?.[0]?.role || 'USER';
        if (mounted) setIsAdmin(role === 'ADMIN');
      } catch {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { isAdmin, loading };
}


