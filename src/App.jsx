import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
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
  Calendar // <--- Dieses Icon hat gefehlt
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
  const [view, setView] = useState('events'); 
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [givers, setGivers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [eventBudgets, setEventBudgets] = useState({});
  const [eventParticipants, setEventParticipants] = useState({});

  // --- Authentifizierung ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Auth Error:", err);
          setAuthError("Fehler bei der Anmeldung.");
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Echtzeit-Daten ---
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

  // --- Logik ---
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><Loader2 className="animate-spin w-12 h-12" /></div>;
  if (authError) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-red-400 p-6"><AlertTriangle className="w-12 h-12 mb-4" /> {authError}</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 border-b border-slate-800 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">GiftPlanner <span className="text-indigo-500">Pro</span></h1>
          <p className="text-slate-400 font-medium">Controlling & Budget-Management</p>
        </header>

        <nav className="flex space-x-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <button 
            onClick={() => setView('events')} 
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${view !== 'givers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Anlässe
          </button>
          <button 
            onClick={() => setView('givers')} 
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'givers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Personen-Stamm
          </button>
        </nav>

        {view === 'events' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center text-indigo-400"><Plus className="w-6 h-6 mr-2" /> Neuer Anlass</h2>
              <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Bezeichnung</label>
                  <input name="name" placeholder="z.B. Geburtstag Max" required className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Datum</label>
                  <input name="date" type="date" required className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Kategorie</label>
                  <input name="category" placeholder="z.B. Familie" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <button type="submit" className="md:col-span-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-indigo-900/30">Anlass anlegen</button>
              </form>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(event => (
                <div key={event.id} onClick={() => { setSelectedEventId(event.id); setView('detail'); }} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm hover:border-indigo-500/50 cursor-pointer group transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{event.category}</span>
                      <h3 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors">{event.name}</h3>
                      <p className="text-slate-500 text-sm mt-1">{new Date(event.date).toLocaleDateString('de-DE')}</p>
                    </div>
                    <ChevronRight className="text-slate-700 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'detail' && selectedEvent && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setView('events')} className="flex items-center text-slate-400 hover:text-white font-bold transition-colors"><ArrowLeft className="w-5 h-5 mr-2" /> Zurück zur Übersicht</button>
            
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-8 rounded-3xl shadow-2xl shadow-indigo-900/20">
              <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">{selectedEvent.category}</span>
              <h2 className="text-4xl font-black mt-1">{selectedEvent.name}</h2>
              <div className="flex items-center mt-4 text-indigo-100 font-medium">
                <Calendar className="w-5 h-5 mr-2" />
                {new Date(selectedEvent.date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold mb-6 text-indigo-400">Budget-Teilnehmer</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {givers.map(giver => {
                  const isPart = (eventParticipants[selectedEventId] || []).includes(giver.id);
                  const spent = getGiverSpending(selectedEventId, giver.id);
                  const budget = eventBudgets[selectedEventId]?.[giver.id] || 0;
                  return (
                    <div key={giver.id} className={`p-5 rounded-2xl border transition-all duration-300 ${isPart ? 'bg-slate-800/50 border-indigo-500/30' : 'bg-slate-900 border-slate-800 opacity-40'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-bold text-white">{giver.name}</span>
                        <button 
                          className={`p-2 rounded-lg transition-colors ${isPart ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-600'}`}
                          onClick={() => {
                            const current = eventParticipants[selectedEventId] || [];
                            const ids = current.includes(giver.id) ? current.filter(i => i !== giver.id) : [...current, giver.id];
                            setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participants', selectedEventId), { ids });
                          }}
                        >
                          {isPart ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                      </div>
                      {isPart && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Geplantes Budget</label>
                            <input 
                              type="number" 
                              value={budget || ''} 
                              placeholder="0.00 €"
                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                              onChange={(e) => setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'budgets', selectedEventId), {...(eventBudgets[selectedEventId] || {}), [giver.id]: Number(e.target.value)})} 
                            />
                          </div>
                          <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-xs font-bold text-slate-500 uppercase">Ist-Ausgaben:</span>
                            <span className={`text-sm font-black ${spent > budget && budget > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{spent.toFixed(2)} €</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold mb-6 text-indigo-400">Neues Geschenk erfassen</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts'), {
                  eventId: selectedEventId, name: fd.get('name'), price: Number(fd.get('price')), giverId: fd.get('giverId')
                });
                e.target.reset();
              }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <input name="name" placeholder="Bezeichnung" required className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                <input name="price" type="number" step="0.01" placeholder="Preis in €" required className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                <select name="giverId" required className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="" className="bg-slate-900">Käufer wählen...</option>
                  {activeGiversForEvent.map(g => <option key={g.id} value={g.id} className="bg-slate-900">{g.name}</option>)}
                </select>
                <button type="submit" disabled={activeGiversForEvent.length === 0} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl disabled:opacity-20 transition-all shadow-lg shadow-emerald-900/20">Speichern</button>
              </form>
            </section>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Geschenk</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Preis</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Zugeordnet</th>
                    <th className="p-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {eventGifts.map(gift => (
                    <tr key={gift.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-5 font-bold text-white">{gift.name}</td>
                      <td className="p-5 text-right font-mono font-bold text-indigo-400">{Number(gift.price).toFixed(2)} €</td>
                      <td className="p-5 text-slate-400 font-medium">{givers.find(g => g.id === gift.giverId)?.name}</td>
                      <td className="p-5 text-right">
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id))} className="text-slate-600 hover:text-red-400 transition-colors p-2"><Trash2 className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                  {eventGifts.length === 0 && (
                    <tr><td colSpan="4" className="p-10 text-center text-slate-600 font-medium italic">Noch keine Geschenke eingetragen.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'givers' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <section className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold mb-6 text-indigo-400">Stammdaten: Personen</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = new FormData(e.target).get('name');
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'givers'), { name });
                e.target.reset();
              }} className="flex flex-col sm:flex-row gap-4">
                <input name="name" placeholder="Vollständiger Name" required className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-indigo-900/30">Hinzufügen</button>
              </form>
            </section>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {givers.map(giver => (
                <div key={giver.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-slate-700 transition-all">
                  <span className="font-bold text-lg text-white">{giver.name}</span>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'givers', giver.id))} className="text-slate-700 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
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