import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme, tokens } from './theme';

const webInputStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle)
    : undefined;

export function Label({
  children,
  muted = false,
  small = false,
}: React.PropsWithChildren<{ muted?: boolean; small?: boolean }>) {
  const c = useTheme();
  return (
    <Text
      style={{
        color: muted ? c.muted : c.ink,
        fontSize: small ? 13 : 16,
        lineHeight: small ? 20 : 25,
      }}
    >
      {children}
    </Text>
  );
}
export function Heading({ children, large = false }: React.PropsWithChildren<{ large?: boolean }>) {
  const c = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: c.ink,
        fontSize: large ? 40 : 28,
        lineHeight: large ? 48 : 36,
        fontWeight: '700',
        letterSpacing: -1,
      }}
    >
      {children}
    </Text>
  );
}
export function Brand() {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image
        source={require('../../assets/topout-icon.png')}
        style={{ width: 34, height: 34 }}
        accessible={false}
      />
      <Text style={{ color: c.ink, fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>
        topout
      </Text>
    </View>
  );
}
export function Button({
  title,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor:
          variant === 'primary' ? c.primary : variant === 'danger' ? c.error : c.soft,
        borderWidth: 2,
        borderColor: focused ? c.focus : 'transparent',
        opacity: disabled || busy ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      {busy && <ActivityIndicator color={variant === 'secondary' ? c.ink : c.onPrimary} />}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: variant === 'secondary' ? c.ink : c.onPrimary,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  password = false,
  ...props
}: TextInputProps & { label: string; error?: string; password?: boolean }) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? c.error : focused ? c.focus : c.line,
          backgroundColor: c.surface,
          borderRadius: 12,
        }}
      >
        <TextInput
          {...props}
          accessibilityLabel={label}
          secureTextEntry={password && !visible}
          placeholderTextColor={c.muted}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              minHeight: 50,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 16,
              color: c.ink,
            },
            webInputStyle,
            props.style,
          ]}
        />
        {password && (
          <Pressable
            onPress={() => setVisible(!visible)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            style={{ padding: 14 }}
          >
            <Text style={{ color: c.muted, fontSize: 13 }}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error && (
        <Text accessibilityRole="alert" style={{ color: c.error, fontSize: 13 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function Card({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          padding: 24,
          borderRadius: tokens.radius.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          gap: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function ErrorNotice({ message }: { message?: string }) {
  const c = useTheme();
  return message ? (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: c.errorBg, padding: 16, borderRadius: 12 }}
    >
      <Text style={{ color: c.error, lineHeight: 22 }}>{message}</Text>
    </View>
  ) : null;
}
export function Loading({ text = 'Loading…' }: { text?: string }) {
  const c = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        gap: 16,
        backgroundColor: c.bg,
      }}
    >
      <ActivityIndicator color={c.primary} />
      <Label muted>{text}</Label>
    </View>
  );
}
export function Page({ children }: React.PropsWithChildren) {
  const c = useTheme();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 24,
        paddingBottom: 40,
        width: '100%',
        maxWidth: 1100,
        alignSelf: 'center',
        gap: 24,
      }}
    >
      {children}
    </ScrollView>
  );
}
export function ConfirmDialog({
  visible,
  title,
  description,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  description: string;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
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
            <Button title="Delete exercise" variant="danger" busy={busy} onPress={onConfirm} />
            <Button title="Keep exercise" variant="secondary" disabled={busy} onPress={onCancel} />
          </Card>
        </View>
      </View>
    </Modal>
  );
}
