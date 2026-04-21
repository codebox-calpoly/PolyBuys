export type FieldErrors = {
  title?: string;
  description?: string;
  price?: string;
  images?: string;
};

type ListingFieldValues = {
  title: string;
  description: string;
  price: string;
  images: string[];
};

export function validateTitle(title: string): string | undefined {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    return 'Title is required.';
  }

  if (trimmedTitle.length < 5) {
    return 'Title must be at least 5 characters.';
  }

  if (trimmedTitle.length > 100) {
    return 'Title must be 100 characters or less.';
  }

  return undefined;
}

export function validateDescription(description: string): string | undefined {
  if (!description.trim()) {
    return 'Description is required.';
  }

  return undefined;
}

export function validatePrice(price: string): string | undefined {
  const trimmedPrice = price.trim();

  if (!trimmedPrice) {
    return 'Price is required.';
  }

  const parsedPrice = Number(trimmedPrice);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return 'Enter a valid non-negative price.';
  }

  return undefined;
}

export function validateImages(images: string[]): string | undefined {
  if (images.length < 1) {
    return 'At least 1 photo is required.';
  }

  if (images.length > 8) {
    return 'Maximum 8 photos allowed.';
  }

  return undefined;
}

export function validateListingFields(values: ListingFieldValues): FieldErrors {
  const errors: FieldErrors = {};

  const titleError = validateTitle(values.title);
  if (titleError) {
    errors.title = titleError;
  }

  const descriptionError = validateDescription(values.description);
  if (descriptionError) {
    errors.description = descriptionError;
  }

  const priceError = validatePrice(values.price);
  if (priceError) {
    errors.price = priceError;
  }

  const imagesError = validateImages(values.images);
  if (imagesError) {
    errors.images = imagesError;
  }

  return errors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Boolean(errors.title || errors.description || errors.price || errors.images);
}

export function upsertFieldError<K extends keyof FieldErrors>(
  errors: FieldErrors,
  key: K,
  error: FieldErrors[K]
): FieldErrors {
  if (error) {
    return { ...errors, [key]: error };
  }

  const nextErrors: FieldErrors = { ...errors };
  delete nextErrors[key];
  return nextErrors;
}
