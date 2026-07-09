// ===================================================================
//  Diridari Erfassung – Verschlüsselung
//  Etappe D
//
//  Verschluesselt einen Text (die gesammelten Buchungen als JSON) mit
//  einem Passwort. Verfahren: Schluesselableitung per PBKDF2
//  (SHA-256), Verschluesselung per AES-256-GCM. Alle Bestandteile
//  werden Base64-kodiert in einem JSON-Objekt abgelegt, das der
//  Python-Desktop in Etappe E entschluesseln kann.
//
//  Benoetigt eine sichere Umgebung (HTTPS) – bei Netlify gegeben.
// ===================================================================

// ---- Parametersteuerung ----
const KDF_ITERATIONEN = 200000;   // PBKDF2-Iterationen
const SALT_BYTES = 16;            // Laenge des Salt
const IV_BYTES = 12;             // Laenge des Initialisierungsvektors (GCM)

// Uint8Array/ArrayBuffer -> Base64-String
function _base64Kodiere(puffer) {
  const arr = new Uint8Array(puffer);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

// Verschluesselt einen Klartext-String mit einem Passwort.
// Gibt ein Promise auf ein JSON-taugliches Objekt zurueck.
async function verschluesseleText(klartext, passwort) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passwort), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: KDF_ITERATIONEN, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, key, enc.encode(klartext)
  );

  return {
    typ: "diridari-buchungen-verschluesselt",
    version: 1,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterationen: KDF_ITERATIONEN,
    salt: _base64Kodiere(salt),
    iv: _base64Kodiere(iv),
    daten: _base64Kodiere(ciphertext)
  };
}


// -------------------------------------------------------------------
//  Pruefsumme des Passworts (zum Wiedererkennen, NICHT zum Speichern
//  des Klartext-Passworts). Verfahren: PBKDF2-SHA256 mit Salt.
//  Rueckgabe: { salt, hash } (beide Base64). Wird ein Salt uebergeben,
//  wird genau dieses verwendet (zum Vergleichen); sonst ein neues.
// -------------------------------------------------------------------
async function berechnePruefHash(passwort, saltB64) {
  const enc = new TextEncoder();
  let salt;
  if (saltB64) {
    const roh = atob(saltB64);
    salt = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) salt[i] = roh.charCodeAt(i);
  } else {
    salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  }
  const km = await crypto.subtle.importKey(
    "raw", enc.encode(passwort), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: KDF_ITERATIONEN, hash: "SHA-256" },
    km, 256
  );
  return { salt: _base64Kodiere(salt), hash: _base64Kodiere(bits) };
}
