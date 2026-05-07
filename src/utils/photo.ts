// src/utils/photo.ts

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

type CropToAspectParams = {
  uri: string;
  width: number;
  height: number;
  aspectRatio: number;
  compress?: number;
};

export async function cropToAspect({
  uri,
  width,
  height,
  aspectRatio,
  compress = 0.85,
}: CropToAspectParams): Promise<string> {
  let cropW = width;
  let cropH = height;
  let originX = 0;
  let originY = 0;

  const currentRatio = width / height;

  if (currentRatio > aspectRatio) {
    cropW = Math.round(height * aspectRatio);
    originX = Math.round((width - cropW) / 2);
  } else if (currentRatio < aspectRatio) {
    cropH = Math.round(width / aspectRatio);
    originY = Math.round((height - cropH) / 2);
  }

  const context = ImageManipulator.manipulate(uri);

  context.crop({
    originX,
    originY,
    width: cropW,
    height: cropH,
  });

  const rendered = await context.renderAsync();

  const result = await rendered.saveAsync({
    compress,
    format: SaveFormat.JPEG,
  });

  return result.uri;
}

export async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  return await response.blob();
}
