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

// --- CONFIG & INIT ---
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
const APP_ID = "personal-hub-v1";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(null); // 'gifts' | 'travel'
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><Loader2 className="animate-spin w-16 h-16" /></div>;

  if (!user) return <LoginScreen onLogin={(e, p) => signInWithEmailAndPassword(auth, e, p).catch(() => setAuthError("Fehler"))} error={authError} />;

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

// --- PORTAL DASHBOARD ---
const PortalDashboard = ({ onSelect }) => (
  <div className="max-w-4xl mx-auto pt-20 p-6 animate-in fade-in duration-700">
    <h1 className="text-4xl font-black text-center mb-12">Jan's <span className="text-indigo-500">Personal Hub</span></h1>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <button onClick={() => onSelect('gifts')} className="group p-10 bg-slate-900 border border-slate-800 rounded-[2.5rem] hover:border-indigo-500 transition-all text-left shadow-2xl">
        <Gift className="w-12 h-12 text-indigo-500 mb-6 group-hover:scale-110 transition-transform" />
        <h2 className="text-2xl font-black mb-2">Geschenk-Controlling</h2>
        <p className="text-slate-500 text-sm leading-relaxed">Budgets, Ideen und Status-Tracking für alle Anlässe.</p>
      </button>
      <button onClick={() => onSelect('travel')} className="group p-10 bg-slate-900 border border-slate-800 rounded-[2.5rem] hover:border-emerald-500 transition-all text-left shadow-2xl">
        <Palmtree className="w-12 h-12 text-emerald-500 mb-6 group-hover:scale-110 transition-transform" />
        <h2 className="text-2xl font-black mb-2">Urlaubsplanung</h2>
        <p className="text-slate-500 text-sm leading-relaxed">Modulare Reiseziele, Wetter-Filter und Navigations-Links.</p>
      </button>
    </div>
    <div className="mt-20 text-center opacity-20"><Settings2 className="w-8 h-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">System Version 2.0</p></div>
  </div>
);

