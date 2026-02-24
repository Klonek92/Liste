import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc, query, where } from 'firebase/firestore';
import { 
  Plus, Trash2, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Loader2, Eye, EyeOff, 
  Calendar, LogOut, Gift, Edit2, Check, X, BarChart3, LayoutList, Settings2, Clock, 
  Package, ShoppingCart, CheckCircle2, Archive, Copy, RefreshCw, Save, 
  Palmtree, MapPin, Info, Sun, CloudRain, Infinity, Globe, Navigation, Users, Timer, Euro
} from 'lucide-react';

// --- INITIALISIERUNG ---
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
const HUB_ID = "personal-hub-v2";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><Loader2 className="animate-spin w-16 h-16" /></div>;
  if (!user) return <LoginScreen onLogin={(e, p) => signInWithEmailAndPassword(auth, e, p).catch(err => setAuthError("Login fehlgeschlagen."))} error={authError} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {!activeModule ? (
        <PortalDashboard onSelect={setActiveModule} />
      ) : activeModule === 'gifts' ? (
        <GiftModule user={user} onBack={() => setActiveModule(null)} />
      ) : (
        <TravelModule user={user} onBack={() => setActiveModule(null)} />
      )}
    </div>
  );
};

// --- PORTAL NAVIGATION ---
const PortalDashboard = ({ onSelect }) => (
  <div className="max-w-6xl mx-auto pt-16 md:pt-32 p-6 animate-in fade-in duration-700">
    <div className="text-center mb-16">
      <h1 className="text-4xl md:text-6xl font-black tracking-tighter">Jan's <span className="text-indigo-500">Hub</span></h1>
      <p className="text-slate-500 mt-2 font-medium uppercase tracking-[0.3em] text-[10px]">Stuttgart // Herrenberg</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <ModuleCard 
        title="Geschenk-Controlling" 
        desc="Budgets, Ideen und Status-Tracking für alle Anlässe."
        icon={<Gift className="w-12 h-12 text-indigo-500" />}
        onClick={() => onSelect('gifts')}
        color="hover:border-indigo-500"
      />
      <ModuleCard 
        title="Urlaubsplanung" 
        desc="Modulare Reiseziele, Wetter-Filter und Navigations-Links."
        icon={<Palmtree className="w-12 h-12 text-emerald-500" />}
        onClick={() => onSelect('travel')}
        color="hover:border-emerald-500"
      />
    </div>
    <button onClick={() => signOut(auth)} className="mt-20 mx-auto flex items-center gap-2 text-slate-600 hover:text-red-400 transition-all font-black text-xs uppercase tracking-widest">
      <LogOut className="w-4 h-4" /> Abmelden
    </button>
  </div>
);

const ModuleCard = ({ title, desc, icon, onClick, color }) => (
  <button onClick={onClick} className={`group p-8 md:p-12 bg-slate-900 border border-slate-800 rounded-[2.5rem] ${color} transition-all text-left shadow-2xl flex flex-col items-start`}>
    <div className="mb-6 group-hover:scale-110 transition-transform">{icon}</div>
    <h2 className="text-2xl font-black mb-2">{title}</h2>
    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
  </button>
);

