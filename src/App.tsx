/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  ShoppingCart, 
  ShoppingBag,
  Search, 
  X, 
  Plus, 
  Minus, 
  Star, 
  MessageSquare, 
  Send,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Trash2,
  User as UserIcon,
  Menu,
  Heart,
  Gift,
  Share2,
  Copy,
  Check,
  Trophy,
  Users,
  LogOut,
  LogIn,
  Wallet,
  Video,
  VideoOff,
  Clapperboard,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Product, CartItem, Message, ReferralInfo, Reward } from './types';
import { PRODUCTS, CATEGORIES } from './constants';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  doc, getDoc, setDoc, collection, query, where, onSnapshot, getDocs, updateDoc, increment, serverTimestamp, 
  handleFirestoreError, OperationType, FirebaseUser, writeBatch
} from './firebase';
import { getDocFromServer } from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong. Please try refreshing the page.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = `Error: ${parsed.error}`;
      } catch (e) {}

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
          <div className="bg-white p-8 rounded-sm shadow-xl max-w-md w-full text-center">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Application Error</h2>
            <p className="text-neutral-600 mb-6 text-sm">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-fk-blue text-white px-8 py-2 rounded-sm font-bold"
            >
              RETRY
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const BANNERS = [
  'https://picsum.photos/seed/banner1/1600/400',
  'https://picsum.photos/seed/banner2/1600/400',
  'https://picsum.photos/seed/banner3/1600/400',
];

const MOCK_REWARDS: Reward[] = [
  { id: '1', amount: 100, date: '2026-03-10', status: 'completed', friendName: 'Rahul Sharma' },
  { id: '2', amount: 100, date: '2026-03-12', status: 'pending', friendName: 'Priya Singh' },
];

export default function App() {
  return (
    <ErrorBoundary>
      <SwiftKartApp />
    </ErrorBoundary>
  );
}

function SwiftKartApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isReferModalOpen, setIsReferModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBanner, setCurrentBanner] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [currentView, setCurrentView] = useState<'shop' | 'video'>('shop');
  
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Namaste! I\'m your SwiftKart assistant. Looking for the best deals today? You can also refer friends to earn ₹100!' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth & Profile Logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Check/Create Profile
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              referralCode: `SWIFT${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              totalEarned: 0,
              referralsCount: 0,
              createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          } else {
            setUserProfile(userDoc.data());
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUserProfile(null);
        setRewards([]);
      }
    });

    // Test Connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  // Real-time Rewards Listener
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'referrals'), where('referrerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rewardsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().timestamp?.toDate()?.toLocaleDateString() || 'Just now'
      })) as any[];
      setRewards(rewardsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'referrals');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const applyReferralCode = async () => {
    if (!user || !referralCodeInput.trim() || isApplyingCode) return;
    
    setIsApplyingCode(true);
    setReferralStatus(null);

    try {
      // 1. Find the referrer
      const q = query(collection(db, 'users'), where('referralCode', '==', referralCodeInput.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setReferralStatus({ type: 'error', message: 'Invalid referral code.' });
        setIsApplyingCode(false);
        return;
      }

      const referrerDoc = querySnapshot.docs[0];
      const referrerData = referrerDoc.data();

      if (referrerData.uid === user.uid) {
        setReferralStatus({ type: 'error', message: 'You cannot use your own code.' });
        setIsApplyingCode(false);
        return;
      }

      // 2. Check if user already used a code (simplified check)
      const refCheckQ = query(collection(db, 'referrals'), where('referredUid', '==', user.uid));
      const refCheckSnapshot = await getDocs(refCheckQ);
      if (!refCheckSnapshot.empty) {
        setReferralStatus({ type: 'error', message: 'You have already used a referral code.' });
        setIsApplyingCode(false);
        return;
      }

      // 3. Create referral record and update referrer stats atomically
      const batch = writeBatch(db);
      
      // Referral ID is structured as referredUid_referrerUid to match security rules
      const referralId = `${user.uid}_${referrerData.uid}`;
      const referralRef = doc(db, 'referrals', referralId);
      
      batch.set(referralRef, {
        referrerUid: referrerData.uid,
        referredUid: user.uid,
        friendName: user.displayName || 'A Friend',
        amount: 100,
        status: 'completed',
        timestamp: serverTimestamp()
      });

      // 4. Update referrer stats
      const referrerRef = doc(db, 'users', referrerData.uid);
      batch.update(referrerRef, {
        totalEarned: increment(100),
        referralsCount: increment(1)
      });

      await batch.commit();

      setReferralStatus({ type: 'success', message: 'Code applied! ₹100 reward added.' });
      setReferralCodeInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'referrals');
    } finally {
      setIsApplyingCode(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (!userProfile?.referralCode) return;
    const text = `Hey! Join SwiftKart and get ₹100 off on your first purchase using my referral code: ${userProfile.referralCode}. Download now: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredProducts = PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const copyToClipboard = () => {
    if (userProfile?.referralCode) {
      navigator.clipboard.writeText(userProfile.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are a helpful shopping assistant for SwiftKart (inspired by Flipkart). 
          Available products: ${JSON.stringify(PRODUCTS.map(p => ({ name: p.name, price: p.price, category: p.category })))}.
          Referral Program: Users can share their unique code to earn ₹100 per friend who joins.
          Help users find products, compare prices, and suggest deals. 
          Be polite, energetic, and helpful. Use a bit of Indian context where appropriate.`,
        },
      });

      const response = await chat.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900">
      {/* Flipkart Blue Header */}
      <nav className="bg-fk-blue text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4 md:gap-8">
          <div className="flex flex-col items-start leading-none cursor-pointer" onClick={() => { setCurrentView('shop'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="text-xl font-bold italic tracking-tight">SwiftKart</span>
            <span className="text-[10px] italic flex items-center gap-0.5 text-neutral-200">
              Explore <span className="text-fk-yellow font-bold">Plus</span>
              <img src="https://static-assets-web.flixcart.com/fk-p-linchpin-web/fk-cp-zion/img/plus_aef861.png" className="w-2.5 h-2.5" alt="plus" />
            </span>
          </div>

          <div className="flex-1 max-w-xl relative">
            <input 
              type="text"
              placeholder="Search for products, brands and more"
              className="w-full py-2 pl-4 pr-10 rounded-sm text-neutral-900 text-sm outline-none shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fk-blue" />
          </div>

          <div className="hidden lg:flex items-center gap-8 font-bold text-sm">
            {user ? (
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-fk-yellow">
                    <Wallet className="w-4 h-4" />
                    <span>₹{userProfile?.totalEarned || 0}</span>
                  </div>
                  <span className="text-[10px] text-white/60 uppercase tracking-tighter">Wallet Balance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
                    <img src={user.photoURL || ''} alt="profile" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs">{user.displayName}</span>
                </div>
                <button onClick={handleLogout} className="text-white/80 hover:text-white flex items-center gap-1">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-white text-fk-blue px-8 py-1 rounded-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}
            <button 
              onClick={() => setIsReferModalOpen(true)}
              className="flex items-center gap-2 hover:text-fk-yellow transition-colors"
            >
              <Gift className="w-4 h-4" />
              <span>Refer & Earn</span>
            </button>

            <button 
              onClick={() => setCurrentView(currentView === 'shop' ? 'video' : 'shop')}
              className={`flex items-center gap-2 transition-colors ${currentView === 'video' ? 'text-fk-yellow' : 'hover:text-fk-yellow'}`}
            >
              {currentView === 'shop' ? (
                <>
                  <Clapperboard className="w-4 h-4" />
                  <span>Ad Studio</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Shop</span>
                </>
              )}
            </button>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 relative hover:text-neutral-200"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-fk-orange text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <button className="lg:hidden p-2">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Category Bar */}
      <div className="bg-white border-b border-neutral-200 overflow-x-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between gap-8 min-w-max">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className="flex flex-col items-center gap-1 cursor-pointer group">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="text-xs font-bold text-neutral-700 group-hover:text-fk-blue">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {currentView === 'shop' ? (
        <>
          {/* Hero Carousel */}
          <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="relative aspect-[4/1] bg-neutral-200 overflow-hidden rounded-sm shadow-sm group">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentBanner}
              src={BANNERS[currentBanner]}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          <button 
            onClick={() => setCurrentBanner(prev => (prev - 1 + BANNERS.length) % BANNERS.length)}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 p-4 rounded-r-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6 text-neutral-800" />
          </button>
          <button 
            onClick={() => setCurrentBanner(prev => (prev + 1) % BANNERS.length)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 p-4 rounded-l-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6 text-neutral-800" />
          </button>
        </div>
      </div>

      {/* Refer & Earn Banner */}
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <motion.div 
          whileHover={{ scale: 1.01 }}
          onClick={() => setIsReferModalOpen(true)}
          className="bg-gradient-to-r from-fk-blue to-blue-700 rounded-sm p-4 flex items-center justify-between cursor-pointer shadow-md text-white"
        >
          <div className="flex items-center gap-4">
            <div className="bg-fk-yellow p-3 rounded-full">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Refer & Earn ₹100</h3>
              <p className="text-xs text-blue-100">Invite your friends to SwiftKart and get rewards on their first purchase!</p>
            </div>
          </div>
          <button className="bg-fk-yellow text-white px-6 py-2 rounded-sm font-bold text-sm shadow-lg">REFER NOW</button>
        </motion.div>
      </div>

      {/* Deals Section */}
      <main className="max-w-7xl mx-auto px-4 pb-12 space-y-4">
        <div className="bg-white shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold">Deals of the Day</h2>
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>18:24:42 Left</span>
            </div>
          </div>
          <button className="bg-fk-blue text-white px-4 py-2 rounded-sm text-sm font-bold shadow-sm hover:bg-blue-600 transition-colors">VIEW ALL</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {filteredProducts.map((product) => (
            <motion.div 
              layout
              key={product.id}
              className="bg-white p-4 flex flex-col items-center text-center group cursor-pointer hover:shadow-lg transition-shadow border border-neutral-50"
            >
              <div className="relative aspect-square w-full mb-4 overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <button className="absolute top-0 right-0 p-1 text-neutral-300 hover:text-fk-orange">
                  <Heart className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-sm font-bold text-neutral-800 line-clamp-1 mb-1">{product.name}</h3>
              <div className="flex items-center gap-1 mb-1">
                <div className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  {product.rating} <Star className="w-2 h-2 fill-white" />
                </div>
                <span className="text-[10px] text-neutral-400 font-bold">(2,345)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">₹{product.price.toLocaleString()}</span>
                <span className="text-[10px] text-neutral-400 line-through">₹{(product.price * 1.2).toLocaleString()}</span>
                <span className="text-[10px] text-green-600 font-bold">20% off</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(product);
                }}
                className="mt-4 w-full bg-fk-yellow text-white py-2 rounded-sm text-xs font-bold hover:bg-orange-500 transition-colors"
              >
                ADD TO CART
              </button>
            </motion.div>
          ))}
        </div>
      </main>
    </>
  ) : (
    <VideoStudio />
  )}

      {/* Refer & Earn Modal */}
      <AnimatePresence>
        {isReferModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReferModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-sm shadow-2xl z-[110] overflow-hidden flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              <div className="bg-fk-blue p-6 text-white text-center relative">
                <button 
                  onClick={() => setIsReferModalOpen(false)}
                  className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="bg-fk-yellow w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Refer & Earn Rewards!</h2>
                <p className="text-blue-100 text-sm">Share the joy of shopping with your friends and earn ₹100 for every successful referral.</p>
              </div>

              {!user ? (
                <div className="p-12 text-center space-y-4">
                  <div className="bg-neutral-50 p-6 rounded-sm border border-neutral-100">
                    <UserIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-600 font-bold mb-4">Login to see your unique referral code and track rewards.</p>
                    <button 
                      onClick={handleLogin}
                      className="bg-fk-blue text-white px-8 py-3 rounded-sm font-bold shadow-md hover:bg-blue-600 transition-colors uppercase"
                    >
                      Login with Google
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Referral Code Section */}
                  <div className="text-center">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Your Referral Code</p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="bg-neutral-100 border-2 border-dashed border-neutral-300 px-8 py-3 rounded-sm font-mono text-xl font-bold text-fk-blue">
                        {userProfile?.referralCode || 'LOADING...'}
                      </div>
                      <button 
                        onClick={copyToClipboard}
                        className="bg-fk-blue text-white p-3 rounded-sm hover:bg-blue-600 transition-colors"
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    {copied && <p className="text-emerald-600 text-[10px] font-bold mt-2">Code copied to clipboard!</p>}
                  </div>

                  {/* Stats Section */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-50 p-4 rounded-sm border border-neutral-100 text-center">
                      <Users className="w-5 h-5 text-fk-blue mx-auto mb-2" />
                      <p className="text-2xl font-bold text-neutral-800">{userProfile?.referralsCount || 0}</p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Referrals</p>
                    </div>
                    <div className="bg-neutral-50 p-4 rounded-sm border border-neutral-100 text-center">
                      <Trophy className="w-5 h-5 text-fk-yellow mx-auto mb-2" />
                      <p className="text-2xl font-bold text-neutral-800">₹{userProfile?.totalEarned || 0}</p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Earned</p>
                    </div>
                  </div>

                  {/* How it Works */}
                  <div className="bg-blue-50 p-4 rounded-sm border border-blue-100">
                    <h3 className="font-bold text-sm mb-3 text-fk-blue">How it Works</h3>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-5 h-5 bg-fk-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                        <p className="text-xs text-neutral-600">Share your unique referral code with your friends.</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-5 h-5 bg-fk-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                        <p className="text-xs text-neutral-600">Your friend joins SwiftKart and makes their first purchase.</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-5 h-5 bg-fk-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                        <p className="text-xs text-neutral-600">You both get ₹100 rewards in your SwiftKart wallet!</p>
                      </div>
                    </div>
                  </div>

                  {/* Rewards History */}
                  <div>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-fk-yellow" />
                      Recent Rewards
                    </h3>
                    <div className="space-y-3">
                      {rewards.length === 0 ? (
                        <p className="text-xs text-neutral-400 text-center py-4 italic">No rewards yet. Start sharing!</p>
                      ) : (
                        rewards.map(reward => (
                          <div key={reward.id} className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-sm shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center font-bold text-neutral-500 text-xs">
                                {reward.friendName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{reward.friendName}</p>
                                <p className="text-[10px] text-neutral-400">{reward.date}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">+₹{reward.amount}</p>
                              <p className={`text-[10px] font-bold uppercase ${reward.status === 'completed' ? 'text-emerald-500' : 'text-fk-orange'}`}>
                                {reward.status}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Share Options */}
                  <div className="pt-4">
                    <button 
                      onClick={shareOnWhatsApp}
                      className="w-full bg-fk-orange text-white py-4 rounded-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider"
                    >
                      <Share2 className="w-5 h-5" />
                      Share on WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween' }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-neutral-100 shadow-2xl z-[70] flex flex-col"
            >
              <div className="bg-white p-4 border-b border-neutral-200 flex items-center justify-between">
                <h2 className="text-lg font-bold">My Cart ({cartCount})</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 bg-white rounded-sm">
                    <img src="https://static-assets-web.flixcart.com/fk-p-linchpin-web/fk-cp-zion/img/empty-cart_ee6143.png" className="w-40 mb-4" alt="empty" />
                    <p className="text-lg font-bold text-neutral-800">Your cart is empty!</p>
                    <p className="text-sm">Add items to it now.</p>
                  </div>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div key={item.id} className="bg-white p-4 rounded-sm flex gap-4 shadow-sm">
                        <img src={item.image} alt={item.name} className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold mb-1">{item.name}</h4>
                          <p className="text-xs text-neutral-400 mb-2">Seller: SwiftKart Retail</p>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg font-bold">₹{item.price.toLocaleString()}</span>
                            <span className="text-xs text-green-600 font-bold">1 Offer Applied</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 border border-neutral-200 rounded-full flex items-center justify-center hover:bg-neutral-50">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 border border-neutral-200 rounded-full flex items-center justify-center hover:bg-neutral-50">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-sm font-bold hover:text-fk-blue uppercase">Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Referral Code Input in Cart */}
                    <div className="bg-white p-4 rounded-sm shadow-sm border border-neutral-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-fk-blue" />
                          <span className="text-sm font-bold">Have a Referral Code?</span>
                        </div>
                        {referralStatus && (
                          <span className={`text-[10px] font-bold ${referralStatus.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {referralStatus.message}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Enter code"
                          value={referralCodeInput}
                          onChange={(e) => setReferralCodeInput(e.target.value)}
                          disabled={!user || isApplyingCode}
                          className="flex-1 border border-neutral-200 rounded-sm px-3 py-2 text-sm outline-none focus:border-fk-blue disabled:bg-neutral-50"
                        />
                        <button 
                          onClick={applyReferralCode}
                          disabled={!user || isApplyingCode || !referralCodeInput.trim()}
                          className="bg-fk-blue text-white px-4 py-2 rounded-sm text-xs font-bold disabled:opacity-50 flex items-center gap-2"
                        >
                          {isApplyingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'APPLY'}
                        </button>
                      </div>
                      {!user && <p className="text-[10px] text-neutral-400 mt-2">Please login to apply referral code.</p>}
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="bg-white p-4 border-t border-neutral-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">₹{cartTotal.toLocaleString()}</span>
                      <span className="text-[10px] text-fk-blue font-bold cursor-pointer">View Price Details</span>
                    </div>
                    <button className="bg-fk-orange text-white px-12 py-3 rounded-sm font-bold shadow-md hover:bg-orange-600 transition-colors uppercase tracking-wider">
                      Place Order
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AI Assistant - Styled for SwiftKart */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 right-0 w-80 md:w-96 bg-white rounded-sm shadow-2xl border border-neutral-200 overflow-hidden flex flex-col"
              style={{ height: '500px' }}
            >
              <div className="p-4 bg-fk-blue text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="https://static-assets-web.flixcart.com/fk-p-linchpin-web/fk-cp-zion/img/plus_aef861.png" className="w-4 h-4" alt="plus" />
                  <span className="font-bold">SwiftKart AI Helper</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-sm text-sm shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-fk-blue text-white' 
                        : 'bg-white text-neutral-800 border border-neutral-100'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-sm border border-neutral-100 shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-fk-blue" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200 flex gap-2 bg-white">
                <input 
                  type="text"
                  placeholder="Ask me about today's deals..."
                  className="flex-1 bg-neutral-100 border-none rounded-sm px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-fk-blue"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={isTyping}
                  className="bg-fk-blue text-white p-2 rounded-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-fk-blue text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-transform active:scale-95 flex items-center gap-2"
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          {!isChatOpen && <span className="hidden md:block font-bold text-sm">Ask AI</span>}
        </button>
      </div>

      {/* Footer - Flipkart Style */}
      <footer className="bg-[#172337] text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-12 border-b border-neutral-700 pb-12">
            <div className="space-y-2">
              <h4 className="text-neutral-400 text-xs font-bold uppercase mb-4">About</h4>
              <ul className="text-xs space-y-2">
                <li>Contact Us</li>
                <li>About Us</li>
                <li>Careers</li>
                <li className="cursor-pointer hover:text-fk-yellow" onClick={() => setIsReferModalOpen(true)}>Refer & Earn</li>
                <li>SwiftKart Stories</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-neutral-400 text-xs font-bold uppercase mb-4">Help</h4>
              <ul className="text-xs space-y-2">
                <li>Payments</li>
                <li>Shipping</li>
                <li>Cancellation</li>
                <li>FAQ</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-neutral-400 text-xs font-bold uppercase mb-4">Policy</h4>
              <ul className="text-xs space-y-2">
                <li>Return Policy</li>
                <li>Terms Of Use</li>
                <li>Security</li>
                <li>Privacy</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-neutral-400 text-xs font-bold uppercase mb-4">Social</h4>
              <ul className="text-xs space-y-2">
                <li>Facebook</li>
                <li>Twitter</li>
                <li>YouTube</li>
              </ul>
            </div>
            <div className="col-span-2 border-l border-neutral-700 pl-8 hidden lg:block">
              <h4 className="text-neutral-400 text-xs font-bold uppercase mb-4">Mail Us:</h4>
              <p className="text-xs leading-relaxed text-neutral-300">
                SwiftKart Internet Private Limited,<br />
                Buildings Alyssa, Begonia &<br />
                Clove Embassy Tech Village,<br />
                Outer Ring Road, Devarabeesanahalli Village,<br />
                Bengaluru, 560103,<br />
                Karnataka, India
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-neutral-300">
            <div className="flex gap-8">
              <span className="flex items-center gap-1"><ShoppingBag className="w-4 h-4 text-fk-yellow" /> Become a Seller</span>
              <span className="flex items-center gap-1"><Star className="w-4 h-4 text-fk-yellow" /> Advertise</span>
              <span className="flex items-center gap-1"><Heart className="w-4 h-4 text-fk-yellow" /> Gift Cards</span>
              <span className="flex items-center gap-1 text-fk-yellow">Help Center</span>
            </div>
            <span>© 2026 SwiftKart.com</span>
            <img src="https://static-assets-web.flixcart.com/fk-p-linchpin-web/fk-cp-zion/img/payment-method_69e7bc.svg" alt="payments" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function VideoStudio() {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [lastOperation, setLastOperation] = useState<any>(null);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setVideoUrl(null);
    setLastOperation(null);
    setStatus('Initializing AI Video Engine...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      setStatus('Dreaming up your video... (This may take a minute)');
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
        setStatus(`Processing... ${Math.random() > 0.5 ? 'Adding cinematic lighting' : 'Refining textures'}`);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.API_KEY || '',
          },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
        setLastOperation(operation);
        setStatus('Video generated successfully!');
      }
    } catch (error: any) {
      console.error("Video Generation Error:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setStatus('API Key error. Please re-select your key.');
      } else {
        setStatus('Failed to generate video. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const extendVideo = async () => {
    if (!lastOperation || isExtending) return;

    setIsExtending(true);
    setStatus('Extending your masterpiece... (+7 seconds)');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: 'continue the scene with more action and cinematic detail',
        video: lastOperation.response?.generatedVideos?.[0]?.video,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.API_KEY || '',
          },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
        setLastOperation(operation);
        setStatus('Video extended successfully!');
      }
    } catch (error) {
      console.error("Video Extension Error:", error);
      setStatus('Failed to extend video.');
    } finally {
      setIsExtending(false);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-white p-12 rounded-sm shadow-xl border border-neutral-100">
          <div className="bg-fk-blue/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-fk-blue" />
          </div>
          <h2 className="text-3xl font-bold mb-4">SwiftKart AI Ad Studio</h2>
          <p className="text-neutral-600 mb-8 max-w-md mx-auto">
            Create professional cinematic advertisements for your products using the power of Google Veo. 
            To get started, you need to select a paid Google Cloud API key.
          </p>
          <div className="space-y-4">
            <button 
              onClick={handleSelectKey}
              className="bg-fk-blue text-white px-10 py-4 rounded-sm font-bold shadow-lg hover:bg-blue-600 transition-all transform hover:scale-105 uppercase tracking-wider"
            >
              Select API Key to Start
            </button>
            <p className="text-[10px] text-neutral-400">
              Note: This feature requires a paid Google Cloud project with billing enabled. 
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-fk-blue underline ml-1">Learn more</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-sm shadow-sm border border-neutral-100">
            <div className="flex items-center gap-2 mb-6">
              <Clapperboard className="w-6 h-6 text-fk-blue" />
              <h2 className="text-xl font-bold">Create Cinematic Ad</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Video Prompt</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A cinematic close-up of a high-end smartphone on a marble table with soft golden hour lighting, 4k, highly detailed..."
                  className="w-full h-32 p-4 bg-neutral-50 border border-neutral-200 rounded-sm text-sm outline-none focus:border-fk-blue transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={generateVideo}
                  disabled={isGenerating || !prompt.trim()}
                  className={`flex-1 py-4 rounded-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    isGenerating || !prompt.trim() 
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' 
                    : 'bg-fk-blue text-white hover:bg-blue-600 shadow-md'
                  }`}
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGenerating ? 'Generating...' : 'Generate Video'}
                </button>
                
                {videoUrl && (
                  <button 
                    onClick={extendVideo}
                    disabled={isExtending}
                    className={`px-6 rounded-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      isExtending 
                      ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' 
                      : 'bg-fk-orange text-white hover:bg-orange-600 shadow-md'
                    }`}
                  >
                    {isExtending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Extend (+7s)
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-sm border border-blue-100">
            <h3 className="font-bold text-sm mb-4 text-fk-blue">Pro Tips for Best Results</h3>
            <ul className="text-xs space-y-3 text-neutral-600">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-fk-blue rounded-full mt-1 shrink-0" />
                <span>Be descriptive about lighting (e.g., "cinematic lighting", "neon glow", "soft sunlight").</span>
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-fk-blue rounded-full mt-1 shrink-0" />
                <span>Specify the camera movement (e.g., "slow zoom in", "panning shot", "drone view").</span>
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-fk-blue rounded-full mt-1 shrink-0" />
                <span>Mention the environment and textures (e.g., "futuristic city", "wooden desk", "glossy finish").</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-neutral-900 aspect-video rounded-sm shadow-2xl flex items-center justify-center overflow-hidden relative group border-4 border-neutral-800">
            {videoUrl ? (
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-8">
                {isGenerating ? (
                  <div className="space-y-4">
                    <Loader2 className="w-12 h-12 text-fk-blue animate-spin mx-auto" />
                    <p className="text-white font-medium animate-pulse">{status}</p>
                  </div>
                ) : (
                  <>
                    <VideoOff className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500 text-sm">Your generated ad will appear here</p>
                  </>
                )}
              </div>
            )}
          </div>
          
          {status && !isGenerating && !isExtending && (
            <div className="bg-white p-4 rounded-sm border border-neutral-100 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <p className="text-xs font-medium text-neutral-600">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
