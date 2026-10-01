import { Image, Text, View } from 'react-native';
import { useTheme, tokens } from '../theme';

export function Brand() {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image
        source={require('../../../assets/topout-icon.png')}
        style={{ width: 34, height: 34 }}
        accessible={false}
      />
      <Text style={{ color: c.ink, fontSize: 20, fontWeight: '600', fontFamily: tokens.font }}>
        topout
      </Text>
    </View>
  );
}