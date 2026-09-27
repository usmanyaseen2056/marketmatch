import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

/** Sends each person to the right place: sign in → pick role → buyer or shop app. */
export default function Index() {
  const { session, profile, shop, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Loading />;
  if (!profile.full_name || !profile.role) return <Redirect href="/onboarding" />;
  if (profile.role === 'shopkeeper') {
    return shop ? <Redirect href="/shop" /> : <Redirect href="/shop/setup" />;
  }
  return <Redirect href="/buyer" />;
}
