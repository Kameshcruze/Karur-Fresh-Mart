import ponniRiceImg from '../assets/images/product_ponni_rice_1794742578038.jpg';
import toorDalImg from '../assets/images/product_toor_dal_1794742578085.jpg';
import gingellyOilImg from '../assets/images/product_gingelly_oil_1794742578761.jpg';
import turmericSpicesImg from '../assets/images/product_turmeric_spices_1794742578458.jpg';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'ponni-rice': ponniRiceImg,
  'toor-dal': toorDalImg,
  'gingelly-oil': gingellyOilImg,
  'turmeric-spices': turmericSpicesImg,
};

export function resolveProductImage(image?: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/') || image.startsWith('data:')) {
    return image;
  }
  return PRODUCT_IMAGE_MAP[image];
}
