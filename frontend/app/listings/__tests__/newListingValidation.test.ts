import {
  hasFieldErrors,
  upsertFieldError,
  validateDescription,
  validateImages,
  validateListingFields,
  validatePrice,
  validateTitle,
} from '../newListingValidation';

describe('new listing validation', () => {
  it('collects required field errors for an empty submission', () => {
    expect(
      validateListingFields({
        title: '',
        description: '   ',
        price: '',
        images: [],
      })
    ).toEqual({
      title: 'Title is required.',
      description: 'Description is required.',
      price: 'Price is required.',
      images: 'At least 1 photo is required.',
    });
  });

  it('treats trimmed valid values as valid', () => {
    expect(validateTitle('  Desk lamp  ')).toBeUndefined();
    expect(validateDescription('  Clean, lightly used.  ')).toBeUndefined();
    expect(validatePrice(' 15.50 ')).toBeUndefined();
    expect(validateImages(['image-1'])).toBeUndefined();
  });

  it('keeps invalid edits invalid until the value is actually corrected', () => {
    expect(validateTitle('Hey')).toBe('Title must be at least 5 characters.');
    expect(validatePrice('.')).toBe('Enter a valid non-negative price.');
  });

  it('rejects titles longer than 100 characters', () => {
    expect(validateTitle('a'.repeat(101))).toBe('Title must be 100 characters or less.');
  });

  it('rejects more than 8 photos', () => {
    expect(
      validateImages([
        'image-1',
        'image-2',
        'image-3',
        'image-4',
        'image-5',
        'image-6',
        'image-7',
        'image-8',
        'image-9',
      ])
    ).toBe('Maximum 8 photos allowed.');
  });

  it('removes cleared field keys so banner state reflects active errors only', () => {
    const errors = validateListingFields({
      title: 'Hey',
      description: '',
      price: '',
      images: [],
    });

    const withoutTitle = upsertFieldError(errors, 'title', undefined);

    expect(withoutTitle.title).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(withoutTitle, 'title')).toBe(false);
    expect(hasFieldErrors(withoutTitle)).toBe(true);

    const noErrors = upsertFieldError(
      upsertFieldError(
        upsertFieldError(withoutTitle, 'description', undefined),
        'price',
        undefined
      ),
      'images',
      undefined
    );

    expect(hasFieldErrors(noErrors)).toBe(false);
  });
});
