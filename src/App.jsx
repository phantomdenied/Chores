import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUDINARY_CLOUD = "dxxlptkzf";
const CLOUDINARY_PRESET = "chore_app";
const MASTER_PIN = null; // Dad's PIN (pins.dad) is the only master

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// -- UTILS --
const resizeImage = (dataUrl, maxW = 800) =>
  new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = dataUrl;
  });

const fileToDataUrl = file =>
  new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.readAsDataURL(file);
  });

const uploadPhoto = async (dataUrl) => {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST", body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
};

// Extract ASIN from any Amazon URL
const extractAsin = (url) => {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/ASIN\/([A-Z0-9]{10})/,
    /asin=([A-Z0-9]{10})/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

// Resolve short URL and scrape Amazon product
const scrapeAmazon = async (inputUrl) => {
  // Step 1: Follow redirects to get full URL (handles a.co short links)
  let fullUrl = inputUrl;
  try {
    // corsproxy.io follows redirects and returns final URL in headers
    const headRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(inputUrl)}`, { method: "HEAD" });
    fullUrl = headRes.url || inputUrl;
  } catch {}

  // Also try allorigins which returns redirect destination
  if (!extractAsin(fullUrl)) {
    try {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(inputUrl)}`);
      const j = await r.json();
      const finalUrl = j.status?.url || "";
      if (finalUrl.includes("amazon.com")) fullUrl = finalUrl;
      // Sometimes it's buried in contents as a redirect
      const match = (j.contents || "").match(/https:\/\/www\.amazon\.com\/[^"'\s]*/);
      if (match && extractAsin(match[0])) fullUrl = match[0];
    } catch {}
  }

  const asin = extractAsin(fullUrl) || extractAsin(inputUrl);

  // Step 2: Fetch product page via corsproxy.io (better than allorigins for Amazon)
  let title = "Amazon Item";
  let price = 0;
  let img = null;

  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(fullUrl)}`);
    const html = await res.text();
    const d = new DOMParser().parseFromString(html, "text/html");

    title = d.querySelector("#productTitle")?.textContent?.trim() ||
      d.querySelector("meta[property='og:title']")?.getAttribute("content") ||
      d.querySelector("meta[name='title']")?.getAttribute("content") ||
      d.querySelector("title")?.textContent?.replace("Amazon.com:", "").trim() ||
      "Amazon Item";

    const pw = d.querySelector(".a-price-whole")?.textContent?.replace(/[^0-9]/g, "") || "";
    const pf = d.querySelector(".a-price-fraction")?.textContent?.replace(/[^0-9]/g, "") || "00";
    const priceStr = d.querySelector("meta[property='product:price:amount']")?.getAttribute("content") || "";
    price = priceStr ? parseFloat(priceStr) : (pw ? parseFloat(`${pw}.${pf}`) : 0);

    img = d.querySelector("meta[property='og:image']")?.getAttribute("content") ||
      d.querySelector("#landingImage")?.getAttribute("src") ||
      d.querySelector("#imgBlkFront")?.getAttribute("src") ||
      d.querySelector(".a-dynamic-image")?.getAttribute("src");
  } catch {}

  // Step 3: If we got an ASIN but no image, use Amazon image CDN directly
  if (!img && asin) {
    img = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
  }

  return { title: title.slice(0, 80), price, image: img, url: fullUrl || inputUrl };
};

const formatDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// -- GLOBAL STYLES --
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,400;1,400&family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; max-width: 100vw; overflow-x: hidden; background: #0a0a0a; overscroll-behavior-x: none; }
    #root { width: 100%; max-width: 100vw; overflow-x: hidden; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes scaleIn { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
    @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
    .float { animation: float 4s ease-in-out infinite; }
    .fade-up { animation: fadeUp 0.4s ease forwards; }
    .fade-in { animation: fadeIn 0.3s ease forwards; }
    .scale-in { animation: scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .shake { animation: shake 0.4s ease; }
    .shimmer-text {
      background: linear-gradient(90deg, #c9a96e, #f0d080, #c9a96e);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 3s linear infinite;
    }
    .zelda-shimmer {
      background: linear-gradient(90deg, #e879f9, #a78bfa, #67e8f9, #a78bfa, #e879f9);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 3s linear infinite;
    }
    .btn { transition: all 0.2s; cursor: pointer; }
    .btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
    .btn:active { transform: scale(0.97) translateY(0); filter: brightness(0.95); }
    .card-hover { transition: all 0.2s; }
    .card-hover:hover { transform: translateY(-2px); filter: brightness(1.06); }
  `}</style>
);

