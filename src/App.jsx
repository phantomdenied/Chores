import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUDINARY_CLOUD = "dxxlptkzf";
const CLOUDINARY_PRESET = "chore_app";
const MASTER_PIN = "2323"; [span_0](start_span)// Updated Master PIN[span_0](end_span)

const firebaseConfig = {
  apiKey: "AIzaSyCXvGhkfl3f3CXvsuuRiPUmK7J4GTsFan8",
  authDomain: "chore-time-c3d38.firebaseapp.com",
  projectId: "chore-time-c3d38",
  storageBucket: "chore-time-c3d38.firebasestorage.app",
  messagingSenderId: "1029486053333",
  appId: "1:1029486053333:web:d9bfbc910c07979fdb9f5c"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── UTILS ──────────────────────────────────────────────────────────────────
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

// Resolve a.co / short Amazon links via allorigins
const resolveAmazonUrl = async (url) => {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    if (data.status?.url) return data.status.url;
    const match = data.contents?.match(/https?:\/\/www\.amazon\.com[^\s"']*/);
    if (match) return match[0];
    return url;
  } catch { return url; }
};

const scrapeAmazon = async (inputUrl) => {
  const resolvedUrl = await resolveAmazonUrl(inputUrl);
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(resolvedUrl)}`;
  const res = await fetch(proxyUrl);
  const data = await res.json();
  const html = data.contents;
  const parser = new DOMParser();
  const d = parser.parseFromString(html, "text/html");

  const title = d.querySelector("#productTitle")?.textContent?.trim() ||
    d.querySelector(".product-title")?.textContent?.trim() || "Amazon Item";

  const priceWhole = d.querySelector(".a-price-whole")?.textContent?.replace(/[^0-9]/g, "") || "";
  const priceFrac = d.querySelector(".a-price-fraction")?.textContent?.replace(/[^0-9]/g, "") || "00";
  const price = priceWhole ? parseFloat(`${priceWhole}.${priceFrac}`) : 0;
  const img = d.querySelector("#landingImage")?.getAttribute("src") ||
    d.querySelector("#imgBlkFront")?.getAttribute("src") ||
    d.querySelector(".a-dynamic-image")?.getAttribute("src") ||
    d.querySelector("#main-image")?.getAttribute("src") || null;
  return { title: title.slice(0, 80), price, image: img, url: resolvedUrl };
};

// ── GLOBAL STYLES ──────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,400;1,400&family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap');
    
    /* Reset and mobile fix */
    *, *::before, *::after { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      -webkit-tap-highlight-color: transparent; 
    }
    
    html, body { 
      width: 100%; 
      max-width: 100vw; 
      overflow-x: hidden;
      background: #0a0a0a;
      position: relative;
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }

    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes sparkle { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
    @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }

    .float { animation: float 4s ease-in-out infinite; }
    .fade-up { animation: fadeUp 0.4s ease forwards; }
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
    .btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
  `}</style>
);

// ── PIN PAD ────────────────────────────────────────────────────────────────
const PinPad = ({ onSuccess, correctPin, onBack, accentColor, masterPin }) => {
  const [input, setInput] = useState("");
  const [shaking, setShaking] = useState(false);

  const press = d => {
    if (input.length >= 4) return;
    const next = input + d;
    setInput(next);
    if (next.length === 4) {
      const isCorrect = next === correctPin || (masterPin && next === masterPin);
      if (isCorrect) {
        onSuccess(next === masterPin ? "master" : "own");
      } else {
        setShaking(true);
        setTimeout(() => { setInput(""); setShaking(false); }, 500);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div className={shaking ? "shake" : ""} style={{ display: "flex", gap: 14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 13, height: 13, borderRadius: "50%",
            background: i < input.length ? accentColor : "rgba(255,255,255,0.2)",
            transition: "background 0.15s",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
          <button key={i} className="btn"
            onPointerDown={(e) => {
              e.preventDefault(); 
              d === "⌫" ? setInput(p => p.slice(0,-1)) : d !== "" && press(String(d))
            }}
            style={{
              width: 62, height: 62, borderRadius: 14,
              background: d === "" ? "transparent" : "rgba(255,255,255,0.07)",
              border: d === "" ? "none" : "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 20, fontFamily: "'DM Sans', sans-serif",
              cursor: d === "" ? "default" : "pointer",
            }}
          >{d}</button>
        ))}
      </div>
      {onBack && (
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.35)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer",
        }}>← Back</button>
      )}
    </div>
  );
};

