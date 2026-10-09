import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { errorMessage, loginSchema, registerSchema } from '@topout/shared';
import { useSession } from '../../lib/providers';
import { broadcastLogout } from '../../lib/session';
import { Brand } from '../../ui/components/Brand';
import { Label } from '../../ui/components/Label';
import { Card } from '../../ui/components/Card';
import { Heading } from '../../ui/components/Heading';
import { Field } from '../../ui/components/Field';
import { KeyboardViewport } from '../../ui/KeyboardViewport';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { tokens, useDesktop, useTheme } from '../../ui/theme';

export function AuthScreen({ register = false }: { register?: boolean }) {
  const c = useTheme();
  const wide = useDesktop();
  const { api } = useSession();
  const [error, setError] = useState<string>();
  const {
    control,
    handleSubmit,
    setError: fieldError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '', displayName: '' } });
  const submit = handleSubmit(async (values) => {
    setError(undefined);
    const parsed = (register ? registerSchema : loginSchema).safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        fieldError(issue.path[0] as 'email' | 'password' | 'displayName', {
          message: issue.message,
        }),
      );
      return;
    }
    try {
      if (register) await api.register(registerSchema.parse(values));
      else await api.login(loginSchema.parse(values));
      broadcastLogout();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  });

  return (
    <KeyboardViewport>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: wide ? 48 : 24,
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 1120,
                alignSelf: 'center',
                flexDirection: wide ? 'row' : 'column',
                gap: wide ? 80 : 32,
                alignItems: wide ? 'center' : 'stretch',
              }}
            >
              <View style={{ flex: wide ? 1 : undefined, gap: 24 }}>
                <Brand />
                {wide && (
                  <>
                    <Text
                      accessibilityRole="header"
                      style={{
                        color: c.ink,
                        fontSize: 38,
                        lineHeight: 46,
                        fontWeight: '600',
                        fontFamily: tokens.font,
                      }}
                    >
                      Track your training.
                    </Text>
                    <Label muted>Manage exercises and record your training data.</Label>
                  </>
                )}
              </View>
              <View
                style={{
                  flex: wide ? 1 : undefined,
                  maxWidth: 460,
                  width: '100%',
                  alignSelf: 'center',
                }}
              >
                <Card style={{ padding: wide ? 36 : 24, gap: 24 }}>
                  <View style={{ gap: 8 }}>
                    <Heading>{register ? 'Create account' : 'Sign in'}</Heading>
                    <Label muted>
                      {register
                        ? 'Enter your details to create an account.'
                        : 'Enter your email and password.'}
                    </Label>
                  </View>
                  {register && (
                    <Controller
                      control={control}
                      name="displayName"
                      render={({ field, fieldState }) => (
                        <Field
                          label="Name"
                          placeholder="Your name"
                          autoComplete="name"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  )}
                  <Controller
                    control={control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <Field
                        label="Email"
                        placeholder="you@example.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="password"
                    render={({ field, fieldState }) => (
                      <Field
                        label="Password"
                        placeholder={register ? 'Choose a strong password' : 'Your password'}
                        password
                        autoCapitalize="none"
                        autoComplete={register ? 'new-password' : 'current-password'}
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        onSubmitEditing={submit}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  {register && (
                    <Label small muted>
                      At least 8 characters, with an uppercase letter, lowercase letter, and number.
                    </Label>
                  )}
                  <ErrorNotice message={error} />
                  <Button
                    title={register ? 'Create account' : 'Sign in'}
                    busy={isSubmitting}
                    onPress={submit}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    <Label small muted>
                      {register ? 'Already have an account?' : "Don't have an account?"}
                    </Label>
                    <Link
                      href={register ? '/login' : '/register'}
                      style={{
                        color: c.primary,
                        fontFamily: tokens.font,
                        fontWeight: '600',
                        fontSize: 14,
                        paddingVertical: 2,
                      }}
                    >
                      {register ? 'Sign in' : 'Create an account'}
                    </Link>
                  </View>
                </Card>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 20,
                    paddingTop: 16,
                  }}
                >
                  <Link href="/privacy" style={{ color: c.primary, fontFamily: tokens.font }}>
                    Privacy policy
                  </Link>
                  <Link href="/support" style={{ color: c.primary, fontFamily: tokens.font }}>
                    Support
                  </Link>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </KeyboardViewport>
  );
}
