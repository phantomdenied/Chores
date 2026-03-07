import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const CLOUDINARY_CLOUD = "dxxlptkzf";
const CLOUDINARY_PRESET = "chore_app";

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

const uploadPhoto = async (_path, dataUrl) => {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Cloudinary upload failed");
  return data.secure_url;
};

// ── STYLES ─────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }

    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    @keyframes sparkle { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }

    .float { animation: float 4s ease-in-out infinite; }
    .fade-up { animation: fadeUp 0.5s ease forwards; }
    .shimmer-text {
      background: linear-gradient(90deg, #c9a96e, #f0d080, #c9a96e, #e8c060, #c9a96e);
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
    .btn-hover { transition: all 0.2s; }
    .btn-hover:hover { transform: translateY(-2px); filter: brightness(1.1); }
    .btn-hover:active { transform: translateY(0); }
    .card-hover { transition: all 0.3s; cursor: pointer; }
    .card-hover:hover { transform: translateY(-6px); }
  `}</style>
);

// ── PIN PAD ────────────────────────────────────────────────────────────────
const PinPad = ({ onSuccess, correctPin, onBack, accentColor, textColor = "#fff" }) => {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);

  const press = d => {
    if (input.length >= 4) return;
    const next = input + d;
    setInput(next);
    if (next.length === 4) {
      if (next === correctPin) {
        onSuccess();
      } else {
        setShake(true);
        setTimeout(() => { setInput(""); setShake(false); }, 600);
      }
    }
  };

  const del = () => setInput(p => p.slice(0, -1));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < input.length ? accentColor : "rgba(255,255,255,0.2)",
            transition: "background 0.15s",
            animation: shake ? `pulse 0.1s ease ${i*0.05}s` : "none",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
          <button key={i} onClick={() => d === "⌫" ? del() : d !== "" && press(String(d))}
            className="btn-hover"
            style={{
              width: 64, height: 64, borderRadius: 16,
              background: d === "" ? "transparent" : "rgba(255,255,255,0.08)",
              border: d === "" ? "none" : "1px solid rgba(255,255,255,0.1)",
              color: textColor, fontSize: 20, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400, cursor: d === "" ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >{d}</button>
        ))}
      </div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "rgba(255,255,255,0.4)",
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer", marginTop: 8,
      }}>← Back</button>
    </div>
  );
};

// ── LOGIN SCREEN ───────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin, pins }) => {
  const [selected, setSelected] = useState(null);

  const profiles = [
    {
      id: "dad",
      name: "Dad",
      emoji: "👨",
      bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      card: "rgba(255,255,255,0.04)",
      border: "rgba(200,160,80,0.3)",
      accent: "#c9a96e",
      label: "PARENT",
      labelColor: "#c9a96e",
      desc: "Manage chores & approve",
      font: "'DM Serif Display', serif",
    },
    {
      id: "alan",
      name: "Alan",
      emoji: "🧑",
      bg: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)",
      card: "rgba(255,255,255,0.03)",
      border: "rgba(255,255,255,0.1)",
      accent: "#e0e0e0",
      label: "18",
      labelColor: "rgba(255,255,255,0.3)",
      desc: "Chores & real life costs",
      font: "'DM Sans', sans-serif",
    },
    {
      id: "zelda",
      name: "Zelda",
      emoji: "🧚",
      bg: "linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #1a0533 100%)",
      card: "rgba(167,139,250,0.08)",
      border: "rgba(167,139,250,0.4)",
      accent: "#a78bfa",
      label: "✨",
      labelColor: "#e879f9",
      desc: "Chores & wishlist magic",
      font: "'Cinzel Decorative', cursive",
    },
  ];

  const p = profiles.find(x => x.id === selected);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 50%, #1a0533 0%, #0a0a0a 50%, #0d1a0d 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'DM Sans', sans-serif",
    }}>
      <GlobalStyles />

      {/* Floating stars */}
      {[...Array(20)].map((_, i) => (
        <div key={i} style={{
          position: "fixed",
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: Math.random() * 3 + 1,
          height: Math.random() * 3 + 1,
          borderRadius: "50%",
          background: "#fff",
          opacity: Math.random() * 0.5 + 0.1,
          animation: `pulse ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 2}s infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {!selected ? (
        <div className="fade-up" style={{ width: "100%", maxWidth: 700 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 13, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 12, fontWeight: 400 }}>
              FAMILY CHORES
            </div>
            <div className="shimmer-text" style={{ fontSize: 42, fontFamily: "'DM Serif Display', serif" }}>
              Who's there?
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {profiles.map((profile, i) => (
              <div key={profile.id} className="card-hover"
                onClick={() => setSelected(profile.id)}
                style={{
                  background: profile.card,
                  border: `1px solid ${profile.border}`,
                  borderRadius: 24, padding: "32px 20px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  animation: `fadeUp 0.5s ease ${i * 0.1}s both`,
                  backdropFilter: "blur(10px)",
                }}>
                <div style={{ fontSize: 52 }} className={profile.id === "zelda" ? "float" : ""}>{profile.emoji}</div>
                <div style={{
                  fontFamily: profile.font,
                  fontSize: profile.id === "zelda" ? 16 : 22,
                  color: profile.accent,
                  letterSpacing: profile.id === "alan" ? 3 : 0,
                  textTransform: profile.id === "alan" ? "uppercase" : "none",
                }}>
                  {profile.name}
                </div>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.3)",
                  textAlign: "center", lineHeight: 1.5, letterSpacing: 0.5,
                }}>
                  {profile.desc}
                </div>
                <div style={{
                  marginTop: 8, padding: "4px 12px", borderRadius: 99,
                  border: `1px solid ${profile.border}`,
                  fontSize: 11, color: profile.labelColor, letterSpacing: 2,
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
          borderRadius: 28, padding: "40px 48px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          backdropFilter: "blur(20px)",
          minWidth: 300,
        }}>
          <div style={{ fontSize: 48 }} className={p.id === "zelda" ? "float" : ""}>{p.emoji}</div>
          <div style={{ fontFamily: p.font, fontSize: p.id === "zelda" ? 18 : 24, color: p.accent }}>
            {p.name}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>ENTER PIN</div>
          <PinPad
            correctPin={pins[p.id] || "0000"}
            accentColor={p.accent}
            onSuccess={() => onLogin(p.id)}
            onBack={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
};

// ── DAD DASHBOARD ──────────────────────────────────────────────────────────
const DadDashboard = ({ onLogout, db }) => {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [chores, setChores] = useState({ alan: [], zelda: [] });
  const [bills, setBills] = useState([]);
  const [balances, setBalances] = useState({ alan: 0, zelda: 0 });
  const [loading, setLoading] = useState(true);

  // Chore form
  const [choreForm, setChoreForm] = useState({ kid: "zelda", name: "", value: "" });
  const [refPhotoFile, setRefPhotoFile] = useState(null);
  const [refPhotoPreview, setRefPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Bill form
  const [billForm, setBillForm] = useState({ name: "", amount: "" });

  useEffect(() => {
    const unsubs = [];
    // Queue
    unsubs.push(onSnapshot(collection(db, "queue"), snap => {
      setQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    // Chores
    ["alan", "zelda"].forEach(kid => {
      unsubs.push(onSnapshot(collection(db, `chores_${kid}`), snap => {
        setChores(prev => ({ ...prev, [kid]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }));
    });
    // Bills
    unsubs.push(onSnapshot(collection(db, "bills"), snap => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    // Balances
    unsubs.push(onSnapshot(doc(db, "balances", "main"), snap => {
      if (snap.exists()) setBalances(snap.data());
      setLoading(false);
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const approveItem = async (item) => {
    // Add to balance
    const newBal = { ...balances, [item.kid]: (balances[item.kid] || 0) + (item.value || 0) };
    await setDoc(doc(db, "balances", "main"), newBal);
    // Mark chore done
    await updateDoc(doc(db, `chores_${item.kid}`, item.choreId), { done: true });
    // Remove from queue
    await deleteDoc(doc(db, "queue", item.id));
  };

  const rejectItem = async (item) => {
    await deleteDoc(doc(db, "queue", item.id));
  };

  const addChore = async () => {
    if (!choreForm.name || !choreForm.value) return;
    setSaving(true);
    let refUrl = null;
    if (refPhotoFile) {
      const resized = await resizeImage(refPhotoFile);
      refUrl = await uploadPhoto(`refs/${choreForm.kid}/${Date.now()}.jpg`, resized);
    }
    await addDoc(collection(db, `chores_${choreForm.kid}`), {
      name: choreForm.name,
      value: parseFloat(choreForm.value),
      refPhoto: refUrl,
      done: false,
      createdAt: Date.now(),
    });
    setChoreForm({ kid: choreForm.kid, name: "", value: "" });
    setRefPhotoFile(null);
    setRefPhotoPreview(null);
    setSaving(false);
  };

  const deleteChore = async (kid, id) => {
    await deleteDoc(doc(db, `chores_${kid}`, id));
  };

  const addBill = async () => {
    if (!billForm.name || !billForm.amount) return;
    await addDoc(collection(db, "bills"), { name: billForm.name, amount: parseFloat(billForm.amount) });
    setBillForm({ name: "", amount: "" });
  };

  const deleteBill = async (id) => {
    await deleteDoc(doc(db, "bills", id));
  };

  const handleRefPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setRefPhotoFile(url);
    setRefPhotoPreview(url);
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const choreEarnable = chores.alan.reduce((s, c) => s + c.value, 0);

  const tabs = [
    { id: "queue", label: "Queue", count: queue.length },
    { id: "chores", label: "Chores" },
    { id: "bills", label: "Alan's Bills" },
    { id: "overview", label: "Overview" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0d1120 0%, #1a1a2e 50%, #0d1120 100%)",
      fontFamily: "'DM Sans', sans-serif", color: "#fff",
    }}>
      <GlobalStyles />

      {/* Header */}
      <div style={{
        padding: "20px 32px",
        borderBottom: "1px solid rgba(200,160,80,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <div className="shimmer-text" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>
            Dad's Dashboard
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginTop: 2 }}>
            FAMILY CHORE MANAGER
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>ZELDA</div>
            <div style={{ color: "#a78bfa", fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>${(balances.zelda || 0).toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>ALAN</div>
            <div style={{ color: "#c9a96e", fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>${(balances.alan || 0).toFixed(2)}</div>
          </div>
          <button onClick={onLogout} className="btn-hover" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)", padding: "8px 16px", borderRadius: 10,
            cursor: "pointer", fontSize: 13,
          }}>Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 32px", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "14px 20px", background: "none", border: "none",
            color: tab === t.id ? "#c9a96e" : "rgba(255,255,255,0.4)",
            borderBottom: tab === t.id ? "2px solid #c9a96e" : "2px solid transparent",
            cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            letterSpacing: 0.5, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
          }}>
            {t.label}
            {t.count > 0 && <span style={{
              background: "#c9a96e", color: "#000", borderRadius: 99,
              padding: "1px 7px", fontSize: 11, fontWeight: 500,
            }}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>

        {/* QUEUE TAB */}
        {tab === "queue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8 }}>
              PENDING APPROVALS — {queue.length} item{queue.length !== 1 ? "s" : ""}
            </div>
            {queue.length === 0 && (
              <div style={{
                padding: 48, textAlign: "center", color: "rgba(255,255,255,0.2)",
                border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16,
              }}>
                All clear — no pending submissions
              </div>
            )}
            {queue.map(item => (
              <div key={item.id} className="fade-up" style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: 20, display: "flex", gap: 20, alignItems: "flex-start",
              }}>
                <div style={{ display: "flex", gap: 12, flex: 1 }}>
                  {item.refPhoto && (
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, letterSpacing: 1 }}>REFERENCE</div>
                      <img src={item.refPhoto} style={{ width: 100, height: 80, objectFit: "cover", borderRadius: 8, opacity: 0.7 }} />
                    </div>
                  )}
                  {item.photo && (
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, letterSpacing: 1 }}>SUBMITTED</div>
                      <img src={item.photo} style={{ width: 100, height: 80, objectFit: "cover", borderRadius: 8 }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: item.kid === "zelda" ? "#a78bfa" : "#c9a96e", letterSpacing: 2, marginBottom: 4 }}>
                      {item.kid?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 18, fontFamily: "'DM Serif Display', serif", marginBottom: 4 }}>{item.choreName}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                      Worth ${item.value?.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => approveItem(item)} className="btn-hover" style={{
                    background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)",
                    color: "#34d399", padding: "8px 20px", borderRadius: 10, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                  }}>✓ Approve</button>
                  <button onClick={() => rejectItem(item)} className="btn-hover" style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171", padding: "8px 20px", borderRadius: 10, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                  }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CHORES TAB */}
        {tab === "chores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Add chore form */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 16 }}>ADD CHORE</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <select value={choreForm.kid} onChange={e => setChoreForm(p => ({ ...p, kid: e.target.value }))}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>
                  <option value="zelda">Zelda</option>
                  <option value="alan">Alan</option>
                </select>
                <input placeholder="Chore name" value={choreForm.name}
                  onChange={e => setChoreForm(p => ({ ...p, name: e.target.value }))}
                  style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none" }} />
                <input placeholder="$ value" type="number" value={choreForm.value}
                  onChange={e => setChoreForm(p => ({ ...p, value: e.target.value }))}
                  style={{ width: 100, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none" }} />
                <label style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)", padding: "10px 14px", borderRadius: 10, fontSize: 13, cursor: "pointer",
                }}>
                  {refPhotoPreview ? "📷 Photo set" : "📷 Ref photo"}
                  <input type="file" accept="image/*" onChange={handleRefPhoto} style={{ display: "none" }} />
                </label>
                <button onClick={addChore} disabled={saving} className="btn-hover" style={{
                  background: "rgba(200,160,80,0.15)", border: "1px solid rgba(200,160,80,0.3)",
                  color: "#c9a96e", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontSize: 14,
                }}>
                  {saving ? "Saving..." : "Add"}
                </button>
              </div>
              {refPhotoPreview && <img src={refPhotoPreview} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, marginTop: 12 }} />}
            </div>

            {/* Chore lists */}
            {["zelda", "alan"].map(kid => (
              <div key={kid}>
                <div style={{ fontSize: 13, color: kid === "zelda" ? "#a78bfa" : "#c9a96e", letterSpacing: 2, marginBottom: 12 }}>
                  {kid.toUpperCase()}'S CHORES
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {chores[kid].length === 0 && (
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "12px 0" }}>No chores yet</div>
                  )}
                  {chores[kid].map(chore => (
                    <div key={chore.id} style={{
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10, padding: "12px 16px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {chore.refPhoto && <img src={chore.refPhoto} style={{ width: 40, height: 32, objectFit: "cover", borderRadius: 6, opacity: 0.7 }} />}
                        <div>
                          <div style={{ fontSize: 15, color: chore.done ? "rgba(255,255,255,0.3)" : "#fff", textDecoration: chore.done ? "line-through" : "none" }}>{chore.name}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>${chore.value?.toFixed(2)}</div>
                        </div>
                      </div>
                      <button onClick={() => deleteChore(kid, chore.id)} style={{
                        background: "none", border: "none", color: "rgba(255,255,255,0.2)",
                        cursor: "pointer", fontSize: 16, padding: 4,
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BILLS TAB */}
        {tab === "bills" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>
              ALAN'S HYPOTHETICAL MONTHLY BILLS
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <input placeholder="Bill name (e.g. Rent)" value={billForm.name}
                  onChange={e => setBillForm(p => ({ ...p, name: e.target.value }))}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none" }} />
                <input placeholder="$ amount" type="number" value={billForm.amount}
                  onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))}
                  style={{ width: 130, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none" }} />
                <button onClick={addBill} className="btn-hover" style={{
                  background: "rgba(200,160,80,0.15)", border: "1px solid rgba(200,160,80,0.3)",
                  color: "#c9a96e", padding: "10px 20px", borderRadius: 10, cursor: "pointer",
                }}>Add Bill</button>
              </div>
              {bills.map(bill => (
                <div key={bill.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{bill.name}</span>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <span style={{ color: "#c9a96e", fontFamily: "'DM Serif Display', serif" }}>${bill.amount?.toFixed(2)}</span>
                    <button onClick={() => deleteBill(bill.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ))}
              {bills.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, letterSpacing: 1 }}>TOTAL / MONTH</span>
                  <span style={{ color: "#c9a96e", fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>${totalBills.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { kid: "zelda", color: "#a78bfa", earned: balances.zelda || 0, chores: chores.zelda },
              { kid: "alan", color: "#c9a96e", earned: balances.alan || 0, chores: chores.alan },
            ].map(({ kid, color, earned, chores: kChores }) => (
              <div key={kid} style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22`,
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ fontSize: 11, color, letterSpacing: 3, marginBottom: 16 }}>{kid.toUpperCase()}</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color }}>
                  ${earned.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>total earned</div>
                <div style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  {kChores.filter(c => c.done).length}/{kChores.length} chores done today
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── ZELDA'S WORLD ──────────────────────────────────────────────────────────
const ZeldaWorld = ({ onLogout, db }) => {
  const [tab, setTab] = useState("chores");
  const [chores, setChores] = useState([]);
  const [balance, setBalance] = useState(0);
  const [wishlist, setWishlist] = useState(null);
  const [amazonUrl, setAmazonUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [activeChore, setActiveChore] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "chores_zelda"), snap => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(doc(db, "balances", "main"), snap => {
      if (snap.exists()) setBalance(snap.data().zelda || 0);
    }));
    unsubs.push(onSnapshot(doc(db, "wishlist", "zelda"), snap => {
      if (snap.exists()) setWishlist(snap.data());
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const scrapeAmazon = async () => {
    if (!amazonUrl) return;
    setScraping(true);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(amazonUrl)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      const html = data.contents;
      const parser = new DOMParser();
      const doc2 = parser.parseFromString(html, "text/html");

      const title = doc2.querySelector("#productTitle")?.textContent?.trim() ||
        doc2.querySelector(".product-title")?.textContent?.trim() || "Amazon Item";

      const priceWhole = doc2.querySelector(".a-price-whole")?.textContent?.replace(/[^0-9.]/g, "") || "";
      const priceFrac = doc2.querySelector(".a-price-fraction")?.textContent?.replace(/[^0-9]/g, "") || "00";
      const price = priceWhole ? parseFloat(`${priceWhole}.${priceFrac}`) : null;

      const img = doc2.querySelector("#landingImage")?.src ||
        doc2.querySelector("#imgBlkFront")?.src ||
        doc2.querySelector(".a-dynamic-image")?.src || null;

      await setDoc(doc(db, "wishlist", "zelda"), {
        title: title.slice(0, 80),
        price: price || 0,
        image: img,
        url: amazonUrl,
        savedAt: Date.now(),
      });
      setAmazonUrl("");
    } catch (e) {
      alert("Couldn't load that item. Try again!");
    }
    setScraping(false);
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChore) return;
    const dataUrl = await fileToDataUrl(file);
    const resized = await resizeImage(dataUrl);
    setPhotoPreview(resized);
  };

  const submitChore = async () => {
    if (!photoPreview || !activeChore) return;
    setSubmitting(activeChore.id);
    const photoUrl = await uploadPhoto(`submissions/zelda/${activeChore.id}_${Date.now()}.jpg`, photoPreview);
    await addDoc(collection(db, "queue"), {
      kid: "zelda",
      choreId: activeChore.id,
      choreName: activeChore.name,
      value: activeChore.value,
      photo: photoUrl,
      refPhoto: activeChore.refPhoto || null,
      submittedAt: Date.now(),
    });
    setPhotoPreview(null);
    setActiveChore(null);
    setSubmitting(null);
    fileRef.current && (fileRef.current.value = "");
  };

  const progress = wishlist && wishlist.price > 0 ? Math.min(1, balance / wishlist.price) : 0;

  // Sparkle positions
  const sparkles = [...Array(8)].map((_, i) => ({
    x: Math.sin(i / 8 * Math.PI * 2) * 45 + 50,
    y: Math.cos(i / 8 * Math.PI * 2) * 45 + 50,
    delay: i * 0.2,
  }));

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0d0118 0%, #1a0533 40%, #0d0a2e 70%, #0d0118 100%)",
      fontFamily: "'Crimson Pro', serif", color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      <GlobalStyles />

      {/* Background magic */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        {[...Array(30)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: Math.random() * 4 + 1,
            height: Math.random() * 4 + 1,
            borderRadius: "50%",
            background: i % 3 === 0 ? "#a78bfa" : i % 3 === 1 ? "#e879f9" : "#67e8f9",
            opacity: Math.random() * 0.4 + 0.05,
            animation: `pulse ${2 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 10,
      }}>
        <div>
          <div className="zelda-shimmer" style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 18 }}>
            Zelda's Realm
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'Crimson Pro', serif", fontStyle: "italic" }}>
            ✨ magical chore keeper
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 99, padding: "6px 16px",
            fontFamily: "'Cinzel Decorative', cursive", fontSize: 14, color: "#a78bfa",
          }}>
            💜 ${balance.toFixed(2)}
          </div>
          <button onClick={onLogout} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.3)", padding: "6px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13,
          }}>exit</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "0 24px 20px", position: "relative", zIndex: 10 }}>
        {["chores", "wishlist"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 28px", borderRadius: 99,
            background: tab === t ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
            border: tab === t ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.08)",
            color: tab === t ? "#a78bfa" : "rgba(255,255,255,0.4)",
            cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 11,
            letterSpacing: 1, transition: "all 0.2s",
          }}>
            {t === "chores" ? "✨ Quests" : "🌟 Wishes"}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 600, margin: "0 auto", position: "relative", zIndex: 10 }}>

        {/* CHORES */}
        {tab === "chores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {chores.length === 0 && (
              <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                No quests yet... ask Dad to add some! 🧚
              </div>
            )}
            {chores.map((chore, i) => (
              <div key={chore.id} className="fade-up" style={{
                background: chore.done ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.04)",
                border: chore.done ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: 20,
                animation: `fadeUp 0.4s ease ${i * 0.07}s both`,
                opacity: chore.done ? 0.6 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{
                      fontFamily: "'Cinzel Decorative', cursive", fontSize: 14,
                      color: chore.done ? "rgba(167,139,250,0.6)" : "#e0d0ff",
                      textDecoration: chore.done ? "line-through" : "none",
                      marginBottom: 6,
                    }}>
                      {chore.done ? "✓ " : "◇ "}{chore.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#a78bfa", fontStyle: "italic" }}>
                      worth ${chore.value?.toFixed(2)} 💜
                    </div>
                  </div>
                  {chore.done ? (
                    <div style={{ fontSize: 24 }}>✨</div>
                  ) : (
                    <button onClick={() => { setActiveChore(chore); setPhotoPreview(null); }}
                      className="btn-hover"
                      style={{
                        background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)",
                        color: "#a78bfa", padding: "8px 16px", borderRadius: 12, cursor: "pointer",
                        fontFamily: "'Cinzel Decorative', cursive", fontSize: 10,
                      }}>
                      📷 Done!
                    </button>
                  )}
                </div>

                {/* Photo submission inline */}
                {activeChore?.id === chore.id && !chore.done && (
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(167,139,250,0.2)", paddingTop: 16 }}>
                    {!photoPreview ? (
                      <label style={{
                        display: "block", textAlign: "center", padding: "20px",
                        border: "2px dashed rgba(167,139,250,0.3)", borderRadius: 12, cursor: "pointer",
                        color: "rgba(255,255,255,0.4)", fontFamily: "'Crimson Pro', serif", fontStyle: "italic",
                      }}>
                        🌟 Tap to take a photo of your work
                        <input ref={fileRef} type="file" accept="image/*" capture="environment"
                          onChange={handlePhotoSelect} style={{ display: "none" }} />
                      </label>
                    ) : (
                      <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          {chore.refPhoto && (
                            <div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>How it should look</div>
                              <img src={chore.refPhoto} style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 10, opacity: 0.7 }} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Your photo</div>
                            <img src={photoPreview} style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 10 }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={submitChore} disabled={submitting === chore.id}
                            className="btn-hover"
                            style={{
                              flex: 1, background: "linear-gradient(135deg, #a78bfa, #e879f9)",
                              border: "none", color: "#fff", padding: "12px", borderRadius: 12,
                              cursor: "pointer", fontFamily: "'Cinzel Decorative', cursive", fontSize: 11,
                              boxShadow: "0 4px 20px rgba(167,139,250,0.3)",
                            }}>
                            {submitting === chore.id ? "✨ Sending..." : "✨ Submit to Dad"}
                          </button>
                          <button onClick={() => { setPhotoPreview(null); setActiveChore(null); }} style={{
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.4)", padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                          }}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WISHLIST */}
        {tab === "wishlist" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* URL input */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(167,139,250,0.2)",
              borderRadius: 20, padding: 20,
            }}>
              <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 12, color: "#a78bfa", marginBottom: 12 }}>
                🌟 Set Your Wish
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input placeholder="Paste an Amazon link..." value={amazonUrl}
                  onChange={e => setAmazonUrl(e.target.value)}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)",
                    color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 14, outline: "none",
                    fontFamily: "'Crimson Pro', serif",
                  }} />
                <button onClick={scrapeAmazon} disabled={scraping} className="btn-hover" style={{
                  background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)",
                  color: "#a78bfa", padding: "10px 16px", borderRadius: 12, cursor: "pointer",
                  fontFamily: "'Cinzel Decorative', cursive", fontSize: 10,
                }}>
                  {scraping ? "✨..." : "✨ Go"}
                </button>
              </div>
            </div>

            {/* Wish display */}
            {wishlist && (
              <div className="fade-up" style={{
                background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.3)",
                borderRadius: 24, padding: 24, textAlign: "center",
              }}>
                {wishlist.image && (
                  <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
                    <img src={wishlist.image} style={{
                      width: 160, height: 160, objectFit: "contain",
                      borderRadius: 16, background: "rgba(255,255,255,0.05)",
                    }} />
                    {/* Sparkles around image */}
                    {sparkles.map((s, i) => (
                      <div key={i} style={{
                        position: "absolute",
                        left: `${s.x}%`, top: `${s.y}%`,
                        fontSize: 10, transform: "translate(-50%,-50%)",
                        animation: `sparkle 2s ease-in-out ${s.delay}s infinite`,
                        pointerEvents: "none",
                      }}>✨</div>
                    ))}
                  </div>
                )}
                <div style={{
                  fontFamily: "'Cinzel Decorative', cursive", fontSize: 13,
                  color: "#e0d0ff", marginBottom: 8, lineHeight: 1.6,
                }}>
                  {wishlist.title}
                </div>
                <div style={{ fontSize: 24, fontFamily: "'Cinzel Decorative', cursive", color: "#e879f9", marginBottom: 20 }}>
                  ${wishlist.price?.toFixed(2)}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    height: 12, background: "rgba(255,255,255,0.08)",
                    borderRadius: 99, overflow: "hidden", marginBottom: 8,
                  }}>
                    <div style={{
                      height: "100%", width: `${progress * 100}%`,
                      background: "linear-gradient(90deg, #a78bfa, #e879f9)",
                      borderRadius: 99, transition: "width 0.6s ease",
                      boxShadow: "0 0 12px rgba(232,121,249,0.5)",
                    }} />
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
                    ${balance.toFixed(2)} of ${wishlist.price?.toFixed(2)} earned
                    {progress >= 1 && " 🎉 You did it!!"}
                  </div>
                </div>

                {progress < 1 && (
                  <div style={{ fontSize: 13, color: "rgba(167,139,250,0.6)", fontStyle: "italic" }}>
                    ${Math.max(0, (wishlist.price - balance)).toFixed(2)} more to go ✨
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── ALAN'S WORLD ───────────────────────────────────────────────────────────
const AlanWorld = ({ onLogout, db }) => {
  const [tab, setTab] = useState("chores");
  const [chores, setChores] = useState([]);
  const [balance, setBalance] = useState(0);
  const [bills, setBills] = useState([]);
  const [activeChore, setActiveChore] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "chores_alan"), snap => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(doc(db, "balances", "main"), snap => {
      if (snap.exists()) setBalance(snap.data().alan || 0);
    }));
    unsubs.push(onSnapshot(collection(db, "bills"), snap => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChore) return;
    const dataUrl = await fileToDataUrl(file);
    const resized = await resizeImage(dataUrl);
    setPhotoPreview(resized);
  };

  const submitChore = async () => {
    if (!photoPreview || !activeChore) return;
    setSubmitting(activeChore.id);
    const photoUrl = await uploadPhoto(`submissions/alan/${activeChore.id}_${Date.now()}.jpg`, photoPreview);
    await addDoc(collection(db, "queue"), {
      kid: "alan",
      choreId: activeChore.id,
      choreName: activeChore.name,
      value: activeChore.value,
      photo: photoUrl,
      refPhoto: activeChore.refPhoto || null,
      submittedAt: Date.now(),
    });
    setPhotoPreview(null);
    setActiveChore(null);
    setSubmitting(null);
    fileRef.current && (fileRef.current.value = "");
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const choreEarnable = chores.reduce((s, c) => s + c.value, 0);
  const coveragePct = totalBills > 0 ? Math.min(1, balance / totalBills) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      fontFamily: "'DM Sans', sans-serif", color: "#fff",
    }}>
      <GlobalStyles />

      {/* Header */}
      <div style={{
        padding: "24px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>ALAN</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#e0e0e0" }}>Chore Tracker</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>EARNED</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>${balance.toFixed(2)}</div>
          </div>
          <button onClick={onLogout} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.3)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
          }}>Exit</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {["chores", "reality"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "14px 28px", background: "none", border: "none",
            color: tab === t ? "#fff" : "rgba(255,255,255,0.3)",
            borderBottom: tab === t ? "1px solid #fff" : "1px solid transparent",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, letterSpacing: 2, textTransform: "uppercase", transition: "all 0.2s",
          }}>
            {t === "reality" ? "Real Life" : t}
          </button>
        ))}
      </div>

      <div style={{ padding: 32, maxWidth: 700, margin: "0 auto" }}>

        {/* CHORES */}
        {tab === "chores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {chores.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", padding: "40px 0", textAlign: "center" }}>
                No chores assigned yet.
              </div>
            )}
            {chores.map((chore, i) => (
              <div key={chore.id} style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                padding: "20px 0",
                animation: `slideIn 0.3s ease ${i * 0.05}s both`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: chore.done ? "#34d399" : "rgba(255,255,255,0.2)",
                    }} />
                    <div>
                      <div style={{
                        fontSize: 16, color: chore.done ? "rgba(255,255,255,0.3)" : "#e0e0e0",
                        textDecoration: chore.done ? "line-through" : "none",
                      }}>
                        {chore.name}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                        ${chore.value?.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {chore.done ? (
                    <div style={{ fontSize: 12, color: "#34d399", letterSpacing: 1 }}>APPROVED</div>
                  ) : (
                    <button onClick={() => { setActiveChore(chore); setPhotoPreview(null); }}
                      className="btn-hover"
                      style={{
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.6)", padding: "8px 16px", borderRadius: 8,
                        cursor: "pointer", fontSize: 12, letterSpacing: 1,
                      }}>
                      SUBMIT
                    </button>
                  )}
                </div>

                {activeChore?.id === chore.id && !chore.done && (
                  <div style={{ marginTop: 16, paddingLeft: 24 }}>
                    {!photoPreview ? (
                      <label style={{
                        display: "block", padding: "16px", textAlign: "center",
                        border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 8,
                        color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13,
                      }}>
                        Take a photo
                        <input ref={fileRef} type="file" accept="image/*" capture="environment"
                          onChange={handlePhotoSelect} style={{ display: "none" }} />
                      </label>
                    ) : (
                      <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          {chore.refPhoto && (
                            <div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, letterSpacing: 1 }}>REFERENCE</div>
                              <img src={chore.refPhoto} style={{ width: 110, height: 82, objectFit: "cover", borderRadius: 6, opacity: 0.6 }} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, letterSpacing: 1 }}>YOUR PHOTO</div>
                            <img src={photoPreview} style={{ width: 110, height: 82, objectFit: "cover", borderRadius: 6 }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={submitChore} disabled={submitting === chore.id}
                            className="btn-hover"
                            style={{
                              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                              color: "#fff", padding: "10px 24px", borderRadius: 8, cursor: "pointer",
                              fontSize: 13, letterSpacing: 1,
                            }}>
                            {submitting === chore.id ? "SENDING..." : "SUBMIT"}
                          </button>
                          <button onClick={() => { setPhotoPreview(null); setActiveChore(null); }} style={{
                            background: "none", border: "1px solid rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.3)", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                          }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REALITY CHECK */}
        {tab === "reality" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                WHAT LIFE ACTUALLY COSTS
              </div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                This is what a month of adult life costs. Your chores cover a fraction of it — and that's the point.
              </div>
            </div>

            {/* Bills list */}
            <div style={{ marginBottom: 32 }}>
              {bills.length === 0 && (
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Dad hasn't set up bills yet.</div>
              )}
              {bills.map((bill, i) => (
                <div key={bill.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  animation: `slideIn 0.3s ease ${i * 0.05}s both`,
                }}>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>{bill.name}</span>
                  <span style={{ color: "#e0e0e0", fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>
                    ${bill.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
              {bills.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.3)" }}>TOTAL / MONTH</span>
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>${totalBills.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* The gap */}
            {bills.length > 0 && (
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>
                  YOUR CHORES VS REAL LIFE
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "You've earned", val: balance, color: "#34d399" },
                    { label: "Monthly bills", val: totalBills, color: "#f87171" },
                    { label: "The gap", val: Math.max(0, totalBills - balance), color: "rgba(255,255,255,0.3)" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{r.label.toUpperCase()}</span>
                      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: r.color }}>
                        ${r.val.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coverage bar */}
                <div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{
                      height: "100%", width: `${coveragePct * 100}%`,
                      background: "#34d399", borderRadius: 99, transition: "width 0.6s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    Your chores cover {(coveragePct * 100).toFixed(1)}% of one month's expenses
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── APP ROOT ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [pins] = useState({ dad: "0000", alan: "0000", zelda: "0000" });

  const handleLogin = (profile) => setUser(profile);
  const handleLogout = () => setUser(null);

  if (!user) return <LoginScreen onLogin={handleLogin} pins={pins} />;
  if (user === "dad") return <DadDashboard onLogout={handleLogout} db={db} />;
  if (user === "alan") return <AlanWorld onLogout={handleLogout} db={db} />;
  if (user === "zelda") return <ZeldaWorld onLogout={handleLogout} db={db} />;
}
