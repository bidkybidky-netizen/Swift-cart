export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export interface ReferralInfo {
  code: string;
  totalEarned: number;
  referralsCount: number;
}

export interface Reward {
  id: string;
  amount: number;
  date: string;
  status: 'pending' | 'completed';
  friendName: string;
}
