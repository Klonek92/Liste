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
  Plus, Trash2, ChevronRight, ChevronDown, ChevronUp, ArrowLeft,
  Loader2, Eye, EyeOff, AlertTriangle, Calendar, LogOut, Gift,
  Edit2, Check, X, BarChart3, LayoutList, Settings2
} from 'lucide-react';

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
  
  // Logik für das Einklappen der gesamten Budget-Sektion
  const [isBudgetsCollapsed, setIsBudgetsCollapsed] = useState(false);

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
    const unsubGivers = onSnapshot(collection(db, ...basePath, 'givers'), (snap) => setGivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEvents = onSnapshot(collection(db, ...basePath, 'events'), (snap) => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubGifts = onSnapshot(collection(db, ...basePath, 'gifts'), (snap) => setGifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBudgets = onSnapshot(collection(db, ...basePath, 'budgets'), (snap) => {
      const b = {}; snap.docs.forEach(d => { b[d.id] = d.data(); });
      setEventBudgets(b);
    });
    const unsubParticipants = onSnapshot(collection(db, ...basePath, 'participants'), (snap) => {
      const p = {}; snap.docs.forEach(d => { p[d.id] = d.data().ids || []; });
      setEventParticipants(p);
    });
    return () => { unsubGivers(); unsubEvents(); unsubGifts(); unsubBudgets(); unsubParticipants(); };
  }, [user]);

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);
  const eventGifts = useMemo(() => gifts.filter(g => g.eventId === selectedEventId), [gifts, selectedEventId]);
  const activeGiversForEvent = useMemo(() => {
    const participantIds = eventParticipants[selectedEventId] || [];
    return givers.filter(g => participantIds.includes(g.id));
  }, [givers, eventParticipants, selectedEventId]);

  const totals = useMemo(() => {
    const budget = activeGiversForEvent.reduce((sum, g) => sum + (eventBudgets[selectedEventId]?.[g.id] || 0), 0);
    const spent = eventGifts.reduce((sum, g) => sum + Number(g.price), 0);
    return { budget, spent, remaining: budget - spent };
  }, [activeGiversForEvent, eventBudgets, eventGifts, selectedEventId]);

  const getGiverSpending = (eventId, giverId) => gifts.filter(g => g.eventId === eventId && g.giverId === giverId).reduce((sum, g) => sum + Number(g.price), 0);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'events'), { name: fd.get('name'), date: fd.get('date'), category: fd.get('category') || 'Allgemein' });
    e.target.reset();
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><Loader2 className="animate-spin w-12 h-12" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <h1 className="text-2xl font-black text-white text-center mb-6 text-indigo-500">GiftPlanner Pro</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-Mail" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Passwort" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-500">Login</button>
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
                <div className="flex-1 min-w-[140px]"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Event</label><input name="name" placeholder="Name" required className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" /></div>
                <div className="w-32"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Datum</label><input name="date" type="date" required className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" /></div>
                <div className="w-32"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Typ</label><input name="category" placeholder="Kategorie" className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" /></div>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg"><Plus className="w-5 h-5" /></button>
              </form>
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {events.map(event => (
                <div key={event.id} onClick={() => { setSelectedEventId(event.id); setView('detail'); }} className="bg-slate-900 p-3 rounded-xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer flex justify-between items-center group transition-all">
                  <div className="truncate">
                    <span className="text-[9px] font-black text-indigo-400 uppercase">{event.category}</span>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 truncate">{event.name}</h3>
                    <div className="flex items-center text-slate-500 text-[10px]"><Calendar className="w-3 h-3 mr-1" /> {new Date(event.date).toLocaleDateString('de-DE')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-indigo-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'detail' && selectedEvent && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <button onClick={() => setView('events')} className="flex items-center text-slate-400 hover:text-white text-xs font-bold"><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</button>
              <button 
                onClick={() => setIsBudgetsCollapsed(!isBudgetsCollapsed)}
                className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-lg hover:bg-indigo-400/20 transition-all"
              >
                {isBudgetsCollapsed ? <><Settings2 className="w-3 h-3" /> Budgets einblenden</> : <><LayoutList className="w-3 h-3" /> Nur Liste zeigen</>}
              </button>
            </div>
            
            <div className="bg-indigo-700 p-4 rounded-2xl">
              <div className="flex justify-between items-start mb-4">
                <div><h2 className="text-xl font-black">{selectedEvent.name}</h2><p className="text-indigo-200 text-xs">{new Date(selectedEvent.date).toLocaleDateString('de-DE')}</p></div>
                <BarChart3 className="w-6 h-6 text-indigo-300 opacity-50" />
              </div>
              
              <div className="grid grid-cols-3 gap-2 bg-indigo-900/40 p-3 rounded-xl border border-indigo-400/20">
                <div className="text-center"><p className="text-[8px] uppercase font-bold text-indigo-200">Gesamt-Budget</p><p className="text-sm font-black">{totals.budget.toFixed(2)}€</p></div>
                <div className="text-center border-x border-indigo-400/20"><p className="text-[8px] uppercase font-bold text-indigo-200">Ist-Ausgaben</p><p className="text-sm font-black text-emerald-300">{totals.spent.toFixed(2)}€</p></div>
                <div className="text-center"><p className="text-[8px] uppercase font-bold text-indigo-200">Differenz</p><p className={`text-sm font-black ${totals.remaining < 0 ? 'text-red-300' : 'text-indigo-100'}`}>{totals.remaining.toFixed(2)}€</p></div>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${isBudgetsCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-4 transition-all`}>
              {/* Teilnehmer-Sektion (Bedingt eingeblendet) */}
              {!isBudgetsCollapsed && (
                <div className="lg:col-span-1 space-y-2 animate-in slide-in-from-left-2 duration-300">
                  <h3 className="text-xs font-black uppercase text-slate-500 px-1">Teilnehmer-Budgets</h3>
                  {givers.map(giver => {
                    const isPart = (eventParticipants[selectedEventId] || []).includes(giver.id);
                    const spent = getGiverSpending(selectedEventId, giver.id);
                    const budget = eventBudgets[selectedEventId]?.[giver.id] || 0;
                    return (
                      <div key={giver.id} className={`p-2 rounded-xl border transition-all ${isPart ? 'bg-slate-900 border-indigo-500/30' : 'bg-slate-950 border-slate-800 opacity-40'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold">{giver.name}</span>
                          <button onClick={() => {
                            const current = eventParticipants[selectedEventId] || [];
                            const ids = current.includes(giver.id) ? current.filter(i => i !== giver.id) : [...current, giver.id];
                            setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participants', selectedEventId), { ids });
                          }}>{isPart ? <Eye className="w-4 h-4 text-indigo-400" /> : <EyeOff className="w-4 h-4 text-slate-600" />}</button>
                        </div>
                        {isPart && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50 mt-1">
                            <input type="number" value={budget || ''} placeholder="Budget €" className="w-full p-1 bg-slate-800 rounded text-[10px] outline-none" onChange={(e) => setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'budgets', selectedEventId), {...(eventBudgets[selectedEventId] || {}), [giver.id]: Number(e.target.value)})} />
                            <p className="text-[10px] font-black text-emerald-400 whitespace-nowrap">{spent.toFixed(2)}€</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Geschenke-Sektion (Nimmt vollen Platz ein, wenn Budgets zu sind) */}
              <div className={`${isBudgetsCollapsed ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-3 transition-all`}>
                <section className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts'), { eventId: selectedEventId, name: fd.get('name'), price: Number(fd.get('price')), giverId: fd.get('giverId') });
                    e.target.reset();
                  }} className="grid grid-cols-4 gap-2">
                    <input name="name" placeholder="Geschenk" required className="col-span-2 p-2 bg-slate-800 rounded text-xs outline-none border border-slate-700" />
                    <input name="price" type="number" step="0.01" placeholder="€" required className="p-2 bg-slate-800 rounded text-xs outline-none border border-slate-700" />
                    <button type="submit" disabled={activeGiversForEvent.length === 0} className="bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold text-white"><Plus className="w-4 h-4 mx-auto" /></button>
                    <select name="giverId" required className="col-span-4 p-2 bg-slate-800 rounded text-xs outline-none border border-slate-700">
                      <option value="">Käufer wählen...</option>
                      {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </form>
                </section>

                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase text-slate-500 px-1">Geschenke-Liste</h3>
                  {eventGifts.map(gift => (
                    <div key={gift.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all hover:border-slate-700 shadow-sm">
                      {editingGiftId === gift.id ? (
                        <div className="flex flex-col gap-2">
                          <input className="p-2 bg-slate-800 rounded text-white text-xs border border-indigo-500/50" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
                          <div className="flex gap-2">
                            <input type="number" className="flex-1 p-2 bg-slate-800 rounded text-white text-xs" value={editFormData.price} onChange={(e) => setEditFormData({...editFormData, price: e.target.value})} />
                            <select className="flex-1 p-2 bg-slate-800 rounded text-white text-xs" value={editFormData.giverId} onChange={(e) => setEditFormData({...editFormData, giverId: e.target.value})}>
                              {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </div>
                          <div className="flex justify-end gap-2 mt-1">
                            <button onClick={() => { 
                              const giftRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id);
                              updateDoc(giftRef, { name: editFormData.name, price: Number(editFormData.price), giverId: editFormData.giverId });
                              setEditingGiftId(null);
                            }} className="text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Save</button>
                            <button onClick={() => setEditingGiftId(null)} className="text-slate-500 bg-slate-500/10 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">{gift.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{givers.find(g => g.id === gift.giverId)?.name}</p>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <p className="text-sm font-black text-indigo-400 font-mono">{Number(gift.price).toFixed(2)}€</p>
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingGiftId(gift.id); setEditFormData({ name: gift.name, price: gift.price, giverId: gift.giverId }); }} className="p-1.5 text-slate-600 hover:text-indigo-400"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id))} className="p-1.5 text-slate-600 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {eventGifts.length === 0 && <p className="text-center text-xs text-slate-600 italic p-4">Keine Geschenke eingetragen.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'givers' && (
          <div className="max-w-md mx-auto space-y-4">
            <section className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = new FormData(e.target).get('name');
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'givers'), { name });
                e.target.reset();
              }} className="flex gap-2">
                <input name="name" placeholder="Name der Person" required className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none" />
                <button type="submit" className="bg-indigo-600 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-md">Add</button>
              </form>
            </section>
            <div className="grid grid-cols-2 gap-2">
              {givers.map(giver => (
                <div key={giver.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center group shadow-sm">
                  <span className="font-bold text-sm truncate">{giver.name}</span>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'givers', giver.id))} className="text-slate-700 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;