// ── PIN SETUP ──────────────────────────────────────────────────────────────
const PinSetup = ({ name, accentColor, onComplete }) => {
  const [stage, setStage] = useState("set");
  const [first, setFirst] = useState("");

  const handleFirst = (pin) => { setFirst(pin); setStage("confirm"); };
  const handleConfirm = (pin) => {
    if (pin === first) onComplete(pin);
    else { setStage("set"); setFirst(""); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8 }}>
          {stage === "set" ? "SET YOUR PIN" : "CONFIRM YOUR PIN"}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
          {stage === "set" ? `Choose a 4-digit PIN, ${name}` : "Enter it again to confirm"}
        </div>
      </div>
      <PinPad
        correctPin={stage === "confirm" ? first : null}
        accentColor={accentColor}
        onSuccess={stage === "set" ? (_, raw) => handleFirst(raw) : () => handleConfirm(first)}
        onBack={null}
        onFourDigits={stage === "set" ? handleFirst : handleConfirm}
      />
    </div>
  );
};

[span_1](start_span)[span_2](start_span)// Better PinPad that supports setup mode with optimized touch response[span_1](end_span)[span_2](end_span)
const SmartPinPad = ({ onSuccess, correctPin, onBack, accentColor, masterPin, setupMode, onFourDigits }) => {
  const [input, setInput] = useState("");
  const [shaking, setShaking] = useState(false);

  const press = d => {
    if (input.length >= 4) return;
    const next = input + d;
    setInput(next);
    if (next.length === 4) {
      if (setupMode) {
        onFourDigits && onFourDigits(next);
        setInput("");
        return;
      }
      const isCorrect = next === correctPin || (masterPin && next === masterPin);
      if (isCorrect) {
        onSuccess(next === masterPin ? "master" : "own");
      } else {
        setShaking(true);
        setTimeout(() => { setInput(""); setShaking(false); }, 500);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div className={shaking ? "shake" : ""} style={{ display: "flex", gap: 14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 13, height: 13, borderRadius: "50%",
            background: i < input.length ? accentColor : "rgba(255,255,255,0.2)",
            transition: "background 0.15s",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
          <button key={i} className="btn"
            onPointerDown={(e) => {
              e.preventDefault(); 
              d === "⌫" ? setInput(p => p.slice(0,-1)) : d !== "" && press(String(d))
            }}
            style={{
              width: 62, height: 62, borderRadius: 14,
              background: d === "" ? "transparent" : "rgba(255,255,255,0.07)",
              border: d === "" ? "none" : "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 20, fontFamily: "'DM Sans', sans-serif",
              cursor: d === "" ? "default" : "pointer",
            }}
          >{d}</button>
        ))}
      </div>
      {onBack && (
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.35)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer",
        }}>← Back</button>
      )}
    </div>
  );
};

