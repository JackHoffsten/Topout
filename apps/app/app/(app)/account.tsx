import { useState } from 'react';
import { errorMessage } from '@topout/shared';
import { useSession } from '../../src/lib/providers';
import { Button, Card, ErrorNotice, Heading, Label, Page } from '../../src/ui/components';
export default function Account() {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Page>
      <Heading>Your account</Heading>
      <Card>
        <Heading>Sign out</Heading>
        <Label muted>Sign out of your account on this device.</Label>
        <ErrorNotice message={error} />
        <Button
          title="Sign out"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await logout();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
    </Page>
  );
}
