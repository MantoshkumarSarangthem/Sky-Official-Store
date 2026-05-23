import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartPackage {
  id: number;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  name: string | null;
  category: string | null;
}

export interface CartItem {
  pkg: CartPackage;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (pkg: CartPackage) => void;
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  totalDiamonds: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "sky_cart_v1";

function loadCart(): CartItem[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = useCallback((pkg: CartPackage) => {
    setItems(prev => {
      const existing = prev.find(i => i.pkg.id === pkg.id);
      if (existing) {
        return prev.map(i => i.pkg.id === pkg.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { pkg, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setItems(prev => prev.filter(i => i.pkg.id !== id));
  }, []);

  const updateQty = useCallback((id: number, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.pkg.id !== id));
    } else {
      setItems(prev => prev.map(i => i.pkg.id === id ? { ...i, quantity: qty } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + parseFloat(i.pkg.price) * i.quantity, 0);
  const totalDiamonds = items.reduce((s, i) => s + i.pkg.diamonds * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQty, clearCart, totalItems, totalPrice, totalDiamonds }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
