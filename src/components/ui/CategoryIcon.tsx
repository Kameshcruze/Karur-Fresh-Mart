import {
  Apple,
  Bean,
  Coffee,
  Cookie,
  Droplets,
  Flame,
  HeartHandshake,
  Milk,
  Package,
  Sparkles,
  Wheat,
} from 'lucide-react';

export function CategoryIcon({
  name,
  className = 'w-6 h-6',
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case 'Wheat':
      return <Wheat className={className} aria-hidden="true" />;
    case 'Bean':
      return <Bean className={className} aria-hidden="true" />;
    case 'Droplets':
      return <Droplets className={className} aria-hidden="true" />;
    case 'Flame':
      return <Flame className={className} aria-hidden="true" />;
    case 'Milk':
      return <Milk className={className} aria-hidden="true" />;
    case 'Cookie':
      return <Cookie className={className} aria-hidden="true" />;
    case 'Coffee':
      return <Coffee className={className} aria-hidden="true" />;
    case 'Sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} aria-hidden="true" />;
    case 'Apple':
      return <Apple className={className} aria-hidden="true" />;
    default:
      return <Package className={className} aria-hidden="true" />;
  }
}
