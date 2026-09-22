import { Redirect } from 'expo-router';
import { useSession } from '../src/lib/providers';
export default function Index() {
  return <Redirect href={useSession().status === 'authenticated' ? '/exercises' : '/login'} />;
}