// --- TRAVEL MODULE ---
const TravelModule = ({ user, onBack }) => {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'edit'
  const [activeDest, setActiveDest] = useState(null);
  const [filters, setFilters] = useState({ weather: 'Egal', bookedOnly: false, hideDone: true });

  const bP = ['artifacts', APP_ID, 'users', user.uid];

  useEffect(() => {
    return onSnapshot(collection(db, ...bP, 'travel_trips'), (s) => 
      setTrips(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  useEffect(() => {
    if (!selectedTripId) return;
    const q = query(collection(db, ...bP, 'travel_destinations'), where('tripId', '==', selectedTripId));
    return onSnapshot(q, (s) => setDestinations(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [selectedTripId]);

  const filteredZiele = useMemo(() => {
    return destinations.filter(z => {
      const weatherMatch = filters.weather === 'Egal' || 
        (filters.weather === 'Sonne' && z.wetter !== 'Regen') || 
        (filters.weather === 'Regen' && z.wetter !== 'Sonne');
      const bookedMatch = !filters.bookedOnly || z.istGebucht;
      const doneMatch = !filters.hideDone || !z.istErledigt;
      return weatherMatch && bookedMatch && doneMatch;
    }).sort((a, b) => (a.fahrtzeit || 0) - (b.fahrtzeit || 0));
  }, [destinations, filters]);

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 animate-in fade-in">
      <header className="mb-8 flex justify-between items-center border-b border-slate-800 pb-6">
        <button onClick={selectedTripId ? () => setSelectedTripId(null) : onBack} className="flex items-center text-slate-400 hover:text-white font-black text-xs">
          <ArrowLeft className="w-5 h-5 mr-2" /> {selectedTripId ? 'Zurück zu Reisen' : 'Zum Portal'}
        </button>
        <h1 className="text-2xl font-black text-emerald-500 flex items-center gap-2"><Palmtree /> Urlaubsplaner</h1>
      </header>

      {!selectedTripId ? (
        <div className="space-y-8">
          <section className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl">
            <h2 className="text-xl font-black mb-6">Neues Abenteuer</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              await addDoc(collection(db, ...bP, 'travel_trips'), { titel: fd.get('titel'), date: fd.get('date'), archived: false });
              e.target.reset();
            }} className="flex gap-4">
              <input name="titel" placeholder="Wohin geht's?" required className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="submit" className="bg-emerald-600 px-8 rounded-2xl font-black hover:bg-emerald-500 transition-all"><Plus /></button>
            </form>
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map(t => (
              <div key={t.id} onClick={() => setSelectedTripId(t.id)} className="bg-slate-900 p-6 rounded-[1.5rem] border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex justify-between items-center group transition-all shadow-md">
                <div className="truncate">
                  <h3 className="text-xl font-black text-white group-hover:text-emerald-400 truncate">{t.titel}</h3>
                  <div className="text-slate-500 text-xs mt-2"><Calendar className="w-4 h-4 inline mr-1" /> Planung läuft...</div>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-emerald-700 p-8 rounded-[2.5rem] shadow-2xl flex justify-between items-center">
            <h2 className="text-3xl font-black">{selectedTrip.titel}</h2>
            <div className="flex gap-2">
              <button onClick={() => setFilters({...filters, weather: 'Sonne'})} className={`p-3 rounded-xl transition-all ${filters.weather === 'Sonne' ? 'bg-amber-400 text-slate-900' : 'bg-emerald-800 text-emerald-200'}`}><Sun /></button>
              <button onClick={() => setFilters({...filters, weather: 'Regen'})} className={`p-3 rounded-xl transition-all ${filters.weather === 'Regen' ? 'bg-blue-500 text-white' : 'bg-emerald-800 text-emerald-200'}`}><CloudRain /></button>
              <button onClick={() => setFilters({...filters, weather: 'Egal'})} className={`p-3 rounded-xl transition-all ${filters.weather === 'Egal' ? 'bg-slate-100 text-slate-900' : 'bg-emerald-800 text-emerald-200'}`}><Infinity /></button>
            </div>
          </div>

          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <div className="flex gap-4">
                  <button onClick={() => setFilters({...filters, bookedOnly: !filters.bookedOnly})} className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${filters.bookedOnly ? 'bg-blue-500 border-blue-400' : 'border-slate-700 text-slate-500'}`}>Nur Gebuchte</button>
                  <button onClick={() => setFilters({...filters, hideDone: !filters.hideDone})} className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${!filters.hideDone ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700 text-slate-500'}`}>Besuchte zeigen</button>
                </div>
                <button onClick={() => { setActiveDest(null); setView('edit'); }} className="bg-emerald-600 p-3 rounded-xl hover:bg-emerald-500"><Plus /></button>
              </div>

              <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="hidden md:flex bg-slate-800/50 p-4 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                  <div className="flex-[3]">Ziel</div>
                  <div className="flex-1 text-center">Min</div>
                  <div className="flex-1 text-center">Dauer</div>
                  <div className="flex-1 text-center">Fokus</div>
                  <div className="flex-1 text-center">€</div>
                  <div className="flex-1 text-right pr-4">Stat</div>
                </div>
                <div className="divide-y divide-slate-800">
                  {filteredZiele.map(z => (
                    <div key={z.id} onClick={() => { setActiveDest(z); setView('detail'); }} className="flex flex-col md:flex-row p-4 md:items-center hover:bg-slate-800/30 cursor-pointer transition-all group">
                      <div className="flex-[3] font-black text-lg md:text-base group-hover:text-emerald-400 transition-colors">{z.name}</div>
                      <div className="flex items-center gap-4 md:contents">
                        <div className="flex-1 text-slate-400 text-xs md:text-center font-mono md:text-white"><Timer className="w-3 h-3 md:hidden inline mr-1" />{z.fahrtzeit}m</div>
                        <div className="flex-1 text-slate-400 text-xs md:text-center md:text-white"><Users className="w-3 h-3 md:hidden inline mr-1" />{z.dauer}</div>
                        <div className="flex-1 text-slate-400 text-xs md:text-center md:text-white">{z.zielgruppe}</div>
                        <div className="flex-1 text-slate-400 text-xs md:text-center md:text-white"><Euro className="w-3 h-3 md:hidden inline mr-1" />{z.kosten}</div>
                        <div className="flex-1 flex justify-end gap-2 pr-2">
                          {z.istGebucht && <Clock className="w-4 h-4 text-blue-400" />}
                          {z.istErledigt && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'detail' && activeDest && (
            <div className="bg-slate-900 p-8 md:p-12 rounded-[3rem] border border-slate-800 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-4xl font-black mb-2">{activeDest.name}</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Fokus: {activeDest.zielgruppe} | Dauer: {activeDest.dauer} | Kosten: {activeDest.kosten}€</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setView('edit')} className="p-3 bg-slate-800 rounded-2xl hover:text-indigo-400 transition-all"><Edit2 /></button>
                  <button onClick={async () => { if(window.confirm("Löschen?")) { await deleteDoc(doc(db, ...bP, 'travel_destinations', activeDest.id)); setView('list'); } }} className="p-3 bg-slate-800 rounded-2xl hover:text-red-500 transition-all"><Trash2 /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeDest.adresse)}`)} className="flex items-center justify-center gap-3 p-6 bg-emerald-600/10 border border-emerald-500/20 rounded-[2rem] font-black text-emerald-400 hover:bg-emerald-600/20 transition-all">
                  <Navigation className="w-6 h-6" /> Navigieren
                </button>
                <button onClick={() => window.open(activeDest.link.startsWith('http') ? activeDest.link : `https://${activeDest.link}`)} className="flex items-center justify-center gap-3 p-6 bg-slate-800 border border-slate-700 rounded-[2rem] font-black hover:bg-slate-700 transition-all">
                  <Globe className="w-6 h-6" /> Website besuchen
                </button>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-black uppercase text-slate-500">Notizen & Details</h4>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{activeDest.notizen || "Keine weiteren Details hinterlegt."}</p>
              </div>
              <button onClick={() => setView('list')} className="w-full p-4 bg-slate-800 rounded-2xl font-black">Zurück zur Liste</button>
            </div>
          )}

          {view === 'edit' && (
            <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-black mb-8">Aktivität anpassen</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const data = {
                  tripId: selectedTripId,
                  name: fd.get('name'),
                  fahrtzeit: Number(fd.get('zeit')),
                  kosten: Number(fd.get('kosten')),
                  adresse: fd.get('adresse'),
                  link: fd.get('link'),
                  notizen: fd.get('notizen'),
                  wetter: fd.get('wetter'),
                  dauer: fd.get('dauer'),
                  zielgruppe: fd.get('zielgruppe'),
                  istGebucht: fd.get('gebucht') === 'on',
                  istErledigt: fd.get('erledigt') === 'on'
                };
                if (activeDest) await updateDoc(doc(db, ...bP, 'travel_destinations', activeDest.id), data);
                else await addDoc(collection(db, ...bP, 'travel_destinations'), data);
                setView('list');
              }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input name="name" defaultValue={activeDest?.name} placeholder="Name der Aktivität" required className="p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
                  <input name="zeit" type="number" defaultValue={activeDest?.fahrtzeit} placeholder="Fahrtzeit (Min)" className="p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
                  <input name="kosten" type="number" defaultValue={activeDest?.kosten} placeholder="Kosten (€)" className="p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
                  <div className="flex items-center gap-6 px-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input name="gebucht" type="checkbox" defaultChecked={activeDest?.istGebucht} className="w-5 h-5 accent-emerald-500" /> Gebucht</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input name="erledigt" type="checkbox" defaultChecked={activeDest?.istErledigt} className="w-5 h-5 accent-emerald-500" /> Besucht</label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <select name="wetter" defaultValue={activeDest?.wetter || 'Egal'} className="p-4 bg-slate-800 border border-slate-700 rounded-2xl">
                    <option value="Egal">Wetter: Egal</option><option value="Sonne">Sonne</option><option value="Regen">Regen</option>
                  </select>
                  <select name="dauer" defaultValue={activeDest?.dauer || 'Halbtag'} className="p-4 bg-slate-800 border border-slate-700 rounded-2xl">
                    <option value="Kurz">Dauer: Kurz</option><option value="Halbtag">Halbtag</option><option value="Tag">Ganztag</option>
                  </select>
                  <select name="zielgruppe" defaultValue={activeDest?.zielgruppe || 'Alle'} className="p-4 bg-slate-800 border border-slate-700 rounded-2xl">
                    <option value="Alle">Fokus: Alle</option><option value="Kinder">Kinder</option><option value="Teens">Teens</option>
                  </select>
                </div>
                <input name="adresse" defaultValue={activeDest?.adresse} placeholder="Adresse für Navigation" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
                <input name="link" defaultValue={activeDest?.link} placeholder="Website Link" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none" />
                <textarea name="notizen" defaultValue={activeDest?.notizen} placeholder="Notizen..." className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none h-32" />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setView('list')} className="flex-1 p-4 bg-slate-800 rounded-2xl font-black">Abbruch</button>
                  <button type="submit" className="flex-[2] p-4 bg-emerald-600 rounded-2xl font-black hover:bg-emerald-500 transition-all">Speichern</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- AUTH COMPONENTS (Vereinfacht für den Hub) ---
const LoginScreen = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 p-12 rounded-[3rem] border border-slate-800 shadow-2xl">
        <h1 className="text-3xl font-black text-center mb-8 text-indigo-500">Personal Hub Login</h1>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, pass); }} className="space-y-6">
          <input type="email" placeholder="E-Mail" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl" value={pass} onChange={e => setPass(e.target.value)} />
          <button className="w-full bg-indigo-600 py-4 rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40">Anmelden</button>
        </form>
        {error && <p className="text-red-400 text-center mt-4 text-xs font-bold">{error}</p>}
      </div>
    </div>
  );
};

// --- GIFT MODULE (Hier kommt dein bestehender Gift-Code rein) ---
const GiftModule = ({ user, onBack }) => {
  // ... [Dein kompletter Code der letzten Geschenk-App hier einfügen]
  // Wichtig: Den Header so anpassen, dass 'onBack' zum Portal führt.
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10">
      <header className="mb-10 flex justify-between items-center border-b border-slate-800 pb-6">
        <button onClick={onBack} className="flex items-center text-slate-400 hover:text-white font-black text-xs">
          <ArrowLeft className="w-5 h-5 mr-2" /> Zum Portal
        </button>
        <h1 className="text-2xl font-black text-indigo-500 flex items-center gap-2"><Gift /> Geschenk-Controlling</h1>
      </header>
      {/* Dein bestehender JSX-Content für Geschenke */}
      <p className="text-center italic opacity-30 mt-20">Dein bestehendes Geschenk-Modul ist hier aktiv.</p>
    </div>
  );
};

export default App;