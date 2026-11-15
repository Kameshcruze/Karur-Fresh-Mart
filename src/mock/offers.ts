import type { Banner, Coupon, Offer } from '../types';

export const MOCK_OFFERS: Offer[] = [
  {
    id: 'offer-ponni-harvest',
    title: {
      en: 'Ponni Rice & Dal Festival Saver',
      ta: 'பொன்னி அரிசி & பருப்பு சிறப்பு சலுகை',
    },
    subtitle: {
      en: 'Flat ₹120 off on orders above ₹1,500 across Rice and Dals.',
      ta: 'அரிசி மற்றும் பருப்பு வகைகளில் ₹1,500-க்கு மேல் ₹120 தள்ளுபடி.',
    },
    badgeText: { en: 'Save ₹120', ta: '₹120 தள்ளுபடி' },
    discountType: 'flat',
    discountValue: 120,
    minOrderAmount: 1500,
    categoryId: 'cat-rice',
    validTill: '2026-12-31',
    active: true,
  },
  {
    id: 'offer-karur-chekku',
    title: {
      en: 'Karur Wood-Pressed Oil Week',
      ta: 'கரூர் மரச்செக்கு எண்ணெய் வார சலுகை',
    },
    subtitle: {
      en: '10% off on pure chekku gingelly and groundnut oils.',
      ta: 'மரச்செக்கு நல்லெண்ணெய் மற்றும் கடலை எண்ணெயில் 10% தள்ளுபடி.',
    },
    badgeText: { en: '10% OFF', ta: '10% தள்ளுபடி' },
    discountType: 'percent',
    discountValue: 10,
    minOrderAmount: 400,
    categoryId: 'cat-oil',
    validTill: '2026-12-31',
    active: true,
  },
  {
    id: 'offer-morning-dairy',
    title: {
      en: 'Morning Aavin Dairy & Tea Combo',
      ta: 'காலை ஆவின் பால் & தேயிலை சலுகை',
    },
    subtitle: {
      en: 'Free doorstep delivery before 8 AM on dairy & beverage orders over ₹299.',
      ta: '₹299-க்கு மேல் பால் & பான ஆர்டர்களுக்கு இலவச டெலிவரி.',
    },
    badgeText: { en: 'Free Delivery', ta: 'இலவச டெலிவரி' },
    discountType: 'flat',
    discountValue: 25,
    minOrderAmount: 299,
    categoryId: 'cat-dairy',
    validTill: '2026-12-31',
    active: true,
  },
  {
    id: 'offer-family-provision',
    title: {
      en: 'Monthly Family Box Bonus',
      ta: 'குடும்ப மளிகை தொகுப்பு சிறப்பு சலுகை',
    },
    subtitle: {
      en: 'Extra ₹150 instant savings when ordering the Family Provision Combo.',
      ta: 'குடும்ப மளிகை தொகுப்பு ஆர்டரில் கூடுதல் ₹150 சேமிப்பு.',
    },
    badgeText: { en: '₹150 OFF', ta: '₹150 தள்ளுபடி' },
    discountType: 'flat',
    discountValue: 150,
    minOrderAmount: 5000,
    validTill: '2026-12-31',
    active: true,
  },
];

export const MOCK_COUPONS: Coupon[] = [
  {
    code: 'KARUR50',
    description: {
      en: 'Flat ₹50 off on orders above ₹499',
      ta: '₹499-க்கு மேல் ஆர்டர்களுக்கு ₹50 தள்ளுபடி',
    },
    discountType: 'flat',
    discountValue: 50,
    minOrderAmount: 499,
    active: true,
  },
  {
    code: 'FRESH10',
    description: {
      en: '10% off up to ₹150 on orders above ₹999',
      ta: '₹999-க்கு மேல் ஆர்டர்களுக்கு 10% (அதிகபட்சம் ₹150) தள்ளுபடி',
    },
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 150,
    minOrderAmount: 999,
    active: true,
  },
  {
    code: 'FAMILY200',
    description: {
      en: 'Flat ₹200 off on monthly family baskets above ₹4,500',
      ta: '₹4,500-க்கு மேல் குடும்ப மளிகை ஆர்டருக்கு ₹200 தள்ளுபடி',
    },
    discountType: 'flat',
    discountValue: 200,
    minOrderAmount: 4500,
    active: true,
  },
];

export const MOCK_BANNERS: Banner[] = [
  {
    id: 'banner-hero-karur',
    title: {
      en: 'Fresh Karur kitchen staples in 25 mins',
      ta: 'கரூர் சமையலறை மளிகை 25 நிமிடங்களில் உங்கள் வீட்டில்',
    },
    subtitle: {
      en: 'Ponni boiled rice, farm toor dal, wood-pressed oils & Aavin dairy delivered across Karur.',
      ta: 'பொன்னி அரிசி, துவரம் பருப்பு, மரச்செக்கு எண்ணெய் மற்றும் ஆவின் பால் விரைவான டெலிவரி.',
    },
    ctaLabel: { en: 'Browse Offers', ta: 'சலுகைகளைப் பார்' },
    ctaRoute: '/shop',
    tone: 'green',
    active: true,
  },
  {
    id: 'banner-family-combo',
    title: {
      en: 'Monthly Family Provision Box · ₹6,890',
      ta: 'மாதாந்திர குடும்ப மளிகை தொகுப்பு · ₹6,890',
    },
    subtitle: {
      en: '8 essential pantry items with customizable trusted brands.',
      ta: 'உங்கள் விருப்ப பிராண்டுகளுடன் 8 அத்தியாவசிய மளிகைப் பொருட்கள்.',
    },
    ctaLabel: { en: 'Customize Combo', ta: 'தொகுப்பைத் தேர்ந்தெடு' },
    ctaRoute: '/combo/family',
    tone: 'yellow',
    active: true,
  },
  {
    id: 'banner-individual-combo',
    title: {
      en: 'Individual Starter Pack · ₹2,450',
      ta: 'தனிநபர் மளிகை தொகுப்பு · ₹2,450',
    },
    subtitle: {
      en: 'Compact monthly essentials for bachelors and couples in Karur.',
      ta: '1–2 நபர்களுக்கான மாதாந்திர அத்தியாவசிய மளிகைப் பொருட்கள்.',
    },
    ctaLabel: { en: 'View Pack', ta: 'தொகுப்பைப் பார்' },
    ctaRoute: '/combo/individual',
    tone: 'forest',
    active: true,
  },
];