// ── LOGIN SCREEN ───────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin, pins, setPins }) => {
  const [selected, setSelected] = useState(null);
  const [setupStage, setSetupStage] = useState(null);
  const [firstPin, setFirstPin] = useState("");
  const profiles = [
    { id: "dad", name: "Dad", emoji: "👨", card: "rgba(200,160,80,0.06)", border: "rgba(200,160,80,0.3)", accent: "#c9a96e", label: "PARENT", font: "'DM Serif Display', serif" },
    { id: "alan", name: "Alan", emoji: "🧑", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)", accent: "#e0e0e0", label: "18", font: "'DM Sans', sans-serif" },
    { id: "zelda", name: "Zelda", emoji: "🧚", card: "rgba(167,139,250,0.07)", border: "rgba(167,139,250,0.35)", accent: "#a78bfa", label: "✨", font: "'Cinzel Decorative', cursive" },
  ];
  const p = profiles.find(x => x.id === selected);
  const needsSetup = selected && !pins[selected];

  const handleLoginSuccess = () => onLogin(selected);
  const handleSetupFirst = (pin) => { setFirstPin(pin); setSetupStage("confirm"); };
  const handleSetupConfirm = async (pin) => {
    if (pin === firstPin) {
      const newPins = { ...pins, [selected]: pin };
      await setDoc(doc(db, "config", "pins"), newPins);
      setPins(newPins);
      onLogin(selected);
    } else {
      setSetupStage("set");
      setFirstPin("");
    }
  };
  return (
    <div style={{
      minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden",
      background: "radial-gradient(ellipse at 20% 50%, #1a0533 0%, #0a0a0a 50%, #0d1a0d 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'DM Sans', sans-serif",
      position: "relative", boxSizing: "border-box"
    }}>
      <GlobalStyles />

      {[...Array(20)].map((_, i) => (
        <div key={i} style={{
          position: "fixed", borderRadius: "50%", background: "#fff", pointerEvents: "none",
          left: `${5 + (i * 4.7) % 90}%`, top: `${5 + (i * 7.3) % 90}%`,
          width: (i % 3) + 1, height: (i % 3) + 1,
          opacity: 0.1 + (i % 4) * 0.07,
          animation: `pulse ${2 + (i % 3)}s ease-in-out ${(i % 4) * 0.5}s infinite`,
        }} />
      ))}

      {!selected ? (
        <div className="fade-up" style={{ width: "100%", maxWidth: 480 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 11, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>FAMILY CHORES</div>
            <div className="shimmer-text" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36 }}>Who's there?</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%" }}>
            {profiles.map((profile, i) => (
              <div key={profile.id}
                className="btn"
                onClick={() => { setSelected(profile.id); setSetupStage(null); setFirstPin(""); }}
                style={{
                  background: profile.card,
                  border: `1px solid ${profile.border}`,
                  borderRadius: 20, padding: "24px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  animation: `fadeUp 0.4s ease ${i * 0.1}s both`,
                  minWidth: 0,
                }}>
                <div style={{ fontSize: 40 }} className={profile.id === "zelda" ? "float" : ""}>{profile.emoji}</div>
                <div style={{
                  fontFamily: profile.font,
                  fontSize: profile.id === "zelda" ? 13 : 18,
                  color: profile.accent,
                  textAlign: "center",
                  wordBreak: "break-word",
                  letterSpacing: profile.id === "alan" ? 2 : 0,
                }}>
                  {profile.name}
                </div>
                <div style={{
                  fontSize: 10, color: "rgba(255,255,255,0.25)",
                  border: `1px solid ${profile.border}`,
                  borderRadius: 99, padding: "2px 8px", letterSpacing: 1,
                }}>
                  {profile.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fade-up" style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${p.border}`,
          borderRadius: 24, padding: "32px 28px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
          width: "100%", maxWidth: 320,
        }}>
          <div style={{ fontSize: 44 }} className={p.id === "zelda" ? "float" : ""}>{p.emoji}</div>
          <div style={{ fontFamily: p.font, fontSize: p.id === "zelda" ? 15 : 22, color: p.accent }}>{p.name}</div>

          {needsSetup ? (
            <>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textAlign: "center" }}>
                {setupStage === "confirm" ? "CONFIRM YOUR PIN" : "CREATE YOUR PIN"}
              </div>
              <SmartPinPad
                setupMode={true}
                accentColor={p.accent}
                onFourDigits={setupStage === "confirm" ? handleSetupConfirm : handleSetupFirst}
                onBack={() => setSelected(null)}
              />
              {setupStage === "confirm" && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Enter it again to confirm</div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>ENTER PIN</div>
              <SmartPinPad
                correctPin={pins[selected]}
                masterPin={selected !== "dad" ? pins.dad || MASTER_PIN : undefined}
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

// ── DAD DASHBOARD ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    const unsubs = [];
    unsubs.push(
      onSnapshot(
        collection(db, "queue"),
        snap => setQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )
    );

    ["alan", "zelda"].forEach(kid => {
      unsubs.push(
        onSnapshot(
          collection(db, `chores_${kid}`),
          snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChores(prev => ({ ...prev, [kid]: list }));
          }
        )
      );
    });

    onSnapshot(doc(db, "balances", "main"), snap => {
      if (snap.exists()) setBalances(snap.data());
    });

    onSnapshot(collection(db, "bills"), snap => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubs.forEach(u => u()); };
  }, []);

  const approveItem = async (item) => {
    const newBal = { ...balances, [item.kid]: (balances[item.kid] || 0) + (item.value || 0) };
    await setDoc(doc(db, "balances", "main"), newBal);
    await updateDoc(doc(db, `chores_${item.kid}`, item.choreId), { done: true });
    await deleteDoc(doc(db, "queue", item.id));
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

  const startPinReset = (target) => { setResetTarget(target); setNewPinStage("set"); setNewPinFirst(""); };
  const handleResetFirst = (pin) => { setNewPinFirst(pin); setNewPinStage("confirm"); };
  const handleResetConfirm = async (pin) => {
    if (pin === newPinFirst) {
      const newPins = { ...pins, [resetTarget]: pin };
      await setDoc(doc(db, "config", "pins"), newPins);
      setPins(newPins);
      setResetTarget(null); setNewPinStage(null); setNewPinFirst("");
    } else {
      setNewPinStage("set"); setNewPinFirst("");
    }
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none",
    fontFamily: "'DM Sans', sans-serif", width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: "linear-gradient(160deg, #0d1120 0%, #1a1a2e 50%, #0d1120 100%)", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>
      <GlobalStyles />

      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(200,160,80,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="shimmer-text" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>Dad's Dashboard</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>FAMILY CHORE MANAGER</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#a78bfa", letterSpacing: 1 }}>ZELDA</div>
            <div style={{ color: "#a78bfa", fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>${(balances.zelda||0).toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#c9a96e", letterSpacing: 1 }}>ALAN</div>
            <div style={{ color: "#c9a96e", fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>${(balances.alan||0).toFixed(2)}</div>
          </div>
          <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11 }}>Out</button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
        {[{id:"queue",label:"Queue",count:queue.length},{id:"chores",label:"Chores"},{id:"bills",label:"Bills"},{id:"pins",label:"PINs"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 16px", background: "none", border: "none", whiteSpace: "nowrap",
            color: tab === t.id ? "#c9a96e" : "rgba(255,255,255,0.4)",
            borderBottom: tab === t.id ? "2px solid #c9a96e" : "2px solid transparent",
            cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {t.label}
            {t.count > 0 && <span style={{ background: "#c9a96e", color: "#000", borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>
        {tab === "queue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {queue.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.2)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14 }}>No pending submissions</div>}
            {queue.map(item => (
              <div key={item.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, color: item.kid === "zelda" ? "#a78bfa" : "#c9a96e", letterSpacing: 2, marginBottom: 8 }}>{item.kid?.toUpperCase()} — {item.choreName}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  {item.refPhoto && (
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>REFERENCE</div>
                      <img src={item.refPhoto} style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8, opacity: 0.7 }} />
                    </div>
                  )}
                  {item.photo && (
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>SUBMITTED</div>
                      <img src={item.photo} style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8 }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 20 }}>Worth ${item.value?.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => approveItem(item)} style={{ flex: 1, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>✓ Approve</button>
                  <button className="btn" onClick={() => rejectItem(item)} style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "chores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 14 }}>ADD CHORE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <select value={choreForm.kid} onChange={e => setChoreForm(p => ({ ...p, kid: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="zelda">Zelda</option>
                  <option value="alan">Alan</option>
                </select>
                <input placeholder="Chore name" value={choreForm.name} onChange={e => setChoreForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                <input placeholder="$ value" type="number" value={choreForm.value} onChange={e => setChoreForm(p => ({ ...p, value: e.target.value }))} style={inputStyle} />
                <label style={{ ...inputStyle, cursor: "pointer", color: refPhotoPreview ? "#34d399" : "rgba(255,255,255,0.4)" }}>
                  {refPhotoPreview ? "📷 Reference photo set" : "📷 Upload reference photo (optional)"}
                  <input type="file" accept="image/*" onChange={handleRefPhoto} style={{ display: "none" }} />
                </label>
                {refPhotoPreview && <img src={refPhotoPreview} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8 }} />}
                <button className="btn" onClick={addChore} disabled={saving} style={{ background: "rgba(200,160,80,0.15)", border: "1px solid rgba(200,160,80,0.3)", color: "#c9a96e", padding: "11px", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>
                  {saving ? "Saving..." : "Add Chore"}
                </button>
              </div>
            </div>
            {["zelda","alan"].map(kid => (
              <div key={kid}>
                <div style={{ fontSize: 11, color: kid === "zelda" ? "#a78bfa" : "#c9a96e", letterSpacing: 2, marginBottom: 10 }}>{kid.toUpperCase()}'S CHORES</div>
                {chores[kid].map(chore => (
                  <div key={chore.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {chore.refPhoto && <img src={chore.refPhoto} style={{ width: 44, height: 34, objectFit: "cover", borderRadius: 6, opacity: 0.7, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: chore.done ? "rgba(255,255,255,0.3)" : "#fff", textDecoration: chore.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chore.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>${chore.value?.toFixed(2)}</div>
                    </div>
                    <button onClick={() => deleteChore(kid, chore.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 16 }}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── APP ROOT ───────────────────────────────────────────────────────────────
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
      <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif", fontSize: 14, letterSpacing: 2 }}>LOADING...</div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={setUser} pins={pins} setPins={setPins} />;
  
  return user === "dad" ? 
    <DadDashboard onLogout={() => setUser(null)} pins={pins} setPins={setPins} /> : 
    <div style={{ color: "#fff", padding: 40 }}>Kid Dashboard for {user} - To be implemented</div>;
}
