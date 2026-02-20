import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc 
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  Calendar,
  LogOut,
  Gift,
  Edit2,
  Check,
  X
} from 'lucide-react';

// --- Firebase Konfiguration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = "geburtstagsliste-v1";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [view, setView] = useState('events'); 
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [editingGiftId, setEditingGiftId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', price: '', giverId: '' });

  const [givers, setGivers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [eventBudgets, setEventBudgets] = useState({});
  const [eventParticipants, setEventParticipants] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError("Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!user) return;
    const basePath = ['artifacts', APP_ID, 'users', user.uid];
    
    const unsubGivers = onSnapshot(collection(db, ...basePath, 'givers'), 
      (snap) => setGivers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEvents = onSnapshot(collection(db, ...basePath, 'events'), 
      (snap) => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubGifts = onSnapshot(collection(db, ...basePath, 'gifts'), 
      (snap) => setGifts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubBudgets = onSnapshot(collection(db, ...basePath, 'budgets'), 
      (snap) => {
        const b = {}; snap.docs.forEach(d => { b[d.id] = d.data(); });
        setEventBudgets(b);
      }
    );
    const unsubParticipants = onSnapshot(collection(db, ...basePath, 'participants'), 
      (snap) => {
        const p = {}; snap.docs.forEach(d => { p[d.id] = d.data().ids || []; });
        setEventParticipants(p);
      }
    );

    return () => {
      unsubGivers(); unsubEvents(); unsubGifts(); unsubBudgets(); unsubParticipants();
    };
  }, [user]);

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);
  const eventGifts = useMemo(() => gifts.filter(g => g.eventId === selectedEventId), [gifts, selectedEventId]);

  const activeGiversForEvent = useMemo(() => {
    const participantIds = eventParticipants[selectedEventId] || [];
    return givers.filter(g => participantIds.includes(g.id));
  }, [givers, eventParticipants, selectedEventId]);

  const getGiverSpending = (eventId, giverId) => {
    return gifts.filter(g => g.eventId === eventId && g.giverId === giverId)
                .reduce((sum, g) => sum + Number(g.price), 0);
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'events'), {
      name: fd.get('name'),
      date: fd.get('date'),
      category: fd.get('category') || 'Allgemein'
    });
    e.target.reset();
  };

  const startEditGift = (gift) => {
    setEditingGiftId(gift.id);
    setEditFormData({ name: gift.name, price: gift.price, giverId: gift.giverId });
  };

  const saveEditGift = async (giftId) => {
    const giftRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', giftId);
    await updateDoc(giftRef, {
      name: editFormData.name,
      price: Number(editFormData.price),
      giverId: editFormData.giverId
    });
    setEditingGiftId(null);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><Loader2 className="animate-spin w-12 h-12" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <h1 className="text-2xl font-black text-white text-center mb-6">GiftPlanner <span className="text-indigo-500">Pro</span></h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-Mail" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Passwort" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-500 transition-all">Login</button>
          </form>
          {authError && <p className="text-red-400 text-sm mt-4 text-center">{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 text-slate-100 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <header className="mb-6 flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">GiftPlanner <span className="text-indigo-500">Pro</span></h1>
            <p className="text-slate-500 text-xs italic">by Jan Klonek</p>
          </div>
          <button onClick={handleLogout} className="p-2 hover:text-red-400 transition-colors"><LogOut className="w-5 h-5" /></button>
        </header>

        <nav className="flex space-x-2 mb-6 bg-slate-900/50 p-1 rounded-xl border border-slate-800 max-w-xs">
          <button onClick={() => setView('events')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${view !== 'givers' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Anlässe</button>
          <button onClick={() => setView('givers')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'givers' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Personen</button>
        </nav>

        {view === 'events' && (
          <div className="space-y-6">
            <section className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
              <form onSubmit={handleAddEvent} className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Event</label>
                  <input name="name" placeholder="Name" required className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Datum</label>
                  <input name="date" type="date" required className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" />
                </div>
                <div className="w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Typ</label>
                  <input name="category" placeholder="Kategorie" className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" />
                </div>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"><Plus className="w-5 h-5" /></button>
              </form>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {events.map(event => (
                <div key={event.id} onClick={() => { setSelectedEventId(event.id); setView('detail'); }} className="bg-slate-900 p-3 rounded-xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer flex justify-between items-center group transition-all">
                  <div className="truncate">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">{event.category}</span>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 truncate">{event.name}</h3>
                    <div className="flex items-center text-slate-500 text-[10px]">
                      <Calendar className="w-3 h-3 mr-1" /> {new Date(event.date).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-indigo-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'detail' && selectedEvent && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <button onClick={() => setView('events')} className="flex items-center text-slate-400 hover:text-white text-xs font-bold transition-colors"><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</button>
            
            <div className="bg-indigo-700 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">{selectedEvent.name}</h2>
                <p className="text-indigo-200 text-xs">{new Date(selectedEvent.date).toLocaleDateString('de-DE')}</p>
              </div>
              <Gift className="w-8 h-8 text-indigo-400 opacity-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-2">
                <h3 className="text-xs font-black uppercase text-slate-500 px-1">Budgets</h3>
                {givers.map(giver => {
                  const isPart = (eventParticipants[selectedEventId] || []).includes(giver.id);
                  const spent = getGiverSpending(selectedEventId, giver.id);
                  const budget = eventBudgets[selectedEventId]?.[giver.id] || 0;
                  return (
                    <div key={giver.id} className={`p-3 rounded-xl border ${isPart ? 'bg-slate-900 border-indigo-500/30' : 'bg-slate-950 border-slate-800 opacity-40'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold">{giver.name}</span>
                        <button onClick={() => {
                          const current = eventParticipants[selectedEventId] || [];
                          const ids = current.includes(giver.id) ? current.filter(i => i !== giver.id) : [...current, giver.id];
                          setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participants', selectedEventId), { ids });
                        }}>{isPart ? <Eye className="w-4 h-4 text-indigo-400" /> : <EyeOff className="w-4 h-4" />}</button>
                      </div>
                      {isPart && (
                        <div className="flex items-center gap-2">
                          <input type="number" value={budget || ''} placeholder="Budget" className="w-full p-1 bg-slate-800 rounded text-xs outline-none" onChange={(e) => setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'budgets', selectedEventId), {...(eventBudgets[selectedEventId] || {}), [giver.id]: Number(e.target.value)})} />
                          <span className={`text-[10px] font-bold whitespace-nowrap ${spent > budget && budget > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{spent.toFixed(2)}€</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-2 space-y-3">
                <section className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts'), {
                      eventId: selectedEventId, name: fd.get('name'), price: Number(fd.get('price')), giverId: fd.get('giverId')
                    });
                    e.target.reset();
                  }} className="grid grid-cols-4 gap-2">
                    <input name="name" placeholder="Geschenk" required className="col-span-2 p-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none" />
                    <input name="price" type="number" step="0.01" placeholder="€" required className="p-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none" />
                    <button type="submit" disabled={activeGiversForEvent.length === 0} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"><Plus className="w-4 h-4 mx-auto" /></button>
                    <select name="giverId" required className="col-span-4 p-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none">
                      <option value="">Wer hat es gekauft?</option>
                      {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </form>
                </section>

                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-800">
                      {eventGifts.map(gift => (
                        <tr key={gift.id} className="hover:bg-slate-800/50">
                          {editingGiftId === gift.id ? (
                            <>
                              <td className="p-2" colSpan="2">
                                <input 
                                  className="w-full p-1 bg-slate-800 rounded text-white text-xs" 
                                  value={editFormData.name} 
                                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                                />
                                <input 
                                  type="number"
                                  className="w-full mt-1 p-1 bg-slate-800 rounded text-white font-mono text-xs" 
                                  value={editFormData.price} 
                                  onChange={(e) => setEditFormData({...editFormData, price: e.target.value})}
                                />
                              </td>
                              <td className="p-2">
                                <select 
                                  className="w-full p-1 bg-slate-800 rounded text-white text-xs" 
                                  value={editFormData.giverId}
                                  onChange={(e) => setEditFormData({...editFormData, giverId: e.target.value})}
                                >
                                  {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => saveEditGift(gift.id)} className="text-emerald-400 p-1"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingGiftId(null)} className="text-slate-500 p-1"><X className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-bold">{gift.name}</td>
                              <td className="p-3 text-right text-indigo-400 font-mono">{Number(gift.price).toFixed(2)}€</td>
                              <td className="p-3 text-slate-500">{givers.find(g => g.id === gift.giverId)?.name}</td>
                              <td className="p-3 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => startEditGift(gift)} className="text-slate-600 hover:text-indigo-400"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id))} className="text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'givers' && (
          <div className="max-w-md mx-auto space-y-4">
            <section className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = new FormData(e.target).get('name');
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'givers'), { name });
                e.target.reset();
              }} className="flex gap-2">
                <input name="name" placeholder="Name der Person" required className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" />
                <button type="submit" className="bg-indigo-600 px-4 py-2 rounded-lg text-sm font-bold">Add</button>
              </form>
            </section>
            <div className="grid grid-cols-2 gap-2">
              {givers.map(giver => (
                <div key={giver.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items