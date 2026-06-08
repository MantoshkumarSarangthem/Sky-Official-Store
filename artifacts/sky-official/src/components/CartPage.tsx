import { useLocation } from "wouter";
import { useCart } from "../context/CartContext";
import { setSelectedPackage } from "./PaymentPage";
import { setAfterTargetPath } from "./MLBBTargetPage";

export default function CartPage() {
  const [, setLocation] = useLocation();
  const { items, removeFromCart, updateQty, clearCart, totalPrice, totalDiamonds } = useCart();

  function handleCheckout() {
    setSelectedPackage({
      id: 0,
      diamonds: totalDiamonds,
      bonus_diamonds: 0,
      price: totalPrice.toFixed(2),
      name: "Cart Order",
      category: null,
    });
    setAfterTargetPath("/pay");
    setLocation("/mlbb-target");
  }

  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 80 }}>
      <style>{`
        @keyframes cartIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(230,222,211,0.97)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button
          onClick={() => window.history.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>My Cart</div>
          <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10 }}>{items.reduce((s, i) => s + i.quantity, 0)} item(s)</div>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "5px 12px", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            Clear All
          </button>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 14px 0", display: "flex", flexDirection: "column", gap: 12 }}>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", animation: "cartIn 0.4s ease both" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(197,180,162,0.15)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="rgba(61,43,31,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Your cart is empty</div>
            <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 13, marginBottom: 24 }}>Add diamond packs to your cart and buy them together</div>
            <button
              onClick={() => setLocation("/packages")}
              style={{ padding: "13px 32px", borderRadius: 14, background: "#8D6E63", color: "#FFFFFF", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(141,110,99,0.35)" }}
            >
              Browse Packages
            </button>
          </div>
        ) : (
          <>
            {/* Cart items */}
            {items.map((item, i) => (
              <div
                key={item.pkg.id}
                style={{ background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 18, padding: "16px", animation: `cartIn 0.35s ease ${i * 0.05}s both`, display: "flex", gap: 14, alignItems: "center", boxShadow: "0 2px 8px rgba(61,43,31,0.05)" }}
              >
                {/* Diamond icon */}
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(168,148,130,0.1)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 22 }}>♦</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                    {item.pkg.name || `${item.pkg.diamonds.toLocaleString()} Diamonds`}
                  </div>
                  <div style={{ color: "#38bdf8", fontSize: 12, marginTop: 2 }}>
                    ♦ {item.pkg.diamonds.toLocaleString()}
                    {item.pkg.bonus_diamonds > 0 && <span style={{ color: "#4ade80" }}> +{item.pkg.bonus_diamonds.toLocaleString()} bonus</span>}
                  </div>
                  <div style={{ color: "#A89482", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                    ₹{(parseFloat(item.pkg.price) * item.quantity).toLocaleString("en-IN")}
                    {item.quantity > 1 && <span style={{ color: "rgba(61,43,31,0.35)", fontWeight: 400, fontSize: 11 }}> (₹{Number(item.pkg.price).toLocaleString("en-IN")} each)</span>}
                  </div>
                </div>

                {/* Quantity controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => updateQty(item.pkg.id, item.quantity - 1)}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", color: "#3D2B1F", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                  >
                    −
                  </button>
                  <span style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 15, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.pkg.id, item.quantity + 1)}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(168,148,130,0.12)", border: "1px solid rgba(197,180,162,0.5)", color: "#A89482", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.pkg.id)}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Order summary */}
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 18, padding: "4px 20px", animation: "cartIn 0.35s ease 0.2s both", boxShadow: "0 2px 8px rgba(61,43,31,0.05)" }}>
              {[
                { label: "Total Diamonds", value: `♦ ${totalDiamonds.toLocaleString()}`, accent: true },
                { label: "Total Items", value: `${items.reduce((s, i) => s + i.quantity, 0)} packs` },
              ].map(({ label, value, accent }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(197,180,162,0.2)" }}>
                  <span style={{ color: "rgba(61,43,31,0.45)", fontSize: 13 }}>{label}</span>
                  <span style={{ color: accent ? "#38bdf8" : "#3D2B1F", fontWeight: 700, fontSize: 13 }}>{value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0" }}>
                <span style={{ color: "rgba(61,43,31,0.6)", fontSize: 14, fontWeight: 600 }}>Total Amount</span>
                <span style={{ color: "#A89482", fontWeight: 900, fontSize: 20 }}>₹{totalPrice.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              style={{ width: "100%", padding: "16px 0", borderRadius: 16, background: "#A89482", color: "#FAF9F6", fontWeight: 800, fontSize: 17, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(168,148,130,0.4)", animation: "cartIn 0.35s ease 0.25s both" }}
            >
              Proceed to Payment — ₹{totalPrice.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
            </button>
            <button
              onClick={() => setLocation("/packages")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 14, background: "rgba(61,43,31,0.04)", border: "1px solid rgba(197,180,162,0.4)", color: "rgba(61,43,31,0.55)", fontSize: 14, cursor: "pointer" }}
            >
              + Add More Packs
            </button>
          </>
        )}
      </div>
    </div>
  );
}
