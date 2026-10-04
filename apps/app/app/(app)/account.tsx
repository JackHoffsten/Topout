import { useState } from 'react';
import { errorMessage } from '@topout/shared';
import { useSession } from '../../src/lib/providers';
import { Page } from '../../src/ui/components/Page';
import { Heading } from '../../src/ui/components/Heading';
import { Card } from '../../src/ui/components/Card';
import { Label } from '../../src/ui/components/Label';
import { ErrorNotice } from '../../src/ui/components/ErrorNotice';
import { Button } from '../../src/ui/components/Button';
import { Field } from '../../src/ui/components/Field';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog';
import { Link } from 'expo-router';
import { tokens, useTheme } from '../../src/ui/theme';

export default function Account() {
  const { logout, deleteAccount } = useSession();
  const c = useTheme();
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
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
      <Card>
        <Heading>Privacy and support</Heading>
        <Link href="/privacy" style={{ color: c.primary, fontFamily: tokens.font }}>
          Privacy policy
        </Link>
        <Link href="/support" style={{ color: c.primary, fontFamily: tokens.font }}>
          Support
        </Link>
      </Card>
      <Card>
        <Heading>Delete account</Heading>
        <Label muted>
          Permanently delete your account, exercises, templates, plans, workout logs, and climbs.
        </Label>
        <Field
          label="Current password"
          value={password}
          onChangeText={setPassword}
          password
          editable={!deleting}
        />
        <Button
          title="Delete account"
          variant="danger"
          disabled={!password || busy || deleting}
          onPress={() => {
            setDeleteError(undefined);
            setConfirming(true);
          }}
        />
      </Card>
      {confirming && (
        <ConfirmDialog
          visible
          title="Delete your account?"
          description="Your account and all training data will be permanently deleted. This cannot be undone."
          confirmLabel="Permanently delete account"
          cancelLabel="Cancel"
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            setConfirming(false);
            setPassword('');
          }}
          onConfirm={async () => {
            setDeleting(true);
            setDeleteError(undefined);
            try {
              await deleteAccount(password);
            } catch (e) {
              setDeleteError(errorMessage(e));
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </Page>
  );
}
