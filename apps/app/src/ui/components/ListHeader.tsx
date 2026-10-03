import { Pressable, Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { Heading } from './Heading';
import { tokens, useDesktop, useTheme } from '../theme';

export function ListHeader({
  title,
  action,
  href,
  onPress,
  showPlus = true,
}: {
  title: string;
  action: string;
  href?: Href;
  onPress?: () => void;
  showPlus?: boolean;
}) {
  const wide = useDesktop();
  const c = useTheme();
  const button = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={action}
      onPress={onPress}
      style={{
        backgroundColor: c.primary,
        borderRadius: tokens.radius.sm,
        padding: 16,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: c.onPrimary, fontWeight: '600', fontFamily: tokens.font }}>
        {showPlus ? `＋ ${action}` : action}
      </Text>
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'stretch',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Heading large>{title}</Heading>
      {href ? (
        <Link href={href} asChild>
          {button}
        </Link>
      ) : (
        button
      )}
    </View>
  );
}
