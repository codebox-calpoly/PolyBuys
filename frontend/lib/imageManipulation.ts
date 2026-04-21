import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Action, ImageResult, SaveOptions } from 'expo-image-manipulator';

export async function manipulateImage(
  uri: string,
  actions: Action[] = [],
  saveOptions: SaveOptions = {}
): Promise<ImageResult> {
  const { format = SaveFormat.JPEG, ...restSaveOptions } = saveOptions;
  const context = ImageManipulator.manipulate(uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | null = null;

  try {
    for (const action of actions) {
      if ('resize' in action) {
        context.resize(action.resize);
      } else if ('rotate' in action) {
        context.rotate(action.rotate);
      } else if ('flip' in action) {
        context.flip(action.flip);
      } else if ('crop' in action) {
        context.crop(action.crop);
      } else if ('extent' in action && context.extent) {
        context.extent(action.extent);
      }
    }

    image = await context.renderAsync();
    return await image.saveAsync({ format, ...restSaveOptions });
  } finally {
    image?.release();
    context.release();
  }
}
