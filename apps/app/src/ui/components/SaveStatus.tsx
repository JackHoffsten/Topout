import { ActivityIndicator, Platform, View } from 'react-native';
import { Label } from './Label';
import { useTheme, tokens } from '../theme';
import { useCarriedSaveFeedback, type SaveFeedback } from '../saveFeedback';

export function SaveStatus({ feedback }: { feedback?: SaveFeedback }) {
  const c = useTheme();
  if (!feedback) return null;
  const text =
    feedback.phase === 'saving'
      ? 'Saving…'
      : feedback.phase === 'saved'
        ? 'Saved'
        : feedback.phase === 'partial'
          ? 'Partially saved'
          : 'Not saved';
  return (
    <View
      accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : undefined}
      accessibilityLabel={`${feedback.label}: ${text}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        borderRadius: tokens.radius.sm,
        borderLeftWidth: 3,
        borderLeftColor: feedback.phase === 'error' ? c.error : c.accent,
        backgroundColor: feedback.phase === 'saved' ? c.soft : 'transparent',
      }}
    >
      {feedback.phase === 'saving' && <ActivityIndicator size="small" color={c.accent} />}
      <Label small>
        {feedback.label}: {text}
      </Label>
    </View>
  );
}

export function CarriedSaveStatus() {
  const notices = useCarriedSaveFeedback();
  return (
    <>
      {notices.map((notice) => (
        <SaveStatus key={notice.source} feedback={notice} />
      ))}
    </>
  );
}
