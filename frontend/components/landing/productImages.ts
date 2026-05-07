import calculusBookJpg from '../../assets/images/landing-calculus-book.jpg';
import kallaxShelfJpg from '../../assets/images/landing-kallax-shelf.jpg';
import { toWebImageSrc } from './assetSource';

export const PRODUCT_IMAGES = {
  calculusBook: toWebImageSrc(calculusBookJpg),
  cubeShelf: toWebImageSrc(kallaxShelfJpg),
} as const;
