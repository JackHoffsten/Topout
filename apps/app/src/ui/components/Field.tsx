import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useDesktop, useTheme, tokens, webInputStyle, type SyntaxKind } from '../theme';

export function Field({
  label,
  error,
  password = false,
  syntax,
  keyboardPlacement = 'visible',
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  password?: boolean;
  syntax?: SyntaxKind;
  keyboardPlacement?: 'visible' | 'results';
}) {
  const c = useTheme();
  const desktop = useDesktop();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 7 }} {...(Platform.OS === 'web' ? { dataSet: { keyboardPlacement } } : {})}>
      <Text
        style={{
          color: c.syntax.property,
          fontSize: 13,
          fontWeight: '600',
          fontFamily: tokens.font,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? c.error : focused ? c.focus : c.line,
          backgroundColor: c.input,
          borderRadius: tokens.radius.sm,
        }}
      >
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          secureTextEntry={password && !visible}
          placeholderTextColor={c.muted}
          selectionColor={c.focus}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              minHeight: 42,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: syntax
                ? c.syntax[syntax]
                : props.keyboardType === 'number-pad' || props.keyboardType === 'decimal-pad'
                  ? c.syntax.number
                  : c.ink,
              fontFamily: tokens.font,
            },
            webInputStyle,
            props.style,
            // Small inputs trigger focus zoom in mobile browsers. Keep manual zoom available.
            Platform.OS === 'web' && !desktop ? { fontSize: 16 } : undefined,
          ]}
        />
        {password && (
          <Pressable
            onPress={() => setVisible(!visible)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            style={{ padding: 14 }}
          >
            <Text style={{ color: c.muted, fontSize: 13, fontFamily: tokens.font }}>
              {visible ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: c.error, fontSize: 13, fontFamily: tokens.font }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
