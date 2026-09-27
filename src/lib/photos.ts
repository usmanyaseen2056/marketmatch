import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase, OFFER_PHOTO_BUCKET } from './supabase';

export type PickedPhoto = { uri: string; base64: string; mime: string };

/** Opens the camera for a live photo (no gallery, so shops can't reuse old pictures). */
export async function takeLivePhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Allow camera access to take a live photo.');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: false,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const a = result.assets[0];
  return { uri: a.uri, base64: a.base64!, mime: a.mimeType ?? 'image/jpeg' };
}

/** Uploads into offer-photos/<shopId>/<random>.jpg and returns the storage path. */
export async function uploadOfferPhoto(shopId: string, photo: PickedPhoto): Promise<string> {
  const ext = photo.mime === 'image/png' ? 'png' : 'jpg';
  const path = `${shopId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(OFFER_PHOTO_BUCKET).upload(path, decode(photo.base64), {
    contentType: photo.mime,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
