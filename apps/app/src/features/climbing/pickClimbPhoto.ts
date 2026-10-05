import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type ClimbPhotoDraft = { base64: string; width: number; height: number };
export async function pickClimbPhoto(): Promise<ClimbPhotoDraft | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    // Request a compatible representation of iPhone HEIC photos.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 1,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset) return;
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1600) {
    context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
  }
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    image = await context.renderAsync();
    const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!output.base64 || output.base64.length > 2796204) {
      throw new Error('This photo is too large. Choose a smaller image.');
    }
    return { base64: output.base64, width: output.width, height: output.height };
  } finally {
    image?.release();
    context.release();
  }
}
