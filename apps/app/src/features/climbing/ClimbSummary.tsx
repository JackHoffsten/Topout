import { View } from 'react-native';
import { climbOutcomeLabel, climbingLabel, type ClimbLog } from '@topout/shared';
import { Label } from '../../ui/components/Label';

export function ClimbSummary({ log }: { log: ClimbLog }) {
  return (
    <View style={{ gap: 2 }}>
      <Label syntax="name">
        {log.name ||
          (log.climbingType === 'Bouldering' ? 'Boulder' : climbingLabel(log.climbingType))}{' '}
        <Label syntax="number">{log.grade}</Label>
      </Label>
      <Label small muted>
        {log.attempts} {log.attempts === 1 ? 'attempt' : 'attempts'} ·{' '}
        {climbOutcomeLabel(log.outcome)}
      </Label>
    </View>
  );
}
