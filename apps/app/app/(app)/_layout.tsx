import { Slot } from 'expo-router';
import { Shell } from '../../src/ui/Shell';

export default function Layout() {
  return (
    <Shell>
      <Slot />
    </Shell>
  );
}