// --- MODUL: GESCHENKE ---
const GiftModule = ({ user, onBack }) => {
  const [view, setView] = useState('events');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventData, setEditEventData] = useState({ name: '', date: '', category: '' });
  const [editingGiftId, setEditingGiftId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', price: '', giverId: '', status: 'Idee' });
  const [isBudgetsCollapsed, setIsBudgetsCollapsed] = useState(false);

  const [givers, setGivers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [eventBudgets, setEventBudgets] = useState({});
  const [eventParticipants, setEventParticipants] = useState({});

  const bP = ['artifacts', HUB_ID, 'users', user.uid];

  useEffect(() => {
    const unsub = [
      onSnapshot(collection(db, ...bP, 'gift_givers'), (s) => setGivers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, ...bP, 'gift_events'), (s) => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, ...bP, 'gift_items'), (s) => setGifts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, ...bP, 'gift_budgets'), (s) => { const b = {}; s.docs.forEach(d => { b[d.id] = d.data(); }); setEventBudgets(b); }),
      onSnapshot(collection(db, ...bP, 'gift_participants'), (s) => { const p = {}; s.docs.forEach(d => { p[d.id] = d.data().ids || []; }); setEventParticipants(p); })
    ];
    return () => unsub.forEach(f => f());
  }, []);

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);
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
  const totals = useMemo(() => {
    const pIds = eventParticipants[selectedEventId] || [];
    const active = givers.filter(g => pIds.includes(g.id));
    const budget = active.reduce((s, g) => s + (Number(eventBudgets[selectedEventId]?.[g.id]) || 0), 0);
    const spent = eventGifts.reduce((s, g) => s + (Number(g.price) || 0), 0);
    return { budget, spent, remaining: budget - spent };
  }, [givers, eventParticipants, eventBudgets, eventGifts, selectedEventId]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 animate-in fade-in duration-500">
      <header className="mb-8 flex justify-between items-center border-b border-slate-800 pb-6">
        <button onClick={selectedEventId ? () => {setSelectedEventId(null); setIsEditingEvent(false);} : onBack} className="flex items-center text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest">
          <ArrowLeft className="w-5 h-5 mr-2" /> {selectedEventId ? 'Zurück' : 'Portal'}
        </button>
        <h1 className="text-2xl font-black text-indigo-500 flex items-center gap-2"><Gift className="w-6 h-6" /> Geschenk-Controlling</h1>
      </header>

      {view === 'givers' ? (
        <div className="max-w-3xl mx-auto space-y-6">
          <button onClick={() => setView('events')} className="text-xs font-black uppercase text-slate-500 hover:text-white mb-4">← Zurück zu den Anlässen</button>
          <section className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800">
            <h2 className="text-xl font-black mb-6 text-indigo-400">Personen verwalten</h2>
            <form onSubmit={async (e) => {
              e.preventDefault(); const name = new FormData(e.target).get('name');
              await addDoc(collection(db, ...bP, 'gift_givers'), { name }); e.target.reset();
            }} className="flex gap-4">
              <input name="name" placeholder="Name..." required className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
              <button type="submit" className="bg-indigo-600 px-8 rounded-2xl font-black hover:bg-indigo-500 transition-all">Add</button>
            </form>
          </section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {givers.map(g => (
              <div key={g.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center group">
                <span className="font-bold text-lg">{g.name}</span>
                <button onClick={() => deleteDoc(doc(db, ...bP, 'gift_givers', g.id))} className="text-slate-700 hover:text-red-500 p-2"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        </div>
      ) : !selectedEventId ? (
        <div className="space-y-10">
          <nav className="flex gap-4 items-center">
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setShowArchived(false)} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${!showArchived ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Aktuell</button>
              <button onClick={() => setShowArchived(true)} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${showArchived ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Archiv</button>
            </div>
            <button onClick={() => setView('givers')} className="text-[10px] font-black uppercase text-slate-500 hover:text-indigo-400 transition-all border-l border-slate-800 pl-4 h-8">Personen verwalten</button>
          </nav>
          
          {!showArchived && (
            <section className="bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl">
              <form onSubmit={async (e) => {
                e.preventDefault(); const fd = new FormData(e.target);
                await addDoc(collection(db, ...bP, 'gift_events'), { name: fd.get('name'), date: fd.get('date'), category: fd.get('category') || 'Allgemein', archived: false });
                e.target.reset();
              }} className="flex flex-wrap lg:flex-nowrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Anlass</label><input name="name" placeholder="z.B. Geburtstag Max" required className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" /></div>
                <div className="w-full sm:w-48"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Datum</label><input name="date" type="date" required className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" /></div>
                <button type="submit" className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl"><Plus className="w-7 h-7 mx-auto" /></button>
              </form>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.filter(e => !!e.archived === showArchived).map(event => {
              const gList = gifts.filter(gift => gift.eventId === event.id);
              return (
                <div key={event.id} className="bg-slate-900 p-6 rounded-[1.5rem] border border-slate-800 hover:border-indigo-500/50 flex flex-col group transition-all shadow-md">
                  <div onClick={() => setSelectedEventId(event.id)} className="cursor-pointer flex-1">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{event.category}</span>
                    <h3 className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors truncate mt-1">{event.name}</h3>
                    <div className="flex items-center text-slate-500 text-xs mt-2 font-medium"><Calendar className="w-4 h-4 mr-2" /> {new Date(event.date).toLocaleDateString('de-DE')}</div>
                    <div className="flex gap-4 mt-4 pt-4 border-t border-slate-800/50">
                      <div className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-500" /> <span className="text-xs font-black">{gList.filter(g => g.status === 'Idee').length}</span></div>
                      <div className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5 text-amber-500" /> <span className="text-xs font-black">{gList.filter(g => g.status === 'Gekauft').length}</span></div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-xs font-black">{gList.filter(g => g.status === 'Verpackt').length}</span></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-800/50">
                    <div className="flex gap-2">
                      {!showArchived && <button onClick={() => {
                        addDoc(collection(db, ...bP, 'gift_events'), { name: `${event.name} (Kopie)`, date: event.date, category: event.category, archived: false }).then(docRef => {
                          if (eventParticipants[event.id]) setDoc(doc(db, ...bP, 'gift_participants', docRef.id), { ids: eventParticipants[event.id] });
                          if (eventBudgets[event.id]) setDoc(doc(db, ...bP, 'gift_budgets', docRef.id), eventBudgets[event.id]);
                        });
                      }} className="p-2 text-slate-600 hover:text-indigo-400 transition-all"><Copy className="w-4 h-4" /></button>}
                      <button onClick={() => updateDoc(doc(db, ...bP, 'gift_events', event.id), { archived: !showArchived })} className="p-2 text-slate-600 hover:text-amber-400 transition-all">{showArchived ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}</button>
                      {showArchived && <button onClick={() => window.confirm("Löschen?") && deleteDoc(doc(db, ...bP, 'gift_events', event.id))} className="p-2 text-slate-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-indigo-500 transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative">
            {isEditingEvent ? (
              <div className="space-y-4">
                <input className="w-full p-4 bg-slate-900/50 border border-white/20 rounded-2xl text-2xl font-black text-white outline-none" value={editEventData.name} onChange={e => setEditEventData({...editEventData, name: e.target.value})} />
                <div className="flex gap-4">
                  <input type="date" className="flex-1 p-4 bg-slate-900/50 border border-white/20 rounded-2xl text-white" value={editEventData.date} onChange={e => setEditEventData({...editEventData, date: e.target.value})} />
                  <input placeholder="Kategorie" className="flex-1 p-4 bg-slate-900/50 border border-white/20 rounded-2xl text-white" value={editEventData.category} onChange={e => setEditEventData({...editEventData, category: e.target.value})} />
                </div>
                <div className="flex gap-4"><button onClick={() => { updateDoc(doc(db, ...bP, 'gift_events', selectedEventId), editEventData); setIsEditingEvent(false); }} className="bg-emerald-500 px-6 py-3 rounded-xl font-black flex items-center gap-2"><Save className="w-5 h-5" /> Save</button><button onClick={() => setIsEditingEvent(false)} className="bg-white/10 px-6 py-3 rounded-xl font-black">Abbruch</button></div>
              </div>
            ) : (
              <div onClick={() => { setIsEditingEvent(true); setEditEventData({name: selectedEvent.name, date: selectedEvent.date, category: selectedEvent.category}); }} className="cursor-pointer group">
                <h2 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-4">{selectedEvent.name} <Edit2 className="w-6 h-6 opacity-0 group-hover:opacity-30 transition-all" /></h2>
                <p className="text-indigo-100 text-lg mt-2 font-medium italic opacity-70">{new Date(selectedEvent.date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 md:gap-6 bg-slate-950/30 p-4 md:p-6 rounded-3xl border border-white/10 backdrop-blur-sm mt-10">
              <div className="text-center"><p className="text-[8px] md:text-[10px] uppercase font-black text-indigo-200 tracking-[0.2em] mb-1">Plan-Budget</p><p className="text-sm md:text-2xl font-black">{totals.budget.toFixed(2)}€</p></div>
              <div className="text-center border-x border-white/10"><p className="text-[8px] md:text-[10px] uppercase font-black text-indigo-200 tracking-[0.2em] mb-1">Ist-Ausgaben</p><p className="text-sm md:text-2xl font-black text-emerald-300">{totals.spent.toFixed(2)}€</p></div>
              <div className="text-center"><p className="text-[8px] md:text-[10px] uppercase font-black text-indigo-200 tracking-[0.2em] mb-1">Differenz</p><p className={`text-sm md:text-2xl font-black ${totals.remaining < 0 ? 'text-red-300' : 'text-indigo-100'}`}>{totals.remaining.toFixed(2)}€</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Budgets</h3>
                <button onClick={() => setIsBudgetsCollapsed(!isBudgetsCollapsed)} className="p-2 bg-slate-900 rounded-lg text-slate-500 hover:text-indigo-400 transition-all">{isBudgetsCollapsed ? <ChevronDown /> : <ChevronUp />}</button>
              </div>
              {!isBudgetsCollapsed && sortedGivers.map(giver => {
                const isPart = (eventParticipants[selectedEventId] || []).includes(giver.id);
                const spent = gifts.filter(g => g.eventId === selectedEventId && g.giverId === giver.id).reduce((s, g) => s + (Number(g.price) || 0), 0);
                const bVal = Number(eventBudgets[selectedEventId]?.[giver.id]) || 0;
                return (
                  <div key={giver.id} className={`p-4 rounded-2xl border transition-all ${isPart ? 'bg-slate-900 border-indigo-500/30 shadow-xl' : 'bg-slate-950 border-slate-800 opacity-30'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-lg font-bold text-white">{giver.name}</span>
                      <button onClick={() => {
                        const current = eventParticipants[selectedEventId] || [];
                        const ids = current.includes(giver.id) ? current.filter(i => i !== giver.id) : [...current, giver.id];
                        setDoc(doc(db, ...bP, 'gift_participants', selectedEventId), { ids });
                      }}>{isPart ? <Eye className="w-5 h-5 text-indigo-400" /> : <EyeOff className="w-5 h-5 text-slate-700" />}</button>
                    </div>
                    {isPart && (
                      <div className="flex items-center gap-4 pt-3 border-t border-slate-800/50">
                        <input type="number" value={bVal || ''} placeholder="€" className="w-24 p-2 bg-slate-800 rounded-xl text-xs font-black outline-none border border-slate-700" onChange={e => setDoc(doc(db, ...bP, 'gift_budgets', selectedEventId), {...(eventBudgets[selectedEventId] || {}), [giver.id]: Number(e.target.value)}) } />
                        <div className="flex-1 text-right"><p className={`text-sm font-black ${spent > bVal && bVal > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{spent.toFixed(2)}€</p></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <section className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                <form onSubmit={async (e) => {
                  e.preventDefault(); const fd = new FormData(e.target);
                  await addDoc(collection(db, ...bP, 'gift_items'), { eventId: selectedEventId, name: fd.get('name'), price: Number(fd.get('price')) || 0, giverId: fd.get('giverId') || '', status: 'Idee' });
                  e.target.reset();
                }} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <input name="name" placeholder="Was wird geschenkt?" required className="md:col-span-5 p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
                  <input name="price" type="number" step="0.01" placeholder="Preis €" required className="md:col-span-2 p-4 bg-slate-800 border border-slate-700 rounded-2xl font-mono outline-none" />
                  <select name="giverId" className="md:col-span-3 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs">
                    <option value="">Offen</option>
                    {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button type="submit" className="md:col-span-2 bg-emerald-600 p-4 rounded-2xl font-black flex items-center justify-center"><Plus /></button>
                </form>
              </section>

              <div className="space-y-3">
                {eventGifts.map(gift => (
                  <div key={gift.id} className="bg-slate-900 p-5 rounded-[1.5rem] border border-slate-800 flex flex-col gap-4 shadow-sm group">
                    {editingGiftId === gift.id ? (
                      <div className="flex flex-col gap-4">
                        <input className="p-4 bg-slate-800 rounded-2xl border border-indigo-500/50 outline-none" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                        <div className="grid grid-cols-3 gap-3">
                          <input type="number" step="0.01" className="p-4 bg-slate-800 rounded-2xl font-mono" value={editFormData.price} onChange={e => setEditFormData({...editFormData, price: e.target.value})} />
                          <select className="p-4 bg-slate-800 rounded-2xl text-xs" value={editFormData.giverId} onChange={e => setEditFormData({...editFormData, giverId: e.target.value})}><option value="">Offen</option>{activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                          <select className="p-4 bg-slate-800 rounded-2xl text-xs" value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})}><option value="Idee">💡 Idee</option><option value="Gekauft">🛒 Gekauft</option><option value="Verpackt">🎁 Verpackt</option></select>
                        </div>
                        <div className="flex justify-end gap-3"><button onClick={() => { updateDoc(doc(db, ...bP, 'gift_items', gift.id), { name: editFormData.name, price: Number(editFormData.price) || 0, giverId: editFormData.giverId, status: editFormData.status }); setEditingGiftId(null); }} className="text-emerald-400 bg-emerald-400/10 px-6 py-2 rounded-xl font-black">Save</button><button onClick={() => setEditingGiftId(null)} className="text-slate-500">X</button></div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div className="flex-1 truncate">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border flex items-center gap-1 ${gift.status === 'Verpackt' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : gift.status === 'Gekauft' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-slate-400 bg-slate-400/10 border-slate-400/20'}`}>
                              {gift.status === 'Verpackt' ? <CheckCircle2 className="w-3 h-3" /> : gift.status === 'Gekauft' ? <ShoppingCart className="w-3 h-3" /> : <Package className="w-3 h-3" />} {gift.status}
                            </span>
                          </div>
                          <p className="text-lg font-black">{gift.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black mt-1 tracking-tighter">{givers.find(g => g.id === gift.giverId)?.name || "Zuweisung offen"}</p>
                        </div>
                        <div className="text-right flex items-center gap-6 ml-4">
                          <p className="text-xl font-black text-indigo-400 font-mono tracking-tighter">{Number(gift.price).toFixed(2)}€</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { setEditingGiftId(gift.id); setEditFormData({ name: gift.name, price: gift.price, giverId: gift.giverId || '', status: gift.status || 'Idee' }); }} className="p-2 text-slate-600 hover:text-indigo-400"><Edit2 className="w-5 h-5" /></button><button onClick={() => deleteDoc(doc(db, ...bP, 'gift_items', gift.id))} className="p-2 text-slate-600 hover:text-red-500"><Trash2 className="w-5 h-5" /></button></div>
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
    </div>
  );
};

// --- MODUL: URLAUB ---
const TravelModule = ({ user, onBack }) => {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [view, setView] = useState('list');
  const [activeDest, setActiveDest] = useState(null);
  const [filters, setFilters] = useState({ weather: 'Egal', bookedOnly: false, hideDone: true });

  const bP = ['artifacts', HUB_ID, 'users', user.uid];

  useEffect(() => {
    return onSnapshot(collection(db, ...bP, 'travel_trips'), s => setTrips(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    if (!selectedTripId) return;
    return onSnapshot(query(collection(db, ...bP, 'travel_destinations'), where('tripId', '==', selectedTripId)), s => 
      setDestinations(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [selectedTripId]);

  const filtered = useMemo(() => {
    return destinations.filter(z => {
      const wMatch = filters.weather === 'Egal' || (filters.weather === 'Sonne' && z.wetter !== 'Regen') || (filters.weather === 'Regen' && z.wetter !== 'Sonne');
      return wMatch && (!filters.bookedOnly || z.istGebucht) && (!filters.hideDone || !z.istErledigt);
    }).sort((a, b) => Number(a.fahrtzeit) - Number(b.fahrtzeit));
  }, [destinations, filters]);

  const selTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 animate-in fade-in duration-500">
      <header className="mb-10 flex justify-between items-center border-b border-slate-800 pb-6">
        <button onClick={selectedTripId ? () => setSelectedTripId(null) : onBack} className="flex items-center text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest">
          <ArrowLeft className="w-5 h-5 mr-2" /> {selectedTripId ? 'Zurück' : 'Portal'}
        </button>
        <h1 className="text-2xl font-black text-emerald-500 flex items-center gap-2"><Palmtree className="w-6 h-6" /> Urlaubsplaner</h1>
      </header>

      {!selectedTripId ? (
        <div className="space-y-8">
          <section className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl">
            <h2 className="text-2xl font-black mb-6 flex items-center text-emerald-400"><Plus className="w-7 h-7 mr-3" /> Neue Reise</h2>
            <form onSubmit={async (e) => {
              e.preventDefault(); const t = new FormData(e.target).get('t');
              await addDoc(collection(db, ...bP, 'travel_trips'), { titel: t, createdAt: new Date().toISOString() });
              e.target.reset();
            }} className="flex gap-4">
              <input name="t" placeholder="Reiseziel..." required className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
              <button type="submit" className="bg-emerald-600 px-8 rounded-2xl font-black"><Plus /></button>
            </form>
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map(t => (
              <div key={t.id} onClick={() => setSelectedTripId(t.id)} className="bg-slate-900 p-6 rounded-[1.5rem] border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex justify-between items-center group shadow-md transition-all">
                <h3 className="text-xl font-black group-hover:text-emerald-400 transition-colors truncate">{t.titel}</h3>
                <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-emerald-700 p-10 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">{selTrip.titel}</h2>
            <div className="flex bg-slate-950/30 p-1.5 rounded-2xl backdrop-blur-md">
              <button onClick={() => setFilters({...filters, weather: 'Sonne'})} className={`p-4 rounded-xl transition-all ${filters.weather === 'Sonne' ? 'bg-amber-400 text-slate-950' : 'text-emerald-200 hover:bg-white/5'}`}><Sun /></button>
              <button onClick={() => setFilters({...filters, weather: 'Regen'})} className={`p-4 rounded-xl transition-all ${filters.weather === 'Regen' ? 'bg-blue-500 text-white' : 'text-emerald-200 hover:bg-white/5'}`}><CloudRain /></button>
              <button onClick={() => setFilters({...filters, weather: 'Egal'})} className={`p-4 rounded-xl transition-all ${filters.weather === 'Egal' ? 'bg-white text-slate-950' : 'text-emerald-200 hover:bg-white/5'}`}><Infinity /></button>
            </div>
          </div>

          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <div className="flex gap-4">
                  <button onClick={() => setFilters({...filters, bookedOnly: !filters.bookedOnly})} className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border transition-all ${filters.bookedOnly ? 'bg-blue-600 border-blue-500' : 'border-slate-800 text-slate-600'}`}>Gebucht</button>
                  <button onClick={() => setFilters({...filters, hideDone: !filters.hideDone})} className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border transition-all ${!filters.hideDone ? 'bg-emerald-600 border-emerald-500' : 'border-slate-800 text-slate-600'}`}>Besuchte zeigen</button>
                </div>
                <button onClick={() => { setActiveDest(null); setView('edit'); }} className="bg-emerald-600 p-4 rounded-2xl hover:bg-emerald-500 shadow-xl transition-all shadow-emerald-950/30"><Plus className="w-7 h-7" /></button>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="hidden md:flex bg-slate-800/30 p-5 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-slate-800">
                  <div className="flex-[3]">Ziel & Aktivität</div>
                  <div className="flex-1 text-center">Min</div>
                  <div className="flex-1 text-center">Dauer</div>
                  <div className="flex-1 text-center">Fokus</div>
                  <div className="flex-1 text-center">€</div>
                  <div className="flex-1 text-right pr-4">Stat</div>
                </div>
                <div className="divide-y divide-slate-800">
                  {filtered.map(z => (
                    <div key={z.id} onClick={() => { setActiveDest(z); setView('detail'); }} className="flex flex-col md:flex-row p-5 md:items-center hover:bg-slate-800/30 cursor-pointer transition-all group">
                      <div className="flex-[3] font-black text-xl md:text-lg group-hover:text-emerald-400 mb-2 md:mb-0 transition-colors">{z.name}</div>
                      <div className="grid grid-cols-4 md:contents gap-2 text-xs md:text-sm font-bold text-slate-400">
                        <div className="md:flex-1 text-left md:text-center md:text-white">{z.fahrtzeit}m</div>
                        <div className="md:flex-1 text-left md:text-center md:text-white">{z.dauer}</div>
                        <div className="md:flex-1 text-left md:text-center md:text-white">{z.zielgruppe}</div>
                        <div className="md:flex-1 text-left md:text-center md:text-white">{z.kosten}€</div>
                        <div className="md:flex-1 flex justify-end gap-2 pr-2">
                          {z.istGebucht && <Clock className="w-5 h-5 text-blue-400" />}
                          {z.istErledigt && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <div className="p-20 text-center opacity-20 italic">Keine Ziele passend zum Filter gefunden.</div>}
                </div>
              </div>
            </div>
          )}

          {view === 'detail' && activeDest && (
            <div className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] border border-slate-800 shadow-2xl space-y-10 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start border-b border-slate-800 pb-8">
                <div><h2 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter">{activeDest.name}</h2><p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">Fokus: {activeDest.zielgruppe} | Dauer: {activeDest.dauer} | Kosten: {activeDest.kosten}€</p></div>
                <div className="flex gap-3"><button onClick={() => setView('edit')} className="p-4 bg-slate-800 rounded-2xl hover:text-emerald-400 transition-all shadow-md"><Edit2 /></button><button onClick={async () => { if(window.confirm("Löschen?")) { await deleteDoc(doc(db, ...bP, 'travel_destinations', activeDest.id)); setView('list'); } }} className="p-4 bg-slate-800 rounded-2xl hover:text-red-500 transition-all shadow-md"><Trash2 /></button></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button onClick={() => window.open(`http://maps.google.com/maps?q=${encodeURIComponent(activeDest.adresse)}`)} className="flex items-center justify-center gap-4 p-8 bg-emerald-600/10 border border-emerald-500/20 rounded-[2.5rem] font-black text-emerald-400 hover:bg-emerald-600/20 transition-all text-lg shadow-xl"><Navigation className="w-8 h-8" /> Navigieren</button>
                <button onClick={() => window.open(activeDest.link.startsWith('http') ? activeDest.link : `https://${activeDest.link}`)} className="flex items-center justify-center gap-4 p-8 bg-slate-800 border border-slate-700 rounded-[2.5rem] font-black hover:bg-slate-700 transition-all text-lg shadow-xl"><Globe className="w-8 h-8" /> Website</button>
              </div>
              <div className="space-y-4 pt-6"><h4 className="text-xs font-black uppercase text-slate-600 tracking-widest">Notizen & Details</h4><div className="bg-slate-950/50 p-6 rounded-3xl text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">{activeDest.notizen || "Keine weiteren Details hinterlegt."}</div></div>
              <button onClick={() => setView('list')} className="w-full p-5 bg-slate-800 rounded-2xl font-black shadow-lg">Zurück zur Liste</button>
            </div>
          )}

          {view === 'edit' && (
            <div className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] border border-slate-800 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
              <h2 className="text-3xl font-black mb-10 tracking-tight">Details bearbeiten</h2>
              <form onSubmit={async (e) => {
                e.preventDefault(); const fd = new FormData(e.target);
                const d = { tripId: selectedTripId, name: fd.get('name'), fahrtzeit: Number(fd.get('zeit')), kosten: Number(fd.get('kosten')), adresse: fd.get('adresse'), link: fd.get('link'), notizen: fd.get('notizen'), wetter: fd.get('wetter'), dauer: fd.get('dauer'), zielgruppe: fd.get('zielgruppe'), istGebucht: fd.get('gebucht') === 'on', istErledigt: fd.get('erledigt') === 'on' };
                if (activeDest) await updateDoc(doc(db, ...bP, 'travel_destinations', activeDest.id), d);
                else await addDoc(collection(db, ...bP, 'travel_destinations'), d);
                setView('list');
              }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Name</label><input name="name" defaultValue={activeDest?.name} required className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none shadow-inner" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Fahrtzeit (Min)</label><input name="zeit" type="number" defaultValue={activeDest?.fahrtzeit} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Kosten (€)</label><input name="kosten" type="number" defaultValue={activeDest?.kosten} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none" /></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Wetter</label><select name="wetter" defaultValue={activeDest?.wetter || 'Egal'} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none"><option value="Egal">Egal</option><option value="Sonne">Sonne</option><option value="Regen">Regen</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Dauer</label><select name="dauer" defaultValue={activeDest?.dauer || 'Halbtag'} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none"><option value="Kurz">Kurz</option><option value="Halbtag">Halbtag</option><option value="Tag">Ganztag</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Fokus</label><select name="zielgruppe" defaultValue={activeDest?.zielgruppe || 'Alle'} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none"><option value="Alle">Alle</option><option value="Kinder">Kinder</option><option value="Teens">Teens</option></select></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Adresse</label><input name="adresse" defaultValue={activeDest?.adresse} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Webseite</label><input name="link" defaultValue={activeDest?.link} className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-500 ml-2">Notizen</label><textarea name="notizen" defaultValue={activeDest?.notizen} className="w-full p-6 bg-slate-800 border border-slate-700 rounded-[2rem] outline-none h-40" /></div>
                <div className="flex gap-6 p-4 bg-slate-950/30 rounded-3xl">
                  <label className="flex-1 flex items-center justify-center gap-4 cursor-pointer p-4 hover:bg-white/5 rounded-2xl transition-all"><input name="gebucht" type="checkbox" defaultChecked={activeDest?.istGebucht} className="w-6 h-6 accent-blue-500" /><span className="font-black text-sm uppercase">Gebucht</span></label>
                  <label className="flex-1 flex items-center justify-center gap-4 cursor-pointer p-4 hover:bg-white/5 rounded-2xl transition-all"><input name="erledigt" type="checkbox" defaultChecked={activeDest?.istErledigt} className="w-6 h-6 accent-emerald-500" /><span className="font-black text-sm uppercase">Besucht</span></label>
                </div>
                <div className="flex gap-6 pt-6">
                  <button type="button" onClick={() => setView('list')} className="flex-1 p-6 bg-slate-800 rounded-3xl font-black hover:bg-slate-700 transition-all">Abbruch</button>
                  <button type="submit" className="flex-[2] p-6 bg-emerald-600 rounded-3xl font-black hover:bg-emerald-500 shadow-xl shadow-emerald-950/40 transition-all">Speichern</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- AUTH COMPONENTS ---
const LoginScreen = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="max-w-md w-full bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-700">
        <div className="text-center mb-10"><h1 className="text-4xl font-black text-white">Personal <span className="text-indigo-500">Hub</span></h1><p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Management & Planung</p></div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, pass); }} className="space-y-6">
          <input type="email" placeholder="E-Mail" className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Passwort" className="w-full p-5 bg-slate-800 border border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500" value={pass} onChange={e => setPass(e.target.value)} required />
          <button className="w-full bg-indigo-600 py-5 rounded-3xl font-black text-lg hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 mt-4">Anmelden</button>
        </form>
        {error && <p className="text-red-400 text-center mt-6 text-xs font-black uppercase tracking-widest">{error}</p>}
      </div>
    </div>
  );
};

export default App;