import { View } from 'react-native';
import { climbOutcomeLabel, climbingLabel, type ClimbLog } from '@topout/shared';
import { Label } from '../../ui/components/Label';

export function ClimbSummary({ log }: { log: ClimbLog }) {
  const count = log.totalAttempts ?? log.attempts;
  const lowerBound =
    log.totalAttemptsIsLowerBound ??
    (log.attemptsMode === 'MoreThan' || log.attemptsMode === 'Unknown');
  return (
    <View style={{ gap: 2 }}>
      <Label syntax="name">
        {log.name ||
          (log.climbingType === 'Bouldering' ? 'Boulder' : climbingLabel(log.climbingType))}{' '}
        <Label syntax="number">{log.grade.replace('-', ' - ')}</Label>
      </Label>
      {!!log.projectId && (
        <Label small syntax="keyword">
          {log.projectCompleted ? 'Project · Completed' : 'Project · Unfinished'}
        </Label>
      )}
      <Label small muted>
        {count == null
          ? 'Attempts unknown'
          : `${count}${lowerBound ? '+' : ''} ${count === 1 && !lowerBound ? 'attempt' : 'attempts'}`}
        {!!log.projectId && count != null && ' total'} · {climbOutcomeLabel(log.outcome)}
      </Label>
    </View>
  );
}
