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
  Users, 
  Gift, 
  Calendar, 
  ArrowLeft,
  Loader2,
  UserPlus,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';

// --- Firebase Konfiguration (Sicher via Umgebungsvariablen) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Singleton Pattern für die Firebase App
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
          setAuthError("Fehler bei der Anmeldung. Prüfen Sie die Firebase-Konfiguration.");
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

  // --- Logik & Berechnungen ---
  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);
  
  // FIX: Fehlende Variable eventGifts definiert
  const eventGifts = useMemo(() => gifts.filter(g => g.eventId === selectedEventId), [gifts, selectedEventId]);

  const activeGiversForEvent = useMemo(() => {
    const participantIds = eventParticipants[selectedEventId] || [];
    return givers.filter(g => participantIds.includes(g.id));
  }, [givers, eventParticipants, selectedEventId]);

  const getGiverSpending = (eventId, giverId) => {
    return gifts.filter(g => g.eventId === eventId && g.giverId === giverId)
                .reduce((sum, g) => sum + Number(g.price), 0);
  };

  // --- Handler ---
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

  // --- UI Renders (Ausschnitt) ---
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (authError) return <div className="p-10 text-center text-red-500"><AlertTriangle className="mx-auto" /> {authError}</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold">GiftPlanner Pro</h1>
            <p className="text-slate-500 text-sm">Controlling & Budget</p>
          </div>
        </header>

        <nav className="flex space-x-4 mb-8 bg-white p-2 rounded-xl shadow-sm">
          <button onClick={() => setView('events')} className={`flex-1 py-2 rounded-lg ${view !== 'givers' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>Anlässe</button>
          <button onClick={() => setView('givers')} className={`flex-1 py-2 rounded-lg ${view === 'givers' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>Personen</button>
        </nav>

        {view === 'events' && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-indigo-600"><Plus className="w-5 h-5 mr-2" /> Neuer Anlass</h2>
              <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input name="name" placeholder="Name" required className="p-2 border rounded-lg" />
                <input name="date" type="date" required className="p-2 border rounded-lg" />
                <input name="category" placeholder="Kategorie" className="p-2 border rounded-lg" />
                <button type="submit" className="md:col-span-3 bg-indigo-600 text-white py-2 rounded-lg">Anlegen</button>
              </form>
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(event => (
                <div key={event.id} onClick={() => { setSelectedEventId(event.id); setView('detail'); }} className="bg-white p-5 rounded-2xl shadow-sm cursor-pointer hover:border-indigo-300 border flex justify-between items-center group">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">{event.category}</span>
                    <h3 className="text-xl font-bold">{event.name}</h3>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:text-indigo-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'detail' && selectedEvent && (
          <div className="space-y-6">
            <button onClick={() => setView('events')} className="flex items-center text-slate-500 hover:text-indigo-600"><ArrowLeft className="w-4 h-4 mr-2" /> Zurück</button>
            <div className="bg-indigo-600 text-white p-6 rounded-2xl">
              <h2 className="text-3xl font-bold">{selectedEvent.name}</h2>
              <p>{new Date(selectedEvent.date).toLocaleDateString('de-DE')}</p>
            </div>

            <section className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 text-indigo-600">Teilnehmer & Budgets</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {givers.map(giver => {
                  const isPart = (eventParticipants[selectedEventId] || []).includes(giver.id);
                  const spent = getGiverSpending(selectedEventId, giver.id);
                  const budget = eventBudgets[selectedEventId]?.[giver.id] || 0;
                  return (
                    <div key={giver.id} className={`p-4 rounded-xl border ${isPart ? 'bg-slate-50' : 'opacity-60'}`}>
                      <div className="flex justify-between font-bold">
                        <span>{giver.name}</span>
                        <button onClick={() => {
                          const current = eventParticipants[selectedEventId] || [];
                          const ids = current.includes(giver.id) ? current.filter(i => i !== giver.id) : [...current, giver.id];
                          setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'participants', selectedEventId), { ids });
                        }}>{isPart ? <Eye /> : <EyeOff />}</button>
                      </div>
                      {isPart && (
                        <div className="mt-2 flex gap-2">
                          <input type="number" value={budget || ''} className="w-full p-1 border rounded" 
                                 onChange={(e) => setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'budgets', selectedEventId), {...(eventBudgets[selectedEventId] || {}), [giver.id]: Number(e.target.value)})} />
                          <span className="text-xs font-bold pt-2">Ist: {spent.toFixed(2)}€</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 text-indigo-600">Geschenk hinzufügen</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts'), {
                  eventId: selectedEventId, name: fd.get('name'), price: Number(fd.get('price')), giverId: fd.get('giverId')
                });
                e.target.reset();
              }} className="grid grid-cols-1 gap-4">
                <input name="name" placeholder="Was?" required className="p-2 border rounded" />
                <input name="price" type="number" step="0.01" placeholder="Preis €" required className="p-2 border rounded" />
                <select name="giverId" required className="p-2 border rounded">
                  <option value="">Wer?</option>
                  {activeGiversForEvent.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button type="submit" disabled={activeGiversForEvent.length === 0} className="bg-indigo-600 text-white py-2 rounded">Hinzufügen</button>
              </form>
            </section>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr><th className="p-4 text-left">Geschenk</th><th className="p-4 text-right">Preis</th><th className="p-4">Zugeordnet</th><th className="p-4"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {eventGifts.map(gift => (
                    <tr key={gift.id}>
                      <td className="p-4 font-semibold">{gift.name}</td>
                      <td className="p-4 text-right">{Number(gift.price).toFixed(2)}€</td>
                      <td className="p-4">{givers.find(g => g.id === gift.giverId)?.name}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gifts', gift.id))} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'givers' && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 text-indigo-600">Personen verwalten</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = new FormData(e.target).get('name');
                await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'givers'), { name });
                e.target.reset();
              }} className="flex gap-4">
                <input name="name" required className="flex-1 p-2 border rounded" />
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">Hinzufügen</button>
              </form>
            </section>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {givers.map(giver => (
                <div key={giver.id} className="bg-white p-4 rounded-xl border flex justify-between items-center">
                  <span className="font-bold">{giver.name}</span>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'givers', giver.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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