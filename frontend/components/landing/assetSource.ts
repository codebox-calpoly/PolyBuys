type WebImageAssetObject = {
  uri?: string;
  width?: number;
  height?: number;
};

export function toWebImageSrc(asset: unknown): string {
  if (typeof asset === 'string') {
    return asset;
  }

  if (asset && typeof asset === 'object') {
    const imageAsset = asset as WebImageAssetObject;
    return imageAsset.uri ?? '';
  }

  return '';
}
