import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

/** Read intrinsic dimensions of a local image URI. */
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
  });
}

/**
 * Center-crop an image to a target aspect ratio (e.g., 4/3 to match preview cover behavior),
 * then optionally resize and save.
 *
 * @param uri local file URI of the image (from expo-camera or file system)
 * @param targetAspect desired aspect ratio (default 4/3)
 * @param opts compress (0–1), format (JPEG/PNG/WEBP), targetWidth (optional scale)
 * @returns object with `localUri` (or `uri`) that points to the cropped image file
 */
export async function centerCropToAspect(
  uri: string,
  targetAspect = 4 / 3,
  opts?: { compress?: number; format?: SaveFormat; targetWidth?: number }
) {
  const { compress = 0.9, format = SaveFormat.JPEG, targetWidth } = opts ?? {};

  // 1) Get original dimensions
  const { width: w, height: h } = await getImageSize(uri);
  const imageAspect = w / h;

  // 2) Compute a center-crop rectangle that matches the target aspect
  let cropW = w;
  let cropH = h;
  let originX = 0;
  let originY = 0;

  if (imageAspect > targetAspect) {
    // Too wide: crop left/right
    cropH = h;
    cropW = Math.round(h * targetAspect);
    originX = Math.round((w - cropW) / 2);
  } else if (imageAspect < targetAspect) {
    // Too tall: crop top/bottom
    cropW = w;
    cropH = Math.round(w / targetAspect);
    originY = Math.round((h - cropH) / 2);
  }

  // 3) Build a manipulation context and chain operations
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop({ originX, originY, width: cropW, height: cropH });

  // Optional downscale for smaller uploads (preserves the new aspect)
  if (typeof targetWidth === 'number' && targetWidth > 0) {
    ctx.resize({ width: targetWidth });
  }

  // 4) Execute and persist
  const imageObj = await ctx.renderAsync(); // produces an in-memory image object
  const result = await imageObj.saveAsync({ format, compress }); // writes a new file

  // On recent SDKs, the returned object has `localUri`; in older versions it can be `uri`.
  return result; // e.g. { localUri, width, height, mimeType? }
}
