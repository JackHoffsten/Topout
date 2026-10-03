import { useState } from 'react';
import { errorMessage } from '@topout/shared';
import { useSession } from '../../src/lib/providers';
import { Page } from '../../src/ui/components/Page';
import { Heading } from '../../src/ui/components/Heading';
import { Card } from '../../src/ui/components/Card';
import { Label } from '../../src/ui/components/Label';
import { ErrorNotice } from '../../src/ui/components/ErrorNotice';
import { Button } from '../../src/ui/components/Button';

export default function Account() {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Page>
      <Heading large>Your account</Heading>
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
