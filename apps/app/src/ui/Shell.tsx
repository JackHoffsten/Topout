import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Brand } from './components/Brand';
import { NavigationContent } from './NavigationContent';
import { useNavigationDismiss } from './useNavigationDismiss';
import { tokens, useDesktop, useTheme } from './theme';

export function Shell({ children }: React.PropsWithChildren) {
  const wide = useDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  useNavigationDismiss(menuOpen && !wide, closeMenu);
  const c = useTheme();
  const path = usePathname();
  useEffect(() => setMenuOpen(false), [path, wide]);
  const links = [
    { href: '/calendar' as const, label: 'Calendar', icon: 'calendar' as const },
    { href: '/progress' as const, label: 'Progress', icon: 'trending-up' as const },
    { href: '/climbs' as const, label: 'Climbs', icon: 'map' as const },
    { href: '/templates' as const, label: 'Templates', icon: 'list' as const },
    { href: '/exercises' as const, label: 'Exercises', icon: 'grid' as const },
    { href: '/account' as const, label: 'Account', icon: 'user' as const },
  ];
  const navigation = (
    <View
      testID={wide ? 'desktop-navigation' : 'phone-navigation'}
      style={{
        flexDirection: 'column',
        padding: 16,
        gap: 8,
        backgroundColor: c.chrome,
        borderColor: c.line,
      }}
    >
      {links.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: path.startsWith(item.href) }}
            onPress={closeMenu}
            style={{
              minWidth: 0,
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 8,
              padding: 12,
              borderRadius: tokens.radius.sm,
              backgroundColor: path.startsWith(item.href) ? c.soft : 'transparent',
            }}
          >
            <View
              testID={`navigation-icon-${item.label.toLowerCase()}`}
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.href === '/templates' ? (
                <Feather name="list" size={20} color={c.ink} />
              ) : item.href === '/climbs' ? (
                <MaterialCommunityIcons name="terrain" size={22} color={c.ink} />
              ) : (
                <Feather name={item.icon} size={20} color={c.ink} />
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{
                color: c.ink,
                fontSize: 14,
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
            testID="phone-navigation-header"
            style={{
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: c.line,
              backgroundColor: c.chrome,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              justifyContent: 'space-between',
            }}
          >
            <Brand />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? 'Close navigation' : 'Open navigation'}
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((open) => !open)}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: tokens.radius.sm,
                backgroundColor: pressed ? c.soft : 'transparent',
              })}
            >
              <Feather name={menuOpen ? 'x' : 'menu'} size={24} color={c.ink} />
            </Pressable>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <NavigationContent blocked={menuOpen && !wide}>{children}</NavigationContent>
          {!wide && menuOpen && (
            <View
              style={[
                StyleSheet.absoluteFill,
                { flexDirection: 'row', backgroundColor: '#00000066' },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss navigation"
                style={{ flex: 1 }}
                onPress={closeMenu}
              />
              <View
                onAccessibilityEscape={closeMenu}
                style={{
                  width: '85%',
                  maxWidth: 320,
                  backgroundColor: c.chrome,
                }}
              >
                <ScrollView>{navigation}</ScrollView>
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
