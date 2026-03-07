import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUDINARY_CLOUD = "dxxlptkzf";
const CLOUDINARY_PRESET = "chore_app";
const MASTER_PIN = "2323"; [cite_start]// Updated Master PIN[span_0](end_span)

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

// ── UTILS (Restored) ────────────────────────────────────────────────────────
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

const resolveAmazonUrl = async (url) => {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    if (data.status?.url) return data.status.url;
    const match = data.contents?.match(/https?:\/\/www\.amazon\.com[^\s"']*/);
    return match ? match[0] : url;
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
  const title = d.querySelector("#productTitle")?.textContent?.trim() || "Amazon Item";
  const priceWhole = d.querySelector(".a-price-whole")?.textContent?.replace(/[^0-9]/g, "") || "";
  const priceFrac = d.querySelector(".a-price-fraction")?.textContent?.replace(/[^0-9]/g, "") || "00";
  const price = priceWhole ? parseFloat(`${priceWhole}.${priceFrac}`) : 0;
  const img = d.querySelector("#landingImage")?.getAttribute("src") || d.querySelector(".a-dynamic-image")?.getAttribute("src") || null;
  return { title: title.slice(0, 80), price, image: img, url: resolvedUrl };
};

// ── GLOBAL STYLES (Screen Fit Fixed) ─────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,400;1,400&family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap');
    
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
    .btn:active { transform: translateY(2px); filter: brightness(0.8); }
  `}</style>
);

// ── PIN PAD (Fast Input Fixed) ──────────────────────────────────────────────
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
            onPointerDown={(e) => { e.preventDefault(); d === "⌫" ? setInput(p => p.slice(0,-1)) : d !== "" && press(String(d)) }}
            style={{
              width: 62, height: 62, borderRadius: 14,
              background: d === "" ? "transparent" : "rgba(255,255,255,0.07)",
              border: d === "" ? "none" : "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 20, fontFamily: "'DM Sans', sans-serif",
            }}
          >{d}</button>
        ))}
      </div>
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>← Back</button>
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
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box", background: "radial-gradient(ellipse at 20% 50%, #1a0533 0%, #0a0a0a 50%, #0d1a0d 100%)" }}>
      <GlobalStyles />
      {!selected ? (
        <div className="fade-up" style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="shimmer-text" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32 }}>Family Chores</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {profiles.map(profile => (
              <div key={profile.id} className="btn" onClick={() => setSelected(profile.id)} style={{ background: profile.card, border: `1px solid ${profile.border}`, borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 32 }}>{profile.emoji}</div>
                <div style={{ fontFamily: profile.font, color: profile.accent, fontSize: 14 }}>{profile.name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, background: "rgba(255,255,255,0.03)", padding: 30, borderRadius: 24, border: `1px solid ${p.border}` }}>
          <div style={{ fontSize: 44 }}>{p.emoji}</div>
          <div style={{ fontFamily: p.font, fontSize: 22, color: p.accent }}>{p.name}</div>
          <SmartPinPad
            setupMode={needsSetup}
            correctPin={pins[selected]}
            masterPin={selected !== "dad" ? pins.dad || MASTER_PIN : undefined}
            accentColor={p.accent}
            onSuccess={() => onLogin(selected)}
            onFourDigits={needsSetup ? (setupStage === "confirm" ? handleSetupConfirm : (pin) => { setFirstPin(pin); setSetupStage("confirm"); }) : null}
            onBack={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
};

// ── DAD DASHBOARD (Restored Full) ───────────────────────────────────────────
const DadDashboard = ({ onLogout, pins, setPins }) => {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [chores, setChores] = useState({ alan: [], zelda: [] });
  const [balances, setBalances] = useState({ alan: 0, zelda: 0 });
  const [bills, setBills] = useState([]);
  const [choreForm, setChoreForm] = useState({ kid: "zelda", name: "", value: "" });
  const [refPhotoPreview, setRefPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "queue"), s => setQueue(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(doc(db, "balances", "main"), s => s.exists() && setBalances(s.data())),
      onSnapshot(collection(db, "bills"), s => setBills(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      ...["alan", "zelda"].map(k => onSnapshot(collection(db, `chores_${k}`), s => setChores(prev => ({ ...prev, [k]: s.docs.map(d => ({ id: d.id, ...d.data() })) }))))
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const approveItem = async (item) => {
    const newBal = { ...balances, [item.kid]: (balances[item.kid] || 0) + (item.value || 0) };
    await setDoc(doc(db, "balances", "main"), newBal);
    await updateDoc(doc(db, `chores_${item.kid}`, item.choreId), { done: true });
    await deleteDoc(doc(db, "queue", item.id));
  };

  const addChore = async () => {
    if (!choreForm.name || !choreForm.value) return;
    setSaving(true);
    let refUrl = null;
    if (refPhotoPreview) refUrl = await uploadPhoto(refPhotoPreview);
    await addDoc(collection(db, `chores_${choreForm.kid}`), { name: choreForm.name, value: parseFloat(choreForm.value), refPhoto: refUrl, done: false, createdAt: Date.now() });
    setChoreForm({ ...choreForm, name: "", value: "" });
    setRefPhotoPreview(null);
    setSaving(false);
  };

  const inputStyle = { background: "#111", border: "1px solid #333", color: "#fff", padding: 12, borderRadius: 10, width: "100%" };

  return (
    <div style={{ minHeight: "100vh", color: "#fff", padding: 20, background: "#0d1120" }}>
      <GlobalStyles />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 className="shimmer-text">Dad's Dashboard</h2>
        <button className="btn" onClick={onLogout} style={{ padding: "8px 16px", background: "#222", border: "1px solid #444", color: "#888", borderRadius: 8 }}>Logout</button>
      </div>
      
      <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto" }}>
        {["queue", "chores", "bills"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: 10, flex: 1, borderRadius: 8, background: tab === t ? "#c9a96e" : "#222", color: tab === t ? "#000" : "#fff", border: "none" }}>{t.toUpperCase()}</button>
        ))}
      </div>

      {tab === "queue" && queue.map(item => (
        <div key={item.id} style={{ background: "#111", padding: 15, borderRadius: 12, marginBottom: 10, border: "1px solid #333" }}>
          <p>{item.kid.toUpperCase()}: {item.choreName} - ${item.value}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => approveItem(item)} style={{ flex: 1, background: "#34d399", color: "#000", border: "none", padding: 10, borderRadius: 8 }}>Approve</button>
            <button onClick={() => deleteDoc(doc(db, "queue", item.id))} style={{ flex: 1, background: "#ef4444", color: "#fff", border: "none", padding: 10, borderRadius: 8 }}>Reject</button>
          </div>
        </div>
      ))}

      {tab === "chores" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select value={choreForm.kid} onChange={e => setChoreForm({...choreForm, kid: e.target.value})} style={inputStyle}>
            <option value="zelda">Zelda</option>
            <option value="alan">Alan</option>
          </select>
          <input placeholder="Chore Name" value={choreForm.name} onChange={e => setChoreForm({...choreForm, name: e.target.value})} style={inputStyle} />
          <input placeholder="Value" type="number" value={choreForm.value} onChange={e => setChoreForm({...choreForm, value: e.target.value})} style={inputStyle} />
          <button onClick={addChore} disabled={saving} style={{ background: "#c9a96e", color: "#000", padding: 12, borderRadius: 10, border: "none" }}>{saving ? "Saving..." : "Add Chore"}</button>
        </div>
      )}
    </div>
  );
};

// ── KID DASHBOARD (Restored Full) ───────────────────────────────────────────
const KidDashboard = ({ kid, onLogout }) => {
  const [chores, setChores] = useState([]);
  const [balance, setBalance] = useState(0);
  const [bills, setBills] = useState([]);
  const [isZelda] = useState(kid === "zelda");

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, `chores_${kid}`), s => setChores(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(doc(db, "balances", "main"), s => s.exists() && setBalance(s.data()[kid] || 0)),
      onSnapshot(collection(db, "bills"), s => setBills(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    ];
    return () => unsubs.forEach(u => u());
  }, [kid]);

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const coveragePct = Math.min(1, balance / (totalBills || 1));

  return (
    <div style={{ minHeight: "100vh", padding: 20, color: "#fff", background: isZelda ? "linear-gradient(#1a0533, #0a0a0a)" : "#0a0a0a" }}>
      <GlobalStyles />
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <h1 className={isZelda ? "zelda-shimmer" : "shimmer-text"} style={{ fontSize: 48, margin: 0 }}>${balance.toFixed(2)}</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>CURRENT BALANCE</p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
          <span>Monthly Progress</span>
          <span>{Math.round(coveragePct * 100)}%</span>
        </div>
        <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${coveragePct * 100}%`, height: "100%", background: isZelda ? "#a78bfa" : "#34d399", transition: "width 0.5s" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {chores.filter(c => !c.done).map(c => (
          <div key={c.id} style={{ background: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: "500" }}>{c.name}</div>
              <div style={{ color: isZelda ? "#a78bfa" : "#34d399", fontSize: 14 }}>+${c.value.toFixed(2)}</div>
            </div>
            <button className="btn" onClick={() => addDoc(collection(db, "queue"), { kid, choreId: c.id, choreName: c.name, value: c.value, submittedAt: Date.now() })} style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none" }}>Done</button>
          </div>
        ))}
      </div>

      <button onClick={onLogout} style={{ width: "100%", marginTop: 40, padding: 12, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", borderRadius: 12 }}>Logout</button>
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

  if (pins === null) return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;

  if (!user) return <LoginScreen onLogin={setUser} pins={pins} setPins={setPins} />;
  
  return user === "dad" ? 
    <DadDashboard onLogout={() => setUser(null)} pins={pins} setPins={setPins} /> : 
    <KidDashboard kid={user} onLogout={() => setUser(null)} />;
}
