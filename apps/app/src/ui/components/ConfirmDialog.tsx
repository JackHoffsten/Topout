import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Heading } from './Heading';
import { Label } from './Label';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './Button';

export function ConfirmDialog({
  visible,
  title,
  description,
  busy,
  error,
  onCancel,
  onConfirm,
  confirmLabel = 'Delete exercise',
  cancelLabel = 'Keep exercise',
}: {
  visible: boolean;
  title: string;
  description: string;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const c = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#00000066',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          },
        ]}
      >
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 420 }}>
          <Card>
            <Heading>{title}</Heading>
            <Label muted>{description}</Label>
            <ErrorNotice message={error} />
            <Button title={confirmLabel} variant="danger" busy={busy} onPress={onConfirm} />
            <Button title={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} />
          </Card>
        </View>
      </View>
    </Modal>
  );
}