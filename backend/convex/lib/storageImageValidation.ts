import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';

export const IMAGE_UPLOAD_BOUNDS = {
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,
  MAX_IMAGE_MB: 5,
};

export type StorageImageMetadata = {
  size: number;
  contentType?: string | null;
};

type StorageImageValidationCtx = {
  db: {
    system: {
      get(
        tableName: '_storage',
        storageId: Id<'_storage'>
      ): Promise<{
        _id: Id<'_storage'>;
        size: number;
        contentType?: string;
      } | null>;
    };
  };
};

export function isRemoteImageReference(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function assertValidStorageImageMetadata(
  metadata: StorageImageMetadata | null,
  label: string
) {
  if (!metadata) {
    throw new ConvexError(`${label} upload could not be found. Please upload it again.`);
  }

  if (metadata.size > IMAGE_UPLOAD_BOUNDS.MAX_IMAGE_BYTES) {
    throw new ConvexError(`${label} must be ${IMAGE_UPLOAD_BOUNDS.MAX_IMAGE_MB} MB or smaller.`);
  }

  if (metadata.contentType && !metadata.contentType.toLowerCase().startsWith('image/')) {
    throw new ConvexError(`${label} must be an image file.`);
  }
}

export async function validateStoredImageOrThrow(
  ctx: StorageImageValidationCtx,
  storageId: Id<'_storage'>,
  label: string
) {
  const metadata = await ctx.db.system.get('_storage', storageId);
  assertValidStorageImageMetadata(metadata, label);
}

export async function validateListingImageReferences(
  ctx: StorageImageValidationCtx,
  images: string[]
) {
  await Promise.all(
    images
      .filter((image) => !isRemoteImageReference(image))
      .map((image) => validateStoredImageOrThrow(ctx, image as Id<'_storage'>, 'Listing image'))
  );
}
