import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc 
} from 'firebase/firestore';
import { 
  Plus, Trash2, ChevronRight, ChevronDown, ChevronUp, ArrowLeft,
  Loader2, Eye, EyeOff, AlertTriangle, Calendar, LogOut, Gift,
  Edit2, Check, X, BarChart3, LayoutList, Settings2, Clock, 
  Package, ShoppingCart, CheckCircle2, Archive, Copy, RefreshCw, Save
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
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventData, setEditEventData] = useState({ name: '', date: '', category: '' });
  const [editFormData, setEditFormData] = useState({ name: '', price: '', giverId: '', status: 'Idee' });
  const [isBudgetsCollapsed, setIsBudgetsCollapsed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError("Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const bP = ['artifacts', APP_ID, 'users', user.uid];
    onSnapshot(collection(db, ...bP, 'givers'), (s) => setGivers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, ...bP, 'events'), (s) => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, ...bP, 'gifts'), (s) => setGifts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, ...bP, 'budgets'), (s) => {
      const b = {}; s.docs.forEach(d => { b[d.id] = d.data(); });
      setEventBudgets(b);
    });
    onSnapshot(collection(db, ...bP, 'participants'), (s) => {
      const p = {}; s.docs.forEach(d => { p[d.id] = d.data().ids || []; });
      setEventParticipants(p);
    });
  }, [user]);

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);
  
  // Sortierung: Aktive Schenkende nach oben
  const sortedGivers = useMemo(() => {
    return [...givers].sort((a, b) => {
      const isAPart = (eventParticipants[selectedEventId] || []).includes(a.id);
      const isBPart = (eventParticipants[selectedEventId] || []).includes(b.id);
      if (isAPart && !isBPart) return -1;
      if (!isAPart && isBPart) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [givers, eventParticipants, selectedEventId]);

  const eventGifts = useMemo(() => gifts.filter(g => g.eventId === selectedEventId), [gifts, selectedEventId]);
  
  const activeGiversForEvent = useMemo(() => {
    const pIds = eventParticipants[selectedEventId] || [];
    return givers.filter(g => pIds.includes(g.id));
  }, [givers, eventParticipants, selectedEventId]);

  const totals = useMemo(() => {
    const budget = activeGiversForEvent.reduce((s, g) => s + (Number(eventBudgets[selectedEventId]?.[g.id]) || 0), 0);
    const spent = eventGifts.reduce((s, g) => s + (Number(g.price) || 0), 0);
    return { budget, spent, remaining: budget - spent };
  }, [activeGiversForEvent, eventBudgets, eventGifts, selectedEventId]);

  const handleUpdateEvent = async () => {
    await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'events', selectedEventId), {
      name: editEventData.name,
      date: editEventData.date,
      category: editEventData.category
    });
    setIsEditingEvent(false);
  };

  const handleCopyEvent = async (event) => {
    const newEvent = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'events'), {
      name: `${event.name} (Kopie)`,
      date: event.date,
      category: event.category,
      archived: false
    });
    if (eventParticipants[event.id]) await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participants', newEvent.id), { ids: eventParticipants[event.id] });
    if (eventBudgets[event.id]) await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'budgets', newEvent.id), eventBudgets[event.id]);
  };

  const getEventStats = (eventId) => {
    const g = gifts.filter(gift => gift.eventId === eventId);
    return {
      ideas: g.filter(gift => gift.status === 'Idee').length,
      bought: g.filter(gift => gift.status === 'Gekauft').length,
      wrapped: g.filter(gift => gift.status === 'Verpackt').length
    };
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><Loader2 className="animate-spin w-16 h-16" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 p-12 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <h1 className="text-3xl font-black text-white text-center mb-8 text-indigo-500">GiftPlanner Pro</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="email" placeholder="E-Mail" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-xl hover:bg-indigo-500 transition-all">Anmelden</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-10 text-slate-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-8 flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">GiftPlanner <span className="text-indigo-500">Pro</span></h1>
            <p className="text-slate-500 text-xs mt-1 font-medium italic">by Jan Klonek</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl hover:text-red-400 transition-all shadow-sm"><LogOut className="w-6 h-6" /></button>
        </header>

        <nav className="flex flex-wrap gap-3 mb-8">
          <div className="flex space-x-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
            <button onClick={() => {setView('events'); setShowArchived(false);}} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'events' && !showArchived ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Aktuell</button>
            <button onClick={() => {setView('events'); setShowArchived(true);}} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${showArchived ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Archiv</button>
          </div>
          <button onClick={() => setView('givers')} className={`px-6 py-3 rounded-2xl border border-slate-800 text-xs font-black transition-all ${view === 'givers' ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-900'}`}>Personen</button>
        </nav>

        {view === 'events' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {!showArchived && (
              <section className="bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl">
                <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center text-indigo-400"><Plus className="w-7 h-7 mr-3" /> Neuer Anlass</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'events'), {
                    name: fd.get('name'), date: fd.get('date'), category: fd.get('category') || 'Allgemein', archived: false
                  });
                  e.target.reset();
                }} className="flex flex-wrap lg:flex-nowrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-wider">Event Name</label><input name="name" placeholder="Name" required className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base outline-none focus:ring-2 focus:ring-indigo-500 transition-all" /></div>
                  <div className="w-full sm:w-48"><label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-wider">Datum</label><input name="date" type="date" required className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div className="w-full sm:w-48"><label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-wider">Kategorie</label><input name="category" placeholder="Familie" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <button type="submit" className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl shadow-lg transition-all flex items-center justify-center"><Plus className="w-7 h-7" /></button>
                </form>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.filter(e => !!e.archived === showArchived).map(event => {
                const stats = getEventStats(event.id);
                return (
                  <div key={event.id} className="bg-slate-900 p-6 rounded-[1.5rem] border border-slate-800 hover:border-indigo-500/50 flex flex-col justify-between group transition-all shadow-md">
                    <div onClick={() => { setSelectedEventId(event.id); setView('detail'); }} className="cursor-pointer mb-6">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{event.category}</span>
                      <h3 className="text-xl font-black text-white group-hover:text-indigo-400 truncate mt-1">{event.name}</h3>
                      <div className="flex items-center text-slate-500 text-xs mt-2 font-medium"><Calendar className="w-4 h-4 mr-2" /> {new Date(event.date).toLocaleDateString('de-DE')}</div>
                      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800/50">
                        <div className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-500" /> <span className="text-xs font-bold">{stats.ideas}</span></div>
                        <div className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5 text-amber-500" /> <span className="text-xs font-bold">{stats.bought}</span></div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-xs font-bold">{stats.wrapped}</span></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                      <div className="flex gap-1">
                        {!showArchived && <button onClick={() => handleCopyEvent(event)} className="p-2 text-slate-600 hover:text-indigo-400 hover:bg-slate-800 rounded-lg"><Copy className="w-4 h-4" /></button>}
                        <button onClick={() => updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'events', event.id), { archived: !showArchived })} className="p-2 text-slate-600 hover:text-amber-400 hover:bg-slate-800 rounded-lg">{showArchived ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}</button>
                        {showArchived && <button onClick={() => window.confirm("Löschen?") && deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'events', event.id))} className="p-2 text-slate-600 hover:text-red-500 hover:bg-slate-800 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <ChevronRight onClick={() => { setSelectedEventId(event.id); setView('detail'); }} className="w-6 h-6 text-slate-700 cursor-pointer group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'detail' && selectedEvent && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <button onClick={() => {setView('events'); setIsEditingEvent(false);}} className="flex items-center text-slate-400 hover:text-white text-xs font-black transition-all"><ArrowLeft className="w-5 h-5 mr-2" /> Zurück</button>
              <button onClick={() => setIsBudgetsCollapsed(!isBudgetsCollapsed)} className="w-full sm:w-auto flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase text-indigo-400 bg-indigo-400/10 px-4 py-2 rounded-xl border border-indigo-500/10 transition-all hover:bg-indigo-400/20">{isBudgetsCollapsed ? <><Settings2 className="w-4 h-4" /> Budgets</> : <><LayoutList className="w-4 h-4" /> Liste</>}</button>
            </div>
            
            {/* Header / Edit Bereich */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 md:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
              {isEditingEvent ? (
                <div className="space-y-4 relative z-10">
                  <input className="w-full p-3 bg-slate-900/50 border border-white/20 rounded-xl text-2xl font-black text-white outline-none" value={editEventData.name} onChange={e => setEditEventData({...editEventData, name: e.target.value})} />
                  <div className="flex gap-4">
                    <input type="date" className="flex-1 p-3 bg-slate-900/50 border border-white/20 rounded-xl text-white outline-none" value={editEventData.date} onChange={e => setEditEventData({...editEventData, date: e.target.value})} />
                    <input placeholder="Kategorie" className="flex-1 p-3 bg-slate-900/50 border border-white/20 rounded-xl text-white outline-none" value={editEventData.category} onChange={e => setEditEventData({...editEventData, category: e.target.value})} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUpdateEvent} className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-black flex items-center gap-2 shadow-lg"><Save className="w-4 h-4" /> Speichern</button>
                    <button onClick={() => setIsEditingEvent(false)} className="bg-white/10 text-white px-6 py-2 rounded-xl font-black">Abbruch</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start relative z-10">
                  <div onClick={() => { setIsEditingEvent(true); setEditEventData({name: selectedEvent.name, date: selectedEvent.date, category: selectedEvent.category}); }} className="cursor-pointer hover:opacity-80 transition-all">
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">{selectedEvent.name} <Edit2 className="w-5 h-5 inline ml-2 opacity-50" /></h2>
                    <p className="text-indigo-100 text-sm md:text-lg mt-1 font-medium">{new Date(selectedEvent.date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <BarChart3 className="w-10 h-10 text-white opacity-20" />
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-2 md:gap-6 bg-slate-950/30 p-4 md:p-6 rounded-3xl border border-white/10 backdrop-blur-sm relative z-10 mt-8">
                <div className="text-center"><p className="text-[7px] md:text-[10px] uppercase font-black text-indigo-100 tracking-widest mb-1">Budget</p><p className="text-base md:text-2xl font-black">{totals.budget.toFixed(2)}€</p></div>
                <div className="text-center border-x border-white/10"><p className="text-[7px] md:text-[10px] uppercase font-black text-indigo-100 tracking-widest mb-1">Ist-Ausgaben</p><p className="text-base md:text-2xl font-black text-emerald-300">{totals.spent.toFixed(2)}€</p></div>
                <div className="text-center"><p className="text-[7px] md:text-[10px] uppercase font-black text-indigo-100 tracking-widest mb-1">Differenz</p><p className={`text-base md:text-2xl font-black ${totals.remaining < 0 ? 'text-red-300' : 'text-indigo-100'}`}>{totals.remaining.toFixed(2)}€</p></div>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${isBudgetsCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-8 items-start`}>
              {!isBudgetsCollapsed && (
                <div className="lg:col-span-1 space-y-4 animate-in slide-in-from-left-4 duration-500">
                  <h3 className="text-xs font-black uppercase text-slate-500 px-2 tracking-widest">Schenkende (Aktiv oben)</h3>
                  {sortedGivers.map(giver => {
                    const isPart = (eventParticipants[selectedEventId] || []).includes(giver.id);
                    const spent = gifts.filter(g => g.eventId === selectedEventId && g.giverId === giver.id).reduce((s, g) => s + (Number(g.price) || 0), 0);
                    const budget = Number(eventBudgets[selectedEventId]?.[giver.id]) || 0;
                    return (
                      <div key={giver.id} className={`p-4 rounded-2xl border transition-all ${isPart ? 'bg-slate-900 border-indigo-500/30 ring-1 ring-indigo-500/10 shadow-sm' : 'bg-slate-950 border-slate-800 opacity-40'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-base font-bold text-white">{giver.name}</span>
                          <button onClick={() => {
                            const current = eventParticipants[selectedEventId] || [];
                            const ids = current.includes(giver.id) ? current.filter(i => i !== giver.id) : [...current, giver.id];
                            setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participants', selectedEventId), { ids });
                          }}>{isPart ? <Eye className="w-5 h-5 text-indigo-400" /> : <EyeOff className="w-5 h-5 text-slate-600" />}</button>
                        </div>
                        {isPart && (
                          <div className="flex items-center gap-3 pt-3 border-t border-slate-800/50 mt-2">
                            <input type="number" value={budget || ''} placeholder="Budget €" className="w-full p-2 bg-slate-800 rounded-xl text-xs font-black outline-none border border-slate-700" onChange={(e) => setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'budgets', selectedEventId), {...(eventBudgets[selectedEventId] || {}), [giver.id]: Number(e.target.value)}) } />
                            <div className="text-right shrink-0"><p className={`text-sm font-black ${spent > budget && budget > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{spent.toFixed(2)}€</p></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={`${isBudgetsCollapsed ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-6`}>
                <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                  <h3 className="text-sm font-black uppercase text-indigo-400 px-1 mb-4 tracking-widest">Neues Geschenk</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts'), {
                      eventId: selectedEventId, name: fd.get('name'), price: Number(fd.get('price')) || 0, giverId: fd.get('giverId') || '', status: 'Idee'
                    });
                    e.target.reset();
                  }} className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <input name="name" placeholder="Geschenk" required className="sm:col-span-5 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base outline-none" />
                    <input name="price" type="number" step="0.01" placeholder="€" required className="sm:col-span-2 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base font-mono outline-none" />
                    <select name="giverId" className="sm:col-span-3 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs outline-none">
                      <option value="">Noch offen</option>
                      {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button type="submit" className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black flex items-center justify-center py-3"><Plus className="w-8 h-8" /></button>
                  </form>
                </section>

                <div className="space-y-3">
                  {eventGifts.map(gift => (
                    <div key={gift.id} className="bg-slate-900 p-5 rounded-[1.5rem] border border-slate-800 flex flex-col gap-4 shadow-sm group">
                      {editingGiftId === gift.id ? (
                        <div className="flex flex-col gap-4">
                          <input className="p-4 bg-slate-800 border border-indigo-500/50 rounded-2xl text-white outline-none" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input type="number" step="0.01" className="p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white font-mono outline-none" value={editFormData.price} onChange={(e) => setEditFormData({...editFormData, price: e.target.value})} />
                            <select className="p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs outline-none" value={editFormData.giverId} onChange={(e) => setEditFormData({...editFormData, giverId: e.target.value})}><option value="">Offen</option>{activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                            <select className="p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs outline-none" value={editFormData.status} onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}><option value="Idee">💡 Idee</option><option value="Gekauft">🛒 Gekauft</option><option value="Verpackt">🎁 Verpackt</option></select>
                          </div>
                          <div className="flex justify-end gap-3 mt-2">
                            <button onClick={() => { 
                              updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id), { name: editFormData.name, price: Number(editFormData.price) || 0, giverId: editFormData.giverId, status: editFormData.status });
                              setEditingGiftId(null);
                            }} className="text-emerald-400 bg-emerald-400/10 px-6 py-2 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-emerald-400/20"><Check className="w-4 h-4" /> Save</button>
                            <button onClick={() => setEditingGiftId(null)} className="text-slate-500 bg-slate-500/10 px-6 py-2 rounded-xl text-sm font-black flex items-center gap-2"><X className="w-4 h-4" /> Abbruch</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex-1 truncate pr-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 ${gift.status === 'Verpackt' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : gift.status === 'Gekauft' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-slate-400 bg-slate-400/10 border-slate-400/20'}`}>
                                {gift.status === 'Verpackt' ? <CheckCircle2 className="w-3 h-3" /> : gift.status === 'Gekauft' ? <ShoppingCart className="w-3 h-3" /> : <Package className="w-3 h-3" />} {gift.status}
                              </span>
                            </div>
                            <p className="text-lg font-black text-white truncate leading-tight tracking-tight">{gift.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">{givers.find(g => g.id === gift.giverId)?.name || "Zuweisung offen"}</p>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <p className="text-xl font-black text-indigo-400 font-mono tracking-tighter">{Number(gift.price).toFixed(2)}€</p>
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingGiftId(gift.id); setEditFormData({ name: gift.name, price: gift.price, giverId: gift.giverId || '', status: gift.status || 'Idee' }); }} className="p-2 text-slate-600 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-all shadow-sm"><Edit2 className="w-5 h-5" /></button>
                              <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id))} className="p-2 text-slate-600 hover:text-red-500 hover:bg-slate-800 rounded-xl transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'givers' && (
          <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500">
            <section className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] border border-slate-800 shadow-xl">
              <h2 className="text-2xl font-black mb-6 text-indigo-400">Personen-Stamm</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = new FormData(e.target).get('name');
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'givers'), { name });
                e.target.reset();
              }} className="flex flex-col sm:flex-row gap-4">
                <input name="name" placeholder="Name..." required className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-10 py-4 rounded-2xl shadow-lg transition-all">Hinzufügen</button>
              </form>
            </section>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {givers.map(giver => (
                <div key={giver.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center group shadow-sm transition-all hover:border-slate-700">
                  <span className="font-bold text-lg text-white">{giver.name}</span>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'givers', giver.id))} className="text-slate-700 hover:text-red-500 p-2 hover:bg-slate-800 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
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