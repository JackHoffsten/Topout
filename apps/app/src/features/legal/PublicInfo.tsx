import { Linking } from 'react-native';
import { Link } from 'expo-router';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Button } from '../../ui/components/Button';
import { tokens, useTheme } from '../../ui/theme';

export function PublicInfo({ privacy = false }: { privacy?: boolean }) {
  const c = useTheme();
  return (
    <Page>
      <Heading large>{privacy ? 'Privacy policy' : 'Support'}</Heading>
      {privacy ? (
        <>
          <Label muted>Last updated: 4 October 2026</Label>
          <Label>
            Topout is operated by Jack Hoffsten in Sweden and helps you plan and record workouts and
            climbs. For privacy questions, contact jack.hoffsten@hotmail.se.
          </Label>
          <Heading>Information stored</Heading>
          <Label>
            We store your email address, display name, password hash, account identifiers, and
            session credentials. We also store the exercises, templates, calendar plans, sets, reps,
            weights, notes, and climbing details you enter, including optional route names and
            location text and photos you choose to attach to climbs.
          </Label>
          <Heading>How information is used</Heading>
          <Label>
            This information is used to provide your account, save your training, and show progress.
            Your records are linked to your account and are not publicly visible. Topout does not
            include advertising or analytics SDKs in this release and does not access GPS, HealthKit
            or your contacts. You can optionally attach one photo to a climb. Topout only uploads
            photos you select or take; it does not upload your photo library. Camera access is
            requested only when you choose to take a photo. Image metadata such as GPS location is
            removed before storage.
          </Label>
          <Heading>Storage and security</Heading>
          <Label>
            Training and account records are stored on a homeserver in Sweden. Connections use
            HTTPS. Passwords are hashed rather than stored as plain text. Infrastructure providers
            may process connection information, such as IP addresses, to deliver and secure the
            service.
          </Label>
          <Heading>Retention and deletion</Heading>
          <Label>
            Your account and training records are kept while your account exists. You can delete
            them in Account → Delete account after confirming your password. This removes your
            active database records and invalidates your sessions.
          </Label>
          <Label>
            Encrypted database backups are created daily and stored on the same server with
            root-only access. Backups have a configured retention period of 14 days. Older copies
            are removed after a successful backup; a backup failure may delay their removal. Deleted
            records may remain in these isolated recovery copies until they expire. Backups are used
            for recovery, not routine access. Restoring a backup requires reapplying account
            deletions before recovered data is returned to service.
          </Label>
          <Heading>Sessions</Heading>
          <Label>
            On iOS and Android, a session token is kept in the device's secure storage. On the web,
            essential session and security cookies keep you signed in and protect requests. These
            are not advertising cookies. Signing out removes the session on that device.
          </Label>
          <Heading>Your choices</Heading>
          <Label>
            You can edit or delete training records in the app. Contact the support email to request
            access to your information, corrections, or help with deletion. If you email support,
            your message and email address are processed to respond to your request.
          </Label>
          <Label>
            You may request access, correction, deletion, restriction, or a portable copy of your
            personal information, and object to processing where applicable. You may also complain
            to the Swedish privacy authority, Integritetsskyddsmyndigheten (IMY).
          </Label>
          <Heading>Policy updates</Heading>
          <Label>
            This page will be updated when data practices change. Contact support if anything is
            unclear.
          </Label>
        </>
      ) : (
        <>
          <Label>For help with Topout, contact jack.hoffsten@hotmail.se.</Label>
          <Label>
            Include the app version, your device model, and the steps that caused the problem. Never
            send your password or session tokens.
          </Label>
          <Heading>Account deletion</Heading>
          <Label>
            Open Account → Delete account, enter your current password, and confirm. This
            permanently deletes your account and training data. Contact support if you cannot access
            your account.
          </Label>
          <Button
            title="Email support"
            onPress={() => {
              void Linking.openURL('mailto:jack.hoffsten@hotmail.se?subject=Topout%20support');
            }}
          />
        </>
      )}
      <Link
        href={privacy ? '/support' : '/privacy'}
        style={{ color: c.primary, fontFamily: tokens.font }}
      >
        {privacy ? 'Support' : 'Privacy policy'}
      </Link>
      <Link href="/" style={{ color: c.primary, fontFamily: tokens.font }}>
        Open Topout
      </Link>
    </Page>
  );
}
