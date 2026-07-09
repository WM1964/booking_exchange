// ===================================================================
//  Diridari Erfassung – Speicher
//  Etappe C2
//
//  Zwei Speicherbereiche:
//  1) localStorage (klein, synchron) – fuer die Stammdaten
//     (Konten/Kategorien). Funktionen: speicherSetze/Hole/Loesche.
//  2) IndexedDB (gross, asynchron) – fuer die Buchungen, die auch
//     Belegfotos enthalten koennen. Funktionen: buchungen* (Promise).
// ===================================================================

const SPEICHER_PREFIX = "diridari.";

// ---- 1) localStorage: Stammdaten (unveraendert seit B2) ----
function speicherSetze(schluessel, objekt) {
  try {
    localStorage.setItem(SPEICHER_PREFIX + schluessel, JSON.stringify(objekt));
    return true;
  } catch (e) {
    console.error("Speichern fehlgeschlagen:", e);
    return false;
  }
}

function speicherHole(schluessel) {
  try {
    const text = localStorage.getItem(SPEICHER_PREFIX + schluessel);
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("Laden fehlgeschlagen:", e);
    return null;
  }
}

function speicherLoesche(schluessel) {
  try {
    localStorage.removeItem(SPEICHER_PREFIX + schluessel);
    return true;
  } catch (e) {
    console.error("Loeschen fehlgeschlagen:", e);
    return false;
  }
}

// ---- 2) IndexedDB: Buchungen (mit Belegfotos) ----
const DB_NAME = "diridari-db";
const DB_VERSION = 1;
const STORE_BUCHUNGEN = "buchungen";

// Datenbank oeffnen (und beim ersten Mal den Speicher anlegen).
function dbOeffnen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_BUCHUNGEN)) {
        db.createObjectStore(STORE_BUCHUNGEN, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Alle Buchungen holen (nach id = Erfassungszeit sortiert).
async function buchungenHole() {
  const db = await dbOeffnen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUCHUNGEN, "readonly");
    const req = tx.objectStore(STORE_BUCHUNGEN).getAll();
    req.onsuccess = () => {
      const liste = req.result || [];
      liste.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      resolve(liste);
    };
    req.onerror = () => reject(req.error);
  });
}

// Eine Buchung speichern (neu anlegen oder ueberschreiben).
async function buchungSpeichere(buchung) {
  const db = await dbOeffnen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUCHUNGEN, "readwrite");
    tx.objectStore(STORE_BUCHUNGEN).put(buchung);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Eine Buchung anhand ihrer id loeschen.
async function buchungLoesche(id) {
  const db = await dbOeffnen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUCHUNGEN, "readwrite");
    tx.objectStore(STORE_BUCHUNGEN).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Anzahl der Buchungen (fuer Anzeigen).
async function buchungenAnzahl() {
  const liste = await buchungenHole();
  return liste.length;
}
