import { jest, test, expect, beforeEach } from '@jest/globals';
import { pickClimbPhoto } from '../features/climbing/pickClimbPhoto';

const mockPick = jest.fn<() => Promise<any>>();
const mockCamera = jest.fn<() => Promise<any>>();
const mockPermission = jest.fn<() => Promise<any>>();
const mockResize = jest.fn();
const mockSave = jest.fn<() => Promise<any>>();
const mockRelease = jest.fn();
const mockContextRelease = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: any[]) => mockPick(...(args as [])),
  launchCameraAsync: (...args: any[]) => mockCamera(...(args as [])),
  requestCameraPermissionsAsync: () => mockPermission(),
  CameraType: { back: 'back' },
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: mockResize,
      release: mockContextRelease,
      renderAsync: async () => ({ saveAsync: mockSave, release: mockRelease }),
    }),
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ base64: 'jpeg', width: 1200, height: 1600 });
  mockPermission.mockResolvedValue({ granted: true });
});

test('takes a photo only after camera permission is granted and normalizes it', async () => {
  mockCamera.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///camera.jpg', width: 3024, height: 4032 }],
  });
  expect(await pickClimbPhoto('camera')).toEqual({ base64: 'jpeg', width: 1200, height: 1600 });
  expect(mockPermission).toHaveBeenCalled();
  expect(mockCamera).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: ['images'], cameraType: 'back' }),
  );
  expect(mockPick).not.toHaveBeenCalled();
});
test('permission denial gives a clear message without opening the camera', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  await expect(pickClimbPhoto('camera')).rejects.toThrow('Camera access is required');
  expect(mockCamera).not.toHaveBeenCalled();
});
test('cancelling the camera leaves the photo unchanged', async () => {
  mockCamera.mockResolvedValue({ canceled: true });
  expect(await pickClimbPhoto('camera')).toBeUndefined();
  expect(mockSave).not.toHaveBeenCalled();
});
test('cancelling the picker leaves the photo unchanged', async () => {
  mockPick.mockResolvedValue({ canceled: true });
  expect(await pickClimbPhoto()).toBeUndefined();
  expect(mockSave).not.toHaveBeenCalled();
});
test('converts a portrait HEIC selection into a bounded JPEG', async () => {
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo.heic', width: 3024, height: 4032 }],
  });
  expect(await pickClimbPhoto()).toEqual({ base64: 'jpeg', width: 1200, height: 1600 });
  expect(mockResize).toHaveBeenCalledWith({ height: 1600 });
  expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8, base64: true });
  expect(mockRelease).toHaveBeenCalled();
  expect(mockContextRelease).toHaveBeenCalled();
});
test('rejects an oversized converted photo', async () => {
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo.jpg', width: 800, height: 600 }],
  });
  mockSave.mockResolvedValue({ base64: 'a'.repeat(2796205), width: 800, height: 600 });
  await expect(pickClimbPhoto()).rejects.toThrow('too large');
  expect(mockRelease).toHaveBeenCalled();
});
