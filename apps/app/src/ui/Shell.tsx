import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Brand } from './components/Brand';
import { tokens, useDesktop, useTheme } from './theme';

export function Shell({ children }: React.PropsWithChildren) {
  const wide = useDesktop();
  const c = useTheme();
  const path = usePathname();
  const links = [
    { href: '/home' as const, label: 'Home', icon: 'calendar' as const },
    { href: '/templates' as const, label: 'Templates', icon: 'list' as const },
    { href: '/exercises' as const, label: 'Exercises', icon: 'grid' as const },
    { href: '/account' as const, label: 'Account', icon: 'user' as const },
  ];
  const navigation = (
    <View
      testID={wide ? 'desktop-navigation' : 'phone-navigation'}
      style={{
        flexDirection: wide ? 'column' : 'row',
        padding: wide ? 16 : 8,
        gap: 8,
        backgroundColor: c.chrome,
        borderColor: c.line,
        borderTopWidth: wide ? 0 : 1,
      }}
    >
      {links.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: path.startsWith(item.href) }}
            style={{
              flex: wide ? undefined : 1,
              minHeight: 52,
              flexDirection: wide ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: wide ? 'flex-start' : 'center',
              gap: 8,
              padding: 12,
              borderRadius: tokens.radius.sm,
              backgroundColor: path.startsWith(item.href) ? c.soft : 'transparent',
            }}
          >
            <Feather name={item.icon} size={20} color={c.ink} />
            <Text
              style={{
                color: c.ink,
                fontSize: wide ? 14 : 11,
                fontWeight: '500',
                fontFamily: tokens.font,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.chrome }}>
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {wide ? (
          <View style={{ width: 230, borderRightWidth: 1, borderColor: c.line, paddingTop: 32 }}>
            <View style={{ paddingHorizontal: 28, paddingBottom: 40 }}>
              <Brand />
            </View>
            {navigation}
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: c.line,
            }}
          >
            <Brand />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        {!wide && navigation}
      </View>
    </SafeAreaView>
  );
}