// -- SMART PIN PAD --
const SmartPinPad = ({ onSuccess, correctPin, onBack, accentColor, masterPin, setupMode, onFourDigits }) => {
  const inputRef = useRef("");
  const [dots, setDots] = useState(0);
  const [shake, setShake] = useState(false);

  const press = (d) => {
    if (inputRef.current.length >= 4) return;
    inputRef.current += d;
    setDots(inputRef.current.length);
    if (inputRef.current.length === 4) {
      const val = inputRef.current;
      if (setupMode) {
        inputRef.current = "";
        setDots(0);
        onFourDigits && onFourDigits(val);
        return;
      }
      const ok = val === correctPin || (masterPin && val === masterPin);
      if (ok) {
        onSuccess(val === masterPin ? "master" : "own");
      } else {
        setShake(true);
        setTimeout(() => { inputRef.current = ""; setDots(0); setShake(false); }, 500);
      }
    }
  };

  const del = () => {
    if (inputRef.current.length === 0) return;
    inputRef.current = inputRef.current.slice(0, -1);
    setDots(inputRef.current.length);
  };

  const keys = [1,2,3,4,5,6,7,8,9,"",0,"del"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div className={shake ? "shake" : ""} style={{ display: "flex", gap: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < dots ? accentColor : "rgba(255,255,255,0.15)",
            border: `1.5px solid ${i < dots ? accentColor : "rgba(255,255,255,0.2)"}`,
            transition: "background 0.1s",
            transform: i < dots ? "scale(1.15)" : "scale(1)",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {keys.map((d, i) => (
          <button key={i}
            onPointerDown={(e) => { e.preventDefault(); if (d === "del") del(); else if (d !== "") press(String(d)); }}
            style={{
              width: 68, height: 68, borderRadius: 16,
              background: d === "" ? "transparent" : "rgba(255,255,255,0.06)",
              border: d === "" ? "none" : "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: d === "del" ? 13 : 22,
              fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
              cursor: d === "" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >{d === "del" ? "DEL" : d}</button>
        ))}
      </div>
      {onBack && (
        <button onPointerDown={(e) => { e.preventDefault(); onBack(); }} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.3)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer",
          padding: "4px 8px", WebkitTapHighlightColor: "transparent",
        }}>Back</button>
      )}
    </div>
  );
};

// -- LOGIN SCREEN --
const LoginScreen = ({ onLogin, pins, setPins }) => {
  const [selected, setSelected] = useState(null);
  const [setupStage, setSetupStage] = useState(null);
  const [firstPin, setFirstPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const profiles = [
    { id: "dad", name: "Dad", emoji: "\uD83D\uDC68", card: "rgba(200,160,80,0.07)", border: "rgba(200,160,80,0.35)", accent: "#c9a96e", label: "PARENT", font: "'DM Serif Display', serif" },
    { id: "alan", name: "Alan", emoji: "\uD83E\uDDD1", card: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", accent: "#e0e0e0", label: "18", font: "'DM Sans', sans-serif" },
    { id: "zelda", name: "Zelda", emoji: "\uD83E\uDDDA", card: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.35)", accent: "#a78bfa", label: "sparkle", font: "'Cinzel Decorative', cursive" },
  ];

  const p = profiles.find(x => x.id === selected);
  const needsSetup = selected && !pins[selected];

  const handleLoginSuccess = () => onLogin(selected);

  const handleSetupFirst = (pin) => { setFirstPin(pin); setSetupStage("confirm"); setPinError(false); };
  const handleSetupConfirm = async (pin) => {
    if (pin === firstPin) {
      const newPins = { ...pins, [selected]: pin };
      await setDoc(doc(db, "config", "pins"), newPins);
      setPins(newPins);
      onLogin(selected);
    } else {
      setPinError(true);
      setTimeout(() => { setSetupStage("set"); setFirstPin(""); setPinError(false); }, 600);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100%", overflow: "hidden",
      background: "radial-gradient(ellipse at 20% 50%, #1a0533 0%, #0a0a0a 50%, #0d1a0d 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'DM Sans', sans-serif", position: "relative",
    }}>
      <GlobalStyles />
      {[...Array(24)].map((_, i) => (
        <div key={i} style={{
          position: "fixed", borderRadius: "50%", background: "#fff", pointerEvents: "none",
          left: `${5 + (i * 4.7) % 90}%`, top: `${5 + (i * 7.3) % 90}%`,
          width: (i % 3) + 1, height: (i % 3) + 1,
          opacity: 0.08 + (i % 4) * 0.06,
          animation: `pulse ${2 + (i % 3)}s ease-in-out ${(i % 4) * 0.5}s infinite`,
        }} />
      ))}

      {!selected ? (
        <div className="fade-up" style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 10, letterSpacing: 6, color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>FAMILY CHORES</div>
            <div className="shimmer-text" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38 }}>Who's there?</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%" }}>
            {profiles.map((profile, i) => (
              <div key={profile.id} className="btn card-hover"
                onClick={() => { setSelected(profile.id); setSetupStage(null); setFirstPin(""); setPinError(false); }}
                style={{
                  background: profile.card, border: `1px solid ${profile.border}`,
                  borderRadius: 22, padding: "26px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  animation: `fadeUp 0.45s ease ${i * 0.1}s both`, minWidth: 0,
                }}>
                <div style={{ fontSize: 42 }} className={profile.id === "zelda" ? "float" : ""}>{profile.emoji}</div>
                <div style={{
                  fontFamily: profile.font, fontSize: profile.id === "zelda" ? 12 : 18,
                  color: profile.accent, textAlign: "center", wordBreak: "break-word",
                  letterSpacing: profile.id === "alan" ? 2 : 0,
                }}>{profile.name}</div>
                <div style={{
                  fontSize: 9, color: "rgba(255,255,255,0.25)",
                  border: `1px solid ${profile.border}`,
                  borderRadius: 99, padding: "3px 10px", letterSpacing: 1,
                }}>{profile.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="scale-in" style={{
          background: "rgba(255,255,255,0.03)", border: `1px solid ${p.border}`,
          borderRadius: 28, padding: "36px 32px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          width: "100%", maxWidth: 330, boxShadow: `0 0 60px ${p.accent}18`,
        }}>
          <div style={{ fontSize: 48 }} className={p.id === "zelda" ? "float" : ""}>{p.emoji}</div>
          <div style={{ fontFamily: p.font, fontSize: p.id === "zelda" ? 14 : 22, color: p.accent }}>{p.name}</div>
          {needsSetup ? (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>
                  {setupStage === "confirm" ? "CONFIRM YOUR PIN" : "CREATE YOUR PIN"}
                </div>
                {pinError && <div className="fade-in" style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>PINs didn't match -- try again</div>}
                {!pinError && setupStage === "confirm" && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>Enter it again to confirm</div>}
                {!pinError && !setupStage && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>Choose a 4-digit PIN</div>}
              </div>
              <SmartPinPad
                setupMode={true} accentColor={p.accent}
                onFourDigits={setupStage === "confirm" ? handleSetupConfirm : handleSetupFirst}
                onBack={() => setSelected(null)}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>ENTER PIN</div>
              <SmartPinPad
                correctPin={pins[selected]}
                masterPin={selected !== "dad" ? pins.dad : undefined}
                accentColor={p.accent}
                onSuccess={handleLoginSuccess}
                onBack={() => setSelected(null)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// -- HISTORY MODAL --
const HistoryModal = ({ kid, accentColor, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, `history_${kid}`), orderBy("approvedAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [kid]);

  const total = history.reduce((s, h) => s + (h.value || 0), 0);

  return (
    <div className="fade-in" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(6px)",
    }} onClick={onClose}>
      <div className="scale-in" style={{
        background: "#111", border: `1px solid ${accentColor}30`,
        borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520,
        maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.15)" }} />
        </div>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#fff" }}>Chore History</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginTop: 2 }}>
              {history.length} completed -- ${total.toFixed(2)} earned total
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.5)", width: 32, height: 32, borderRadius: 99, cursor: "pointer", fontSize: 16 }}>x</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 20px 24px" }}>
          {loading && <div style={{ color: "rgba(255,255,255,0.2)", textAlign: "center", padding: 30, fontSize: 13 }}>Loading...</div>}
          {!loading && history.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", textAlign: "center", padding: 40, fontSize: 13, fontStyle: "italic" }}>No completed chores yet</div>}
          {history.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              animation: `slideIn 0.3s ease ${i * 0.04}s both`,
            }}>
              {item.photo && <img src={item.photo} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0, opacity: 0.85 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.choreName}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{formatDate(item.approvedAt)}</div>
              </div>
              <div style={{ color: accentColor, fontFamily: "'DM Serif Display', serif", fontSize: 16, flexShrink: 0 }}>+${item.value?.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// -- DAD DASHBOARD --
const DadDashboard = ({ onLogout, pins, setPins }) => {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [chores, setChores] = useState({ alan: [], zelda: [] });
  const [bills, setBills] = useState([]);
  const [balances, setBalances] = useState({ alan: 0, zelda: 0 });
  const [choreForm, setChoreForm] = useState({ kid: "zelda", name: "", value: "" });
  const [refPhotoPreview, setRefPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [billForm, setBillForm] = useState({ name: "", amount: "" });
  const [resetTarget, setResetTarget] = useState(null);
  const [newPinStage, setNewPinStage] = useState(null);
  const [newPinFirst, setNewPinFirst] = useState("");
  const [pinResetError, setPinResetError] = useState(false);
  const [showHistory, setShowHistory] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "queue"), snap => setQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(doc(db, "balances", "main"), snap => { if (snap.exists()) setBalances(snap.data()); }));
    unsubs.push(onSnapshot(collection(db, "bills"), snap => setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    ["alan", "zelda"].forEach(kid => {
      unsubs.push(onSnapshot(collection(db, `chores_${kid}`), snap => {
        setChores(prev => ({ ...prev, [kid]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }));
    });
    return () => unsubs.forEach(u => u && u());
  }, []);

  const approveItem = async (item) => {
    setApprovingId(item.id);
    try {
      const newBal = { ...balances, [item.kid]: (balances[item.kid] || 0) + (item.value || 0) };
      await setDoc(doc(db, "balances", "main"), newBal);
      await updateDoc(doc(db, `chores_${item.kid}`, item.choreId), { done: true });
      await addDoc(collection(db, `history_${item.kid}`), {
        choreName: item.choreName, value: item.value,
        photo: item.photo || null, refPhoto: item.refPhoto || null,
        approvedAt: Date.now(),
      });
      await deleteDoc(doc(db, "queue", item.id));
    } catch (e) { console.error(e); }
    setApprovingId(null);
  };

  const rejectItem = async (item) => await deleteDoc(doc(db, "queue", item.id));

  const addChore = async () => {
    if (!choreForm.name || !choreForm.value) return;
    setSaving(true);
    let refUrl = null;
    if (refPhotoPreview) refUrl = await uploadPhoto(refPhotoPreview);
    await addDoc(collection(db, `chores_${choreForm.kid}`), {
      name: choreForm.name, value: parseFloat(choreForm.value),
      refPhoto: refUrl, done: false, createdAt: Date.now(),
    });
    setChoreForm(p => ({ ...p, name: "", value: "" }));
    setRefPhotoPreview(null);
    setSaving(false);
  };

  const deleteChore = async (kid, id) => await deleteDoc(doc(db, `chores_${kid}`, id));
  const addBill = async () => {
    if (!billForm.name || !billForm.amount) return;
    await addDoc(collection(db, "bills"), { name: billForm.name, amount: parseFloat(billForm.amount) });
    setBillForm({ name: "", amount: "" });
  };
  const deleteBill = async (id) => await deleteDoc(doc(db, "bills", id));

  const handleRefPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setRefPhotoPreview(await resizeImage(url));
  };

  const startPinReset = (target) => { setResetTarget(target); setNewPinStage("set"); setNewPinFirst(""); setPinResetError(false); };
  const handleResetFirst = (pin) => { setNewPinFirst(pin); setNewPinStage("confirm"); };
  const handleResetConfirm = async (pin) => {
    if (pin === newPinFirst) {
      const newPins = { ...pins, [resetTarget]: pin };
      await setDoc(doc(db, "config", "pins"), newPins);
      setPins(newPins);
      setResetTarget(null); setNewPinStage(null); setNewPinFirst("");
    } else {
      setPinResetError(true);
      setTimeout(() => { setNewPinStage("set"); setNewPinFirst(""); setPinResetError(false); }, 600);
    }
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none",
    fontFamily: "'DM Sans', sans-serif", width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "linear-gradient(160deg, #0d1120 0%, #1a1a2e 50%, #0d1120 100%)", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>
      <GlobalStyles />
      {showHistory && <HistoryModal kid={showHistory} accentColor={showHistory === "zelda" ? "#a78bfa" : "#c9a96e"} onClose={() => setShowHistory(null)} />}

      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(200,160,80,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div className="shimmer-text" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Dad's Dashboard</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>FAMILY CHORE MANAGER</div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div onClick={() => setShowHistory("zelda")} style={{ textAlign: "right", cursor: "pointer", opacity: 1, transition: "opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <div style={{ fontSize: 9, color: "#a78bfa", letterSpacing: 1 }}>ZELDA</div>
            <div style={{ color: "#a78bfa", fontFamily: "'DM Serif Display', serif", fontSize: 16 }}>${(balances.zelda||0).toFixed(2)}</div>
          </div>
          <div onClick={() => setShowHistory("alan")} style={{ textAlign: "right", cursor: "pointer", opacity: 1, transition: "opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <div style={{ fontSize: 9, color: "#c9a96e", letterSpacing: 1 }}>ALAN</div>
            <div style={{ color: "#c9a96e", fontFamily: "'DM Serif Display', serif", fontSize: 16 }}>${(balances.alan||0).toFixed(2)}</div>
          </div>
          <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12 }}>Out</button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", background: "rgba(0,0,0,0.2)" }}>
        {[{id:"queue",label:"Queue",count:queue.length},{id:"chores",label:"Chores"},{id:"bills",label:"Bills"},{id:"pins",label:"PINs"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn" style={{
            padding: "13px 18px", background: "none", border: "none", whiteSpace: "nowrap",
            color: tab === t.id ? "#c9a96e" : "rgba(255,255,255,0.35)",
            borderBottom: tab === t.id ? "2px solid #c9a96e" : "2px solid transparent",
            cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: 6, transition: "color 0.2s",
          }}>
            {t.label}
            {t.count > 0 && <span style={{ background: "#c9a96e", color: "#000", borderRadius: 99, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {tab === "queue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {queue.length === 0 && (
              <div style={{ padding: 50, textAlign: "center", color: "rgba(255,255,255,0.15)", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 18 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>&#10003;</div>
                <div style={{ fontSize: 13 }}>All clear -- no pending submissions</div>
              </div>
            )}
            {queue.map(item => (
              <div key={item.id} className="fade-in" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, opacity: approvingId === item.id ? 0.5 : 1, transition: "opacity 0.3s" }}>
                <div style={{ fontSize: 10, color: item.kid === "zelda" ? "#a78bfa" : "#c9a96e", letterSpacing: 2, marginBottom: 10 }}>{item.kid?.toUpperCase()} -- {item.choreName}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  {item.refPhoto && (
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 4, letterSpacing: 1 }}>REFERENCE</div>
                      <img src={item.refPhoto} style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8, opacity: 0.65 }} />
                    </div>
                  )}
                  {item.photo && (
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 4, letterSpacing: 1 }}>SUBMITTED</div>
                      <img src={item.photo} style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8 }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 80, display: "flex", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Worth ${item.value?.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => approveItem(item)} disabled={approvingId === item.id} style={{ flex: 1, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", padding: "10px", borderRadius: 11, cursor: "pointer", fontSize: 13 }}>
                    {approvingId === item.id ? "..." : "Approve"}
                  </button>
                  <button className="btn" onClick={() => rejectItem(item)} style={{ flex: 1, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "10px", borderRadius: 11, cursor: "pointer", fontSize: 13 }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "chores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 14 }}>ADD CHORE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <select value={choreForm.kid} onChange={e => setChoreForm(p => ({ ...p, kid: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="zelda">Zelda</option>
                  <option value="alan">Alan</option>
                </select>
                <input placeholder="Chore name" value={choreForm.name} onChange={e => setChoreForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                <input placeholder="$ value" type="number" value={choreForm.value} onChange={e => setChoreForm(p => ({ ...p, value: e.target.value }))} style={inputStyle} />
                <label style={{ ...inputStyle, cursor: "pointer", color: refPhotoPreview ? "#34d399" : "rgba(255,255,255,0.35)" }}>
                  {refPhotoPreview ? "Photo set" : "Upload reference photo (optional)"}
                  <input type="file" accept="image/*" onChange={handleRefPhoto} style={{ display: "none" }} />
                </label>
                {refPhotoPreview && <img src={refPhotoPreview} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8 }} />}
                <button className="btn" onClick={addChore} disabled={saving} style={{ background: "rgba(200,160,80,0.15)", border: "1px solid rgba(200,160,80,0.3)", color: "#c9a96e", padding: "12px", borderRadius: 11, cursor: "pointer", fontSize: 14 }}>
                  {saving ? "Saving..." : "Add Chore"}
                </button>
              </div>
            </div>
            {["zelda","alan"].map(kid => (
              <div key={kid}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: kid === "zelda" ? "#a78bfa" : "#c9a96e", letterSpacing: 2 }}>{kid.toUpperCase()}'S CHORES</div>
                  <button onClick={() => setShowHistory(kid)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>HISTORY</button>
                </div>
                {chores[kid].length === 0 && <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 13, fontStyle: "italic" }}>None yet</div>}
                {chores[kid].map(chore => (
                  <div key={chore.id} className="fade-in" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {chore.refPhoto && <img src={chore.refPhoto} style={{ width: 44, height: 34, objectFit: "cover", borderRadius: 6, opacity: 0.65, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: chore.done ? "rgba(255,255,255,0.25)" : "#fff", textDecoration: chore.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chore.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>${chore.value?.toFixed(2)}</div>
                    </div>
                    {chore.done && <div style={{ fontSize: 11, color: "#34d399", letterSpacing: 1, flexShrink: 0 }}>DONE</div>}
                    <button onClick={() => deleteChore(kid, chore.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.18)", cursor: "pointer", fontSize: 16, flexShrink: 0, padding: "4px 6px" }}>x</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "bills" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 14 }}>ADD BILL</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input placeholder="Bill name (e.g. Rent)" value={billForm.name} onChange={e => setBillForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                <input placeholder="$ amount" type="number" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
                <button className="btn" onClick={addBill} style={{ background: "rgba(200,160,80,0.15)", border: "1px solid rgba(200,160,80,0.3)", color: "#c9a96e", padding: "12px", borderRadius: 11, cursor: "pointer" }}>Add Bill</button>
              </div>
            </div>
            {bills.map(bill => (
              <div key={bill.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "rgba(255,255,255,0.65)" }}>{bill.name}</span>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ color: "#c9a96e", fontFamily: "'DM Serif Display', serif" }}>${bill.amount?.toFixed(2)}</span>
                  <button onClick={() => deleteBill(bill.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.18)", cursor: "pointer" }}>x</button>
                </div>
              </div>
            ))}
            {bills.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>TOTAL / MONTH</span>
                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#c9a96e" }}>${totalBills.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {tab === "pins" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 4 }}>MANAGE PINS</div>
            {resetTarget ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                    {newPinStage === "confirm" ? "Confirm new PIN" : `Set new PIN for ${resetTarget}`}
                  </div>
                  {pinResetError && <div className="fade-in" style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>PINs didn't match -- try again</div>}
                </div>
                <SmartPinPad
                  setupMode={true} accentColor="#c9a96e"
                  onFourDigits={newPinStage === "confirm" ? handleResetConfirm : handleResetFirst}
                  onBack={() => { setResetTarget(null); setNewPinStage(null); }}
                />
              </div>
            ) : (
              ["dad","alan","zelda"].map(kid => (
                <div key={kid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#fff", textTransform: "capitalize" }}>{kid}</div>
                    <div style={{ fontSize: 12, color: pins[kid] ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      {pins[kid] ? "PIN set" : "No PIN set yet"}
                    </div>
                    {kid === "dad" && <div style={{ fontSize: 11, color: "rgba(200,160,80,0.5)", marginTop: 2 }}>Unlocks all accounts</div>}
                  </div>
                  <button className="btn" onClick={() => startPinReset(kid)} style={{ background: "rgba(200,160,80,0.1)", border: "1px solid rgba(200,160,80,0.25)", color: "#c9a96e", padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12 }}>
                    Reset PIN
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// -- ZELDA'S WORLD --
const ZeldaWorld = ({ onLogout }) => {
  const [tab, setTab] = useState("chores");
  const [chores, setChores] = useState([]);
  const [balance, setBalance] = useState(0);
  const [wishlist, setWishlist] = useState(null);
  const [amazonUrl, setAmazonUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({ title: "", price: "", image: "" });
  const [activeChore, setActiveChore] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "chores_zelda"), snap => setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(doc(db, "balances", "main"), snap => { if (snap.exists()) setBalance(snap.data().zelda || 0); }));
    unsubs.push(onSnapshot(doc(db, "wishlist", "zelda"), snap => { if (snap.exists()) setWishlist(snap.data()); }));
    return () => unsubs.forEach(u => u());
  }, []);

  const handleAmazon = async () => {
    if (!amazonUrl) return;
    setScraping(true);
    try {
      const result = await scrapeAmazon(amazonUrl);
      if (result.title === "Amazon Item" && !result.price) {
        // Scraping failed - offer manual entry
        setManualMode(true);
        setManualForm({ title: "", price: "", image: "" });
      } else {
        await setDoc(doc(db, "wishlist", "zelda"), { ...result, savedAt: Date.now() });
        setAmazonUrl("");
      }
    } catch {
      setManualMode(true);
      setManualForm({ title: "", price: "", image: "" });
    }
    setScraping(false);
  };

  const handleManualSave = async () => {
    if (!manualForm.title || !manualForm.price) return;
    await setDoc(doc(db, "wishlist", "zelda"), {
      title: manualForm.title,
      price: parseFloat(manualForm.price),
      image: manualForm.image || null,
      url: amazonUrl || "",
      savedAt: Date.now(),
    });
    setManualMode(false);
    setManualForm({ title: "", price: "", image: "" });
    setAmazonUrl("");
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setPhotoPreview(await resizeImage(url));
  };

  const submitChore = async () => {
    if (!photoPreview || !activeChore) return;
    setSubmitting(activeChore.id);
    try {
      const photoUrl = await uploadPhoto(photoPreview);
      await addDoc(collection(db, "queue"), {
        kid: "zelda", choreId: activeChore.id, choreName: activeChore.name,
        value: activeChore.value, photo: photoUrl, refPhoto: activeChore.refPhoto || null,
        submittedAt: Date.now(),
      });
    } catch (e) { alert("Upload failed, try again"); }
    setPhotoPreview(null); setActiveChore(null); setSubmitting(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const progress = wishlist?.price > 0 ? Math.min(1, balance / wishlist.price) : 0;
  const pending = chores.filter(c => !c.done).length;
  const done = chores.filter(c => c.done).length;

  return (
    <div style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "linear-gradient(160deg, #0d0118 0%, #1a0533 40%, #0d0a2e 100%)", fontFamily: "'Crimson Pro', serif", color: "#fff" }}>
      <GlobalStyles />
      {showHistory && <HistoryModal kid="zelda" accentColor="#a78bfa" onClose={() => setShowHistory(false)} />}

      {[...Array(25)].map((_,i) => (
        <div key={i} style={{ position: "fixed", pointerEvents: "none", borderRadius: "50%",
          left: `${(i*13)%95}%`, top: `${(i*17)%95}%`,
          width: (i%3)+1, height: (i%3)+1,
          background: i%3===0?"#a78bfa":i%3===1?"#e879f9":"#67e8f9",
          opacity: 0.07+(i%4)*0.04,
          animation: `pulse ${2+(i%3)}s ease-in-out ${(i%4)*0.5}s infinite`,
        }} />
      ))}

      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, background: "rgba(13,1,24,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(167,139,250,0.1)" }}>
        <div>
          <div className="zelda-shimmer" style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 16 }}>Zelda's Realm</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>magical chore keeper</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 99, padding: "5px 14px", fontFamily: "'Cinzel Decorative', cursive", fontSize: 13, color: "#a78bfa" }}>
            ${balance.toFixed(2)}
          </div>
          <button onClick={onLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", padding: "5px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12 }}>exit</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(167,139,250,0.1)" }}>
        {[
          { label: "Quests Left", val: pending, color: "#e879f9" },
          { label: "Completed", val: done, color: "#a78bfa" },
          { label: "Earned", val: `$${balance.toFixed(2)}`, color: "#67e8f9" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRight: i < 2 ? "1px solid rgba(167,139,250,0.08)" : "none" }}>
            <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 14, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, marginTop: 2 }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 20px", position: "relative", zIndex: 10 }}>
        {["chores","wishlist","history"].map(t => (
          <button key={t} className="btn" onClick={() => t === "history" ? setShowHistory(true) : setTab(t)} style={{
            padding: "8px 20px", borderRadius: 99,
            background: tab===t ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
            border: tab===t ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.07)",
            color: tab===t ? "#a78bfa" : "rgba(255,255,255,0.35)",
            cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 9, letterSpacing: 1,
          }}>
            {t === "chores" ? "Quests" : t === "wishlist" ? "Wishes" : "History"}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 60px", maxWidth: 500, margin: "0 auto", position: "relative", zIndex: 10 }}>
        {tab === "chores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chores.length === 0 && <div style={{ textAlign: "center", padding: 50, color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>No quests yet -- ask Dad!</div>}
            {chores.map((chore, i) => (
              <div key={chore.id} style={{
                background: chore.done ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.04)",
                border: chore.done ? "1px solid rgba(167,139,250,0.25)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: 16, opacity: chore.done ? 0.6 : 1,
                animation: `fadeUp 0.4s ease ${i*0.07}s both`, transition: "all 0.3s",
              }}>
                {chore.refPhoto && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "rgba(167,139,250,0.5)", letterSpacing: 1, marginBottom: 4 }}>HOW IT SHOULD LOOK</div>
                    <img src={chore.refPhoto} style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 10, opacity: 0.75 }} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 13, color: chore.done ? "rgba(167,139,250,0.45)" : "#e0d0ff", textDecoration: chore.done ? "line-through" : "none", marginBottom: 4 }}>
                      {chore.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#a78bfa", fontStyle: "italic" }}>worth ${chore.value?.toFixed(2)}</div>
                  </div>
                  {!chore.done && (
                    <button className="btn" onClick={() => { setActiveChore(chore); setPhotoPreview(null); }} style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "7px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 9, flexShrink: 0, marginLeft: 10 }}>
                      Done!
                    </button>
                  )}
                  {chore.done && <div style={{ fontSize: 11, color: "#a78bfa", letterSpacing: 1 }}>DONE</div>}
                </div>
                {activeChore?.id === chore.id && !chore.done && (
                  <div className="fade-in" style={{ marginTop: 14, borderTop: "1px solid rgba(167,139,250,0.15)", paddingTop: 14 }}>
                    {!photoPreview ? (
                      <label style={{ display: "block", textAlign: "center", padding: 22, border: "2px dashed rgba(167,139,250,0.25)", borderRadius: 14, cursor: "pointer", color: "rgba(255,255,255,0.35)", fontStyle: "italic", fontSize: 13 }}>
                        Tap to take a photo
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
                      </label>
                    ) : (
                      <div>
                        <img src={photoPreview} style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" onClick={submitChore} disabled={submitting === chore.id} style={{ flex: 1, background: "linear-gradient(135deg, #a78bfa, #e879f9)", border: "none", color: "#fff", padding: "12px", borderRadius: 12, cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 10 }}>
                            {submitting === chore.id ? "Sending..." : "Submit to Dad"}
                          </button>
                          <button onClick={() => { setPhotoPreview(null); setActiveChore(null); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", padding: "12px 14px", borderRadius: 12, cursor: "pointer" }}>x</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "wishlist" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 20, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 11, color: "#a78bfa" }}>Set Your Wish</div>
                <button onClick={() => setManualMode(m => !m)} style={{ background: "none", border: "none", color: "rgba(167,139,250,0.5)", fontSize: 10, cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive" }}>
                  {manualMode ? "use link" : "enter manually"}
                </button>
              </div>
              {!manualMode ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input placeholder="Paste Amazon link (a.co or full)..." value={amazonUrl} onChange={e => setAmazonUrl(e.target.value)}
                    style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", color: "#fff", padding: "9px 13px", borderRadius: 12, fontSize: 13, outline: "none", minWidth: 0 }} />
                  <button className="btn" onClick={handleAmazon} disabled={scraping} style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 10, flexShrink: 0 }}>
                    {scraping ? "..." : "Go"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input placeholder="Item name" value={manualForm.title} onChange={e => setManualForm(p => ({ ...p, title: e.target.value }))}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", color: "#fff", padding: "9px 13px", borderRadius: 12, fontSize: 13, outline: "none" }} />
                  <input placeholder="Price (e.g. 29.99)" type="number" value={manualForm.price} onChange={e => setManualForm(p => ({ ...p, price: e.target.value }))}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", color: "#fff", padding: "9px 13px", borderRadius: 12, fontSize: 13, outline: "none" }} />
                  <input placeholder="Image URL (optional)" value={manualForm.image} onChange={e => setManualForm(p => ({ ...p, image: e.target.value }))}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", color: "#fff", padding: "9px 13px", borderRadius: 12, fontSize: 13, outline: "none" }} />
                  <button className="btn" onClick={handleManualSave} style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "10px", borderRadius: 12, cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 10 }}>
                    Save Wish
                  </button>
                </div>
              )}
            </div>
            {wishlist && (
              <div className="scale-in" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 24, padding: 24, textAlign: "center" }}>
                {wishlist.image && <img src={wishlist.image} style={{ width: 150, height: 150, objectFit: "contain", borderRadius: 16, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />}
                <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 12, color: "#e0d0ff", marginBottom: 8, lineHeight: 1.7 }}>{wishlist.title}</div>
                <div style={{ fontSize: 24, fontFamily: "'Cinzel Decorative', cursive", color: "#e879f9", marginBottom: 20 }}>${wishlist.price?.toFixed(2)}</div>
                <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${progress*100}%`, background: "linear-gradient(90deg, #a78bfa, #e879f9)", borderRadius: 99, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 0 12px rgba(232,121,249,0.4)" }} />
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                  ${balance.toFixed(2)} of ${wishlist.price?.toFixed(2)} earned
                  {progress >= 1 && " -- You did it!!"}
                </div>
                {progress < 1 && <div style={{ fontSize: 12, color: "rgba(167,139,250,0.45)", fontStyle: "italic", marginTop: 6 }}>${Math.max(0, wishlist.price - balance).toFixed(2)} more to go</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// -- ALAN'S WORLD --
const AlanWorld = ({ onLogout }) => {
  const [tab, setTab] = useState("chores");
  const [chores, setChores] = useState([]);
  const [balance, setBalance] = useState(0);
  const [bills, setBills] = useState([]);
  const [activeChore, setActiveChore] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "chores_alan"), snap => setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(doc(db, "balances", "main"), snap => { if (snap.exists()) setBalance(snap.data().alan || 0); }));
    unsubs.push(onSnapshot(collection(db, "bills"), snap => setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    return () => unsubs.forEach(u => u());
  }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setPhotoPreview(await resizeImage(url));
  };

  const submitChore = async () => {
    if (!photoPreview || !activeChore) return;
    setSubmitting(activeChore.id);
    try {
      const photoUrl = await uploadPhoto(photoPreview);
      await addDoc(collection(db, "queue"), {
        kid: "alan", choreId: activeChore.id, choreName: activeChore.name,
        value: activeChore.value, photo: photoUrl, refPhoto: activeChore.refPhoto || null,
        submittedAt: Date.now(),
      });
    } catch { alert("Upload failed, try again"); }
    setPhotoPreview(null); setActiveChore(null); setSubmitting(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const coveragePct = totalBills > 0 ? Math.min(1, balance / totalBills) : 0;
  const pending = chores.filter(c => !c.done).length;
  const done = chores.filter(c => c.done).length;

  return (
    <div style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#0d0d0d", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>
      <GlobalStyles />
      {showHistory && <HistoryModal kid="alan" accentColor="#c9a96e" onClose={() => setShowHistory(false)} />}

      <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(13,13,13,0.9)", backdropFilter: "blur(10px)", zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>ALAN</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Chore Tracker</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>EARNED</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>${balance.toFixed(2)}</div>
          </div>
          <button onClick={onLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Exit</button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[{ label: "To Do", val: pending }, { label: "Done", val: done }, { label: "Earned", val: `$${balance.toFixed(2)}` }].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#e0e0e0" }}>{s.val}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 2, marginTop: 2 }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[{ id: "chores", label: "Chores" }, { id: "reality", label: "Real Life" }, { id: "history", label: "History" }].map(t => (
          <button key={t.id} className="btn" onClick={() => t.id === "history" ? setShowHistory(true) : setTab(t.id)} style={{
            padding: "13px 20px", background: "none", border: "none",
            color: tab===t.id ? "#fff" : "rgba(255,255,255,0.3)",
            borderBottom: tab===t.id ? "1px solid #fff" : "1px solid transparent",
            cursor: "pointer", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", transition: "color 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "24px 16px", maxWidth: 600, margin: "0 auto" }}>
        {tab === "chores" && (
          <div>
            {chores.length === 0 && <div style={{ color: "rgba(255,255,255,0.18)", textAlign: "center", padding: 50, fontStyle: "italic" }}>No chores assigned yet.</div>}
            {chores.map((chore, i) => (
              <div key={chore.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 16, marginBottom: 16, animation: `slideIn 0.3s ease ${i*0.05}s both` }}>
                {chore.refPhoto && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, marginBottom: 4 }}>REFERENCE</div>
                    <img src={chore.refPhoto} style={{ width: "100%", maxHeight: 130, objectFit: "cover", borderRadius: 8, opacity: 0.55 }} />
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: chore.done ? "#34d399" : "rgba(255,255,255,0.18)", flexShrink: 0, boxShadow: chore.done ? "0 0 8px rgba(52,211,153,0.4)" : "none", transition: "all 0.3s" }} />
                    <div>
                      <div style={{ fontSize: 15, color: chore.done ? "rgba(255,255,255,0.25)" : "#e0e0e0", textDecoration: chore.done ? "line-through" : "none" }}>{chore.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>${chore.value?.toFixed(2)}</div>
                    </div>
                  </div>
                  {chore.done ? (
                    <div style={{ fontSize: 11, color: "#34d399", letterSpacing: 1 }}>APPROVED</div>
                  ) : (
                    <button className="btn" onClick={() => { setActiveChore(chore); setPhotoPreview(null); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 11, letterSpacing: 1, flexShrink: 0 }}>SUBMIT</button>
                  )}
                </div>
                {activeChore?.id === chore.id && !chore.done && (
                  <div className="fade-in" style={{ marginTop: 14, paddingLeft: 20 }}>
                    {!photoPreview ? (
                      <label style={{ display: "block", padding: 18, textAlign: "center", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(255,255,255,0.28)", cursor: "pointer", fontSize: 13 }}>
                        Take a photo
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
                      </label>
                    ) : (
                      <div>
                        <img src={photoPreview} style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" onClick={submitChore} disabled={submitting === chore.id} style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", padding: "10px", borderRadius: 8, cursor: "pointer", fontSize: 12, letterSpacing: 1 }}>
                            {submitting === chore.id ? "SENDING..." : "SUBMIT"}
                          </button>
                          <button onClick={() => { setPhotoPreview(null); setActiveChore(null); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}>x</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "reality" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>WHAT LIFE ACTUALLY COSTS</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.8 }}>
                This is what a month of adult life costs. Your chores cover a fraction of it -- and that's the point.
              </div>
            </div>
            {bills.length === 0 && <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 13, fontStyle: "italic" }}>Dad hasn't set up bills yet.</div>}
            {bills.map((bill, i) => (
              <div key={bill.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", animation: `slideIn 0.3s ease ${i*0.05}s both` }}>
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 15 }}>{bill.name}</span>
                <span style={{ color: "#e0e0e0", fontFamily: "'DM Serif Display', serif", fontSize: 17 }}>${bill.amount?.toFixed(2)}</span>
              </div>
            ))}
            {bills.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, marginBottom: 28 }}>
                  <span style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.25)" }}>TOTAL / MONTH</span>
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26 }}>${totalBills.toFixed(2)}</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 18 }}>YOUR CHORES VS REAL LIFE</div>
                  {[
                    { label: "You've earned", val: balance, color: "#34d399" },
                    { label: "Monthly bills", val: totalBills, color: "#f87171" },
                    { label: "The gap", val: Math.max(0, totalBills - balance), color: "rgba(255,255,255,0.2)" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>{r.label.toUpperCase()}</span>
                      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: r.color }}>${r.val.toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden", marginTop: 16, marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${coveragePct*100}%`, background: "#34d399", borderRadius: 99, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>Your chores cover {(coveragePct*100).toFixed(1)}% of one month's expenses</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// -- APP ROOT --
export default function App() {
  const [user, setUser] = useState(null);
  const [pins, setPins] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "config", "pins")).then(snap => {
      setPins(snap.exists() ? snap.data() : {});
    });
  }, []);

  if (pins === null) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <GlobalStyles />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(200,160,80,0.6)", borderRadius: "50%", animation: "float 1s linear infinite" }} />
        <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, letterSpacing: 3 }}>LOADING</div>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={setUser} pins={pins} setPins={setPins} />;
  if (user === "dad") return <DadDashboard onLogout={() => setUser(null)} pins={pins} setPins={setPins} />;
  if (user === "alan") return <AlanWorld onLogout={() => setUser(null)} />;
  if (user === "zelda") return <ZeldaWorld onLogout={() => setUser(null)} />;
}
