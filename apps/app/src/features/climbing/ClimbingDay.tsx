import { Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { errorMessage, type ClimbLog } from '@topout/shared';
import { Button } from '../../ui/components/Button';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Loading } from '../../ui/components/Loading';
import { useTheme, tokens } from '../../ui/theme';
import { ClimbSummary } from './ClimbSummary';

export function ClimbingDay({
  date,
  logs,
  loading,
  error,
  onRetry,
  restDay,
  marked = false,
  onMark,
  markBusy = false,
  markUnavailable = false,
  markError,
}: {
  date: string;
  logs: ClimbLog[];
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  restDay: boolean;
  marked?: boolean;
  onMark?: (marked: boolean) => void;
  markBusy?: boolean;
  markUnavailable?: boolean;
  markError?: unknown;
}) {
  const c = useTheme();
  const router = useRouter();
  return (
    <View style={{ gap: 12, borderTopWidth: 1, borderColor: c.line, paddingTop: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Heading>Climbing</Heading>
        <Link
          href="/climbs"
          style={{ color: c.syntax.property, fontFamily: tokens.font, fontSize: 13 }}
        >
          All climbs
        </Link>
      </View>
      {loading ? (
        <Loading text="Loading climbs…" />
      ) : error ? (
        <>
          <ErrorNotice message={errorMessage(error)} />
          <Button title="Retry climbs" onPress={onRetry} />
        </>
      ) : (
        <>
          {!logs.length && (
            <Label muted>{marked ? 'Climbing day · No climbs logged.' : 'No climbs logged.'}</Label>
          )}
          {logs.map((log) => (
            <Link key={log.id} href={{ pathname: '/climbs', params: { climb: log.id } }} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`View climb ${log.name || log.grade}`}
                style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }}
              >
                <ClimbSummary log={log} />
              </Pressable>
            </Link>
          ))}
          <Button
            title="Log climb"
            disabled={restDay}
            onPress={() => router.push({ pathname: '/climbs/new', params: { date } })}
          />
          {!logs.length && onMark && (
            <Button
              title={marked ? 'Remove climbing day' : 'Mark climbing day'}
              variant="secondary"
              busy={markBusy}
              disabled={restDay || markUnavailable}
              onPress={() => onMark(!marked)}
            />
          )}
          {markError != null && <ErrorNotice message={errorMessage(markError)} />}
          {restDay && (
            <Label small muted>
              Remove the rest day to log a climb.
            </Label>
          )}
        </>
      )}
    </View>
  );
}
