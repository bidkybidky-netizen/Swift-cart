import { Product } from './types';

export const CATEGORIES = [
  { name: 'Mobiles', icon: '📱', image: 'https://picsum.photos/seed/phone/100/100' },
  { name: 'Electronics', icon: '💻', image: 'https://picsum.photos/seed/laptop/100/100' },
  { name: 'Fashion', icon: '👕', image: 'https://picsum.photos/seed/shirt/100/100' },
  { name: 'Home', icon: '🏠', image: 'https://picsum.photos/seed/sofa/100/100' },
  { name: 'Appliances', icon: '📺', image: 'https://picsum.photos/seed/tv/100/100' },
  { name: 'Beauty', icon: '💄', image: 'https://picsum.photos/seed/makeup/100/100' },
  { name: 'Toys', icon: '🧸', image: 'https://picsum.photos/seed/toy/100/100' },
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro (Natural Titanium, 128 GB)',
    description: 'A17 Pro chip with 6-core GPU. 48MP Main camera. USB-C with USB 3 support.',
    price: 129900,
    category: 'Mobiles',
    image: 'https://picsum.photos/seed/iphone15/600/600',
    rating: 4.7
  },
  {
    id: '2',
    name: 'Samsung Galaxy S24 Ultra 5G',
    description: '200MP Camera, S Pen included, Snapdragon 8 Gen 3 for Galaxy.',
    price: 119999,
    category: 'Mobiles',
    image: 'https://picsum.photos/seed/s24/600/600',
    rating: 4.8
  },
  {
    id: '3',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry leading noise cancellation with 8 microphones and Auto NC Optimizer.',
    price: 26990,
    category: 'Electronics',
    image: 'https://picsum.photos/seed/sony/600/600',
    rating: 4.9
  },
  {
    id: '4',
    name: 'Men Regular Fit Solid Spread Collar Casual Shirt',
    description: 'High quality cotton blend fabric, perfect for casual outings.',
    price: 499,
    category: 'Fashion',
    image: 'https://picsum.photos/seed/shirt-prod/600/600',
    rating: 4.2
  },
  {
    id: '5',
    name: 'LG 1.5 Ton 5 Star AI DUAL Inverter Split AC',
    description: 'Super Convertible 6-in-1 Cooling, HD Filter with Anti-Virus Protection.',
    price: 44990,
    category: 'Appliances',
    image: 'https://picsum.photos/seed/ac/600/600',
    rating: 4.4
  },
  {
    id: '6',
    name: 'Canon EOS R6 Mark II Mirrorless Camera',
    description: '24.2 MP Full-Frame CMOS Sensor, 4K60p 10-Bit Internal Video.',
    price: 215995,
    category: 'Electronics',
    image: 'https://picsum.photos/seed/canon/600/600',
    rating: 4.8
  },
  {
    id: '7',
    name: 'Nike Air Jordan 1 Retro High OG',
    description: 'Classic basketball sneakers with premium leather and iconic design.',
    price: 16995,
    category: 'Fashion',
    image: 'https://picsum.photos/seed/jordan/600/600',
    rating: 4.9
  },
  {
    id: '8',
    name: 'Dell XPS 13 Laptop',
    description: 'Intel Core i7, 16GB RAM, 512GB SSD, 13.4-inch FHD+ Display.',
    price: 105000,
    category: 'Electronics',
    image: 'https://picsum.photos/seed/dell/600/600',
    rating: 4.6
  }
];
