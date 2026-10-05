import { Image, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../lib/providers';
import { useTheme, tokens } from '../../ui/theme';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { Label } from '../../ui/components/Label';
import type { ClimbPhotoDraft } from './pickClimbPhoto';

export function PhotoPreview({ photo }: { photo: ClimbPhotoDraft }) {
  const c = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.input,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Image
        accessibilityLabel="Climb photo"
        source={{ uri: `data:image/jpeg;base64,${photo.base64}` }}
        resizeMode="contain"
        style={{ width: '100%', aspectRatio: photo.width / photo.height, maxHeight: 480 }}
      />
    </View>
  );
}
export function ClimbPhoto({ id }: { id: number }) {
  const { api } = useSession();
  const query = useQuery({
    queryKey: ['climb-photo', id],
    queryFn: () => api.getClimbPhoto(id),
    gcTime: 0,
  });
  if (query.isPending)
    return (
      <Label small muted>
        Loading photo…
      </Label>
    );
  if (query.isError)
    return (
      <View style={{ gap: 8 }}>
        <ErrorNotice message="The photo could not be loaded." />
        <Button
          title="Retry photo"
          variant="secondary"
          onPress={() => {
            void query.refetch();
          }}
        />
      </View>
    );
  return query.data ? <PhotoPreview photo={query.data} /> : null;
}
