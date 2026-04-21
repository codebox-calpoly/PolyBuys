import { ConvexError } from 'convex/values';
import {
  IMAGE_UPLOAD_BOUNDS,
  assertValidStorageImageMetadata,
  isRemoteImageReference,
} from '../lib/storageImageValidation';

describe('storage image validation', () => {
  it('accepts remote image references', () => {
    expect(isRemoteImageReference('https://example.com/image.jpg')).toBe(true);
    expect(isRemoteImageReference('http://example.com/image.jpg')).toBe(true);
    expect(isRemoteImageReference('storage-id')).toBe(false);
  });

  it('rejects missing storage metadata', () => {
    expect(() => assertValidStorageImageMetadata(null, 'Listing image')).toThrow(ConvexError);
    expect(() => assertValidStorageImageMetadata(null, 'Listing image')).toThrow(
      'Listing image upload could not be found. Please upload it again.'
    );
  });

  it('rejects oversized images', () => {
    expect(() =>
      assertValidStorageImageMetadata(
        {
          size: IMAGE_UPLOAD_BOUNDS.MAX_IMAGE_BYTES + 1,
          contentType: 'image/jpeg',
        },
        'Profile picture'
      )
    ).toThrow('Profile picture must be 5 MB or smaller.');
  });

  it('rejects non-image content types when provided', () => {
    expect(() =>
      assertValidStorageImageMetadata(
        {
          size: 1024,
          contentType: 'application/pdf',
        },
        'Profile picture'
      )
    ).toThrow('Profile picture must be an image file.');
  });

  it('accepts image metadata and legacy missing content types', () => {
    expect(() =>
      assertValidStorageImageMetadata(
        {
          size: 1024,
          contentType: 'image/jpeg',
        },
        'Listing image'
      )
    ).not.toThrow();

    expect(() =>
      assertValidStorageImageMetadata(
        {
          size: 1024,
          contentType: null,
        },
        'Listing image'
      )
    ).not.toThrow();
  });
});
