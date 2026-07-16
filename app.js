// ===================================================================
//  BudgetView Erfassung – App-Logik
//  Etappe C3
//
//  Neu gegenueber C2:
//   - Buchungen aus der Inbox lassen sich ueber ein Stift-Symbol
//     nachtraeglich bearbeiten. Der Erfassungs-Screen kennt dadurch
//     zwei Modi: "Neu erfassen" (unveraendert) und "Bearbeiten"
//     (Formular vorbefuellt, Buchung wird beim Speichern ueberschrieben).
// ===================================================================

// ---- Parametersteuerung ----
const TOAST_DAUER_MS = 3000;   // Anzeigedauer der Hinweis-Meldung
// Dateityp beim Speichern/Teilen. "application/json" passt zur .json-Endung und
// wird von Android zuverlaessig geteilt (widerspruechliche .dbx-Endung fuehrte
// zu "NotAllowedError").
const DATEI_MIME = "text/csv";
// Endung der Exportdatei (muss zum Typ passen).
const DATEI_ENDUNG = ".csv";
// Verpackung beim TEILEN. Manche Geraete akzeptieren .json nicht als teilbaren
// Typ -> beim Teilen daher eine schlichte Textdatei (garantiert akzeptiert).
const TEILEN_MIME = "text/csv";
const TEILEN_ENDUNG = ".csv";
// Praefix des Export-Dateinamens (zentral aenderbar).
const EXPORT_PREFIX = "budgetview_export_";
// Fester Dateiname beim SPEICHERN (ohne Zeitstempel). Dadurch ueberschreibt
// das Handy beim naechsten Speichern die vorhandene Datei, statt eine weitere
// im Download-Ordner anzulegen -> der Ordner laeuft nicht mehr voll.
// Auf "false" setzen, um wieder eindeutige Namen mit Zeitstempel zu erhalten.
const EXPORT_FESTER_NAME = true;

// Laufzeit-Zustand
let aktuellerTyp = "ausgabe";  // "ausgabe" oder "einnahme"
let stammdaten = null;         // geladene Konten + Kategorien
let aktuelleFotos = [];        // Base64-Fotos der aktuellen Erfassung
let bearbeiteId = null;        // null = Neu-Modus; sonst id der bearbeiteten Buchung
let bearbeiteBuchung = null;   // die aktuell bearbeitete Buchung (im Bearbeiten-Modus)
let passwortModus = "festlegen";  // "festlegen" (erstes Mal) oder "eingeben"
let passwortFehlversuche = 0;     // Falscheingaben im Eingeben-Modus
let bereitetesPaket = null;       // fertig verschluesselte Datei (Phase 2)
let bereiterDateiname = "";       // Dateiname fuer Phase 2
let bereitetesFile = null;        // fertiges File-Objekt fuer navigator.share (direkter Aufruf)
let bereitetesFileTeilen = null;  // File-Objekt fuer das Teilen (.txt-Verpackung)
let installPrompt = null;         // gespeichertes Installations-Angebot des Browsers (Android)
let installBannerZu = false;      // Nutzer hat das Banner in dieser Sitzung weggetippt
let exportierteIds = [];          // IDs der zuletzt exportierten Buchungen (fuer die Loesch-Abfrage)
let letzterExportName = "";       // Dateiname beim SPEICHERN (fuer den Loesch-Hinweis; "" = geteilt)


// -------------------------------------------------------------------
//  Texte setzen
// -------------------------------------------------------------------
function setzeText(id, schluessel) {
  const el = document.getElementById(id);
  if (el) el.textContent = t(schluessel);
}

function setzeAlleTexte() {
  setzeText("nav_erfassen_label", "nav_erfassen");
  setzeText("nav_inbox_label", "nav_inbox");
  setzeText("nav_einstellungen_label", "nav_einstellungen");
  setzeText("erfassen_titel", "erfassen_titel");
  setzeText("typ-ausgabe", "typ_ausgabe");
  setzeText("typ-einnahme", "typ_einnahme");
  setzeText("lbl_datum", "feld_datum");
  setzeText("lbl_betrag", "feld_betrag");
  setzeText("lbl_konto", "feld_konto");
  setzeText("lbl_hauptkat", "feld_hauptkat");
  setzeText("lbl_unterkat", "feld_unterkat");
  setzeText("lbl_beschreibung", "feld_beschreibung");
  setzeText("lbl_belege", "feld_belege");
  setzeText("foto_hinzufuegen_label", "foto_hinzufuegen");
  setzeText("speichern-btn", "btn_speichern");
  setzeText("abbrechen-btn", "btn_abbrechen");
  setzeText("speichern-edit-btn", "btn_aenderungen");
  setzeText("keine_sd_titel", "keine_sd_titel");
  setzeText("keine_sd_text", "keine_sd_text");
  setzeText("zu-einstellungen-btn", "keine_sd_btn");
  setzeText("inbox_titel", "inbox_titel");
  setzeText("einstellungen_titel", "einstellungen_titel");
  setzeText("sprache_titel", "sprache_titel");
  const sprachSelect = document.getElementById("sprache-select");
  if (sprachSelect) sprachSelect.value = AKTUELLE_SPRACHE;
  setzeText("stammdaten_titel", "stammdaten_titel");
  setzeText("stammdaten_text", "stammdaten_text");
  setzeText("stammdaten_laden_label", "stammdaten_laden");
  setzeText("install_titel", "install_titel");
  setzeText("install-btn", "install_btn");
  setzeText("export_btn_label", "inbox_export");
  setzeText("export_titel", "export_titel");
  setzeText("export_text", "export_text");
  setzeText("passwort-abbrechen", "btn_abbrechen");
  setzeText("passwort-weiter", "btn_weiter");
  setzeText("phase2_titel", "phase2_titel");
  setzeText("phase2_text", "phase2_text");
  setzeText("phase2-speichern", "btn_speichern_datei");
  setzeText("phase2-teilen", "btn_teilen");
  setzeText("loeschen_titel", "loeschen_titel");
  setzeText("loeschen-ja", "loeschen_ja");
  setzeText("loeschen-nein", "loeschen_nein");
  setzeText("phase2-schliessen", "btn_schliessen");
  const pw1 = document.getElementById("passwort1");
  const pw2 = document.getElementById("passwort2");
  if (pw1) pw1.placeholder = t("export_pw1");
  if (pw2) pw2.placeholder = t("export_pw2");
  const besch = document.getElementById("feld-beschreibung");
  if (besch) besch.placeholder = t("ph_beschreibung");
  document.documentElement.lang = AKTUELLE_SPRACHE.replace("_", "-");
}

// Gespeicherte Sprache beim Start laden
function initSprache() {
  const gespeichert = speicherHole("sprache");
  if (gespeichert && LANG[gespeichert]) {
    AKTUELLE_SPRACHE = gespeichert;
  }
}

// Sprache wechseln: speichern und alle sichtbaren Texte aktualisieren
function wechsleSprache(code) {
  if (!LANG[code]) return;
  AKTUELLE_SPRACHE = code;
  speicherSetze("sprache", code);
  setzeAlleTexte();
  aktualisiereStammdatenStatus();
}


// -------------------------------------------------------------------
//  Navigation
// -------------------------------------------------------------------
function zeigeAnsicht(name) {
  document.querySelectorAll(".ansicht").forEach((a) => {
    a.classList.toggle("aktiv", a.id === "view-" + name);
  });
  document.querySelectorAll(".nav-knopf").forEach((k) => {
    k.classList.toggle("aktiv", k.dataset.ansicht === name);
  });
  if (name === "erfassen") bereiteErfassenVor();
  if (name === "inbox") zeigeInbox();
}


// -------------------------------------------------------------------
//  Toast
// -------------------------------------------------------------------
function zeigeToast(text, erfolg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.className = "toast sichtbar " + (erfolg ? "erfolg" : "fehler");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = "toast"; }, TOAST_DAUER_MS);
}


// -------------------------------------------------------------------
//  Datum
// -------------------------------------------------------------------
function formatiereDatum(isoDatum) {
  if (!isoDatum) return "";
  const locale = (typeof LOCALE !== "undefined" && LOCALE[AKTUELLE_SPRACHE]) || "de-DE";
  const teile = isoDatum.split("-");
  if (teile.length !== 3) return isoDatum;
  const d = new Date(Number(teile[0]), Number(teile[1]) - 1, Number(teile[2]));
  return d.toLocaleDateString(locale);
}

function heuteISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}

// Heutiges Datum als TT.MM.JJJJ (fuer den Export-Dateinamen)
function heuteDeutsch() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return dd + "." + mm + "." + d.getFullYear();
}

// Zeitstempel JJJJ-MM-TT_HH-MM-SS fuer einen eindeutigen Export-Dateinamen.
// Verhindert Namenskonflikte und damit die "erneut herunterladen?"-Nachfrage.
function zeitstempelDatei() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
         "_" + p(d.getHours()) + "-" + p(d.getMinutes()) + "-" + p(d.getSeconds());
}


// ═══════════════════════════════════════════════════════════════════
//  ERFASSEN (Neu- und Bearbeiten-Modus)
// ═══════════════════════════════════════════════════════════════════

function bereiteErfassenVor() {
  stammdaten = speicherHole("stammdaten");
  const hatDaten = stammdaten && Array.isArray(stammdaten.konten) && stammdaten.konten.length > 0;

  document.getElementById("erfassen-hinweis").style.display = hatDaten ? "none" : "block";
  document.getElementById("erfassen-formular").style.display = hatDaten ? "block" : "none";
  if (!hatDaten) return;

  const istBearbeiten = (bearbeiteId !== null && bearbeiteBuchung !== null);

  // Titel und Button-Leiste je nach Modus umschalten
  document.getElementById("erfassen_titel").textContent =
    istBearbeiten ? t("erfassen_titel_bearbeiten") : t("erfassen_titel");
  document.getElementById("speichern-btn").style.display = istBearbeiten ? "none" : "block";
  document.getElementById("bearbeiten-buttons").style.display = istBearbeiten ? "flex" : "none";

  if (istBearbeiten) {
    fuelleFormularMitBuchung(bearbeiteBuchung);
  } else {
    // --- Neu-Modus (unveraendert gegenueber C2) ---
    setzeTyp("ausgabe");
    const datumFeld = document.getElementById("feld-datum");
    if (!datumFeld.value) datumFeld.value = heuteISO();
    fuelleKontoDropdown();
    aktuelleFotos = [];
    rendereFotoVorschau();
  }
}

// Formular mit den Werten einer bestehenden Buchung vorbefuellen
function fuelleFormularMitBuchung(b) {
  setzeTyp(b.typ === "einnahme" ? "einnahme" : "ausgabe");
  document.getElementById("feld-datum").value = b.datum || heuteISO();
  document.getElementById("feld-betrag").value = Number(b.betrag).toFixed(2).replace(".", ",");
  document.getElementById("feld-beschreibung").value = b.beschreibung || "";

  // Kaskade in der richtigen Reihenfolge: Konto -> Hauptkat -> Unterkat
  fuelleKontoDropdown();
  document.getElementById("feld-konto").value = b.konto || "";
  fuelleHauptkatDropdown();
  document.getElementById("feld-hauptkat").value = b.hauptkategorie || "";
  fuelleUnterkatDropdown();
  document.getElementById("feld-unterkat").value = b.unterkategorie || "";

  aktuelleFotos = (b.fotos || []).slice();
  rendereFotoVorschau();
}

function setzeTyp(typ) {
  aktuellerTyp = typ;
  const btnAus = document.getElementById("typ-ausgabe");
  const btnEin = document.getElementById("typ-einnahme");
  btnAus.className = "typ-knopf" + (typ === "ausgabe" ? " aktiv-ausgabe" : "");
  btnEin.className = "typ-knopf" + (typ === "einnahme" ? " aktiv-einnahme" : "");
}

function macheOption(wert, text) {
  const opt = document.createElement("option");
  opt.value = wert;
  opt.textContent = text;
  return opt;
}

function fuelleKontoDropdown() {
  const sel = document.getElementById("feld-konto");
  sel.innerHTML = "";
  sel.appendChild(macheOption("", t("ph_bitte_waehlen")));
  const konten = stammdaten.konten || [];
  konten.forEach((k) => sel.appendChild(macheOption(k.name, k.name)));
  // Bei genau einem Konto dieses automatisch vorauswaehlen (spart einen Klick)
  if (konten.length === 1) {
    sel.value = konten[0].name;
  }
  fuelleHauptkatDropdown();
}

function fuelleHauptkatDropdown() {
  const konto = document.getElementById("feld-konto").value;
  const sel = document.getElementById("feld-hauptkat");
  sel.innerHTML = "";
  sel.appendChild(macheOption("", t("ph_bitte_waehlen")));
  const katFuerKonto = (stammdaten.kategorien && stammdaten.kategorien[konto]) || {};
  Object.keys(katFuerKonto).forEach((haupt) => sel.appendChild(macheOption(haupt, haupt)));
  fuelleUnterkatDropdown();
}

function fuelleUnterkatDropdown() {
  const konto = document.getElementById("feld-konto").value;
  const haupt = document.getElementById("feld-hauptkat").value;
  const sel = document.getElementById("feld-unterkat");
  sel.innerHTML = "";
  sel.appendChild(macheOption("", t("ph_bitte_waehlen")));
  const katFuerKonto = (stammdaten.kategorien && stammdaten.kategorien[konto]) || {};
  (katFuerKonto[haupt] || []).forEach((u) => sel.appendChild(macheOption(u, u)));
}

// Betrag robust einlesen: "12,50", "12.50", "1.234,56". Ungueltig/<=0 -> null.
function parseBetrag(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/\s/g, "");
  const hatKomma = s.includes(",");
  const hatPunkt = s.includes(".");
  if (hatKomma && hatPunkt) { s = s.replace(/\./g, "").replace(",", "."); }
  else if (hatKomma) { s = s.replace(",", "."); }
  const zahl = parseFloat(s);
  if (isNaN(zahl) || zahl <= 0) return null;
  return Math.round(zahl * 100) / 100;
}


// ---- Fotos ----
function rendereFotoVorschau() {
  const container = document.getElementById("foto-vorschau");
  container.innerHTML = "";
  aktuelleFotos.forEach((dataUrl, index) => {
    const wrap = document.createElement("div");
    wrap.className = "foto-thumb";
    const img = document.createElement("img");
    img.src = dataUrl;
    const del = document.createElement("button");
    del.className = "foto-thumb-loesch";
    del.type = "button";
    del.textContent = "×";
    del.title = t("foto_entfernen");
    del.addEventListener("click", () => { aktuelleFotos.splice(index, 1); rendereFotoVorschau(); });
    wrap.appendChild(img);
    wrap.appendChild(del);
    container.appendChild(wrap);
  });
}

async function fotoAufgenommen(datei) {
  try {
    const dataUrl = await komprimiereFoto(datei);
    aktuelleFotos.push(dataUrl);
    rendereFotoVorschau();
  } catch (e) {
    console.error("Foto-Fehler:", e);
    zeigeToast(t("fehler_foto"), false);
  }
}


// ---- Speichern (Neu ODER Bearbeiten) ----
async function speichereBuchung() {
  const konto = document.getElementById("feld-konto").value;
  const haupt = document.getElementById("feld-hauptkat").value;
  const unter = document.getElementById("feld-unterkat").value;
  const betragText = document.getElementById("feld-betrag").value;
  const datum = document.getElementById("feld-datum").value || heuteISO();
  const beschreibung = document.getElementById("feld-beschreibung").value.trim();

  if (!betragText || !konto || !haupt || !unter) {
    zeigeToast(t("fehler_pflicht"), false);
    return;
  }
  const betrag = parseBetrag(betragText);
  if (betrag === null) {
    zeigeToast(t("fehler_betrag"), false);
    return;
  }

  let waehrung = "EUR";
  (stammdaten.konten || []).forEach((k) => { if (k.name === konto) waehrung = k.waehrung || "EUR"; });

  const istBearbeiten = (bearbeiteId !== null);

  const buchung = {
    id: istBearbeiten ? bearbeiteId : (Date.now() + "_" + Math.floor(Math.random() * 100000)),
    typ: aktuellerTyp,
    datum: datum,
    betrag: betrag,
    waehrung: waehrung,
    konto: konto,
    hauptkategorie: haupt,
    unterkategorie: unter,
    beschreibung: beschreibung,
    fotos: aktuelleFotos.slice(),
    erfasst_am: (istBearbeiten && bearbeiteBuchung && bearbeiteBuchung.erfasst_am)
      ? bearbeiteBuchung.erfasst_am
      : heuteISO()
  };

  try {
    await buchungSpeichere(buchung);
  } catch (e) {
    console.error("Buchung speichern fehlgeschlagen:", e);
    zeigeToast(t("fehler_speichern"), false);
    return;
  }

  zeigeToast(t("erfolg_gespeichert"), true);

  if (istBearbeiten) {
    // Bearbeiten abgeschlossen -> Modus verlassen, zurueck zur Inbox
    bearbeiteId = null;
    bearbeiteBuchung = null;
    zeigeAnsicht("inbox");
  } else {
    // Neu-Modus: im Formular bleiben, Betrag/Kategorie/Beschreibung/Fotos leeren
    document.getElementById("feld-betrag").value = "";
    document.getElementById("feld-beschreibung").value = "";
    fuelleHauptkatDropdown();
    aktuelleFotos = [];
    rendereFotoVorschau();
  }
}

// Bearbeiten abbrechen -> ohne Aenderung zurueck zur Inbox
function brecheBearbeitenAb() {
  bearbeiteId = null;
  bearbeiteBuchung = null;
  zeigeAnsicht("inbox");
}


// ═══════════════════════════════════════════════════════════════════
//  INBOX
// ═══════════════════════════════════════════════════════════════════

async function zeigeInbox() {
  let liste = [];
  try { liste = await buchungenHole(); }
  catch (e) { console.error("Inbox laden fehlgeschlagen:", e); }

  const container = document.getElementById("inbox-container");
  const anzahlEl = document.getElementById("inbox-anzahl");
  container.innerHTML = "";

  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) exportBtn.style.display = liste.length > 0 ? "flex" : "none";

  if (liste.length === 0) {
    anzahlEl.textContent = "";
    const leer = document.createElement("div");
    leer.className = "inbox-leer";
    leer.textContent = t("inbox_leer");
    container.appendChild(leer);
    return;
  }

  anzahlEl.textContent = t("inbox_anzahl", { anzahl: liste.length });

  const box = document.createElement("div");
  box.className = "inbox-liste";

  liste.forEach((b) => {
    const zeile = document.createElement("div");
    zeile.className = "inbox-zeile";

    const info = document.createElement("div");
    info.className = "inbox-info";

    const titelZeile = document.createElement("div");
    titelZeile.className = "inbox-titel-zeile";
    titelZeile.textContent = b.hauptkategorie + " · " + b.unterkategorie;

    const detail = document.createElement("div");
    detail.className = "inbox-detail";
    const beschr = b.beschreibung ? " · " + b.beschreibung : "";
    detail.textContent = formatiereDatum(b.datum) + " · " + b.konto + beschr;

    const anzahlFotos = (b.fotos && b.fotos.length) ? b.fotos.length : 0;
    if (anzahlFotos > 0) {
      const fotoSpan = document.createElement("span");
      fotoSpan.className = "inbox-foto";
      fotoSpan.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/><circle cx='12' cy='13' r='4'/></svg>" + anzahlFotos;
      detail.appendChild(fotoSpan);
    }

    info.appendChild(titelZeile);
    info.appendChild(detail);

    const betrag = document.createElement("div");
    betrag.className = "inbox-betrag " + (b.typ === "einnahme" ? "einnahme" : "ausgabe");
    const vorz = b.typ === "einnahme" ? "+" : "−";
    betrag.textContent = vorz + b.betrag.toFixed(2) + " " + (b.waehrung || "EUR");

    // Bearbeiten (Stift)
    const bearbeiten = document.createElement("button");
    bearbeiten.className = "inbox-bearbeiten";
    bearbeiten.type = "button";
    bearbeiten.title = t("inbox_bearbeiten");
    bearbeiten.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 20h9'/><path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'/></svg>";
    bearbeiten.addEventListener("click", () => starteBearbeiten(b.id));

    // Loeschen (Papierkorb)
    const loesch = document.createElement("button");
    loesch.className = "inbox-loeschen";
    loesch.type = "button";
    loesch.title = t("inbox_loeschen");
    loesch.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/></svg>";
    loesch.addEventListener("click", () => loescheBuchung(b.id));

    zeile.appendChild(info);
    zeile.appendChild(betrag);
    zeile.appendChild(bearbeiten);
    zeile.appendChild(loesch);
    box.appendChild(zeile);
  });

  container.appendChild(box);
}

// Bearbeiten einer Buchung starten
async function starteBearbeiten(id) {
  let liste = [];
  try { liste = await buchungenHole(); }
  catch (e) { console.error("Buchung laden fehlgeschlagen:", e); return; }
  const b = liste.find((x) => x.id === id);
  if (!b) return;
  bearbeiteBuchung = b;
  bearbeiteId = id;
  zeigeAnsicht("erfassen");
}

async function loescheBuchung(id) {
  try { await buchungLoesche(id); }
  catch (e) { console.error("Loeschen fehlgeschlagen:", e); }
  zeigeInbox();
}


// ═══════════════════════════════════════════════════════════════════
//  EXPORT (verschluesselt)
// ═══════════════════════════════════════════════════════════════════

function oeffnePasswortModal() {
  const pruef = speicherHole("export_passwort_pruef");
  passwortModus = (pruef && pruef.hash) ? "eingeben" : "festlegen";
  passwortFehlversuche = 0;
  bereitetesPaket = null;
  bereitetesFile = null;
  bereitetesFileTeilen = null;

  document.getElementById("passwort1").value = "";
  document.getElementById("passwort2").value = "";
  document.getElementById("hinweis-feld").value = "";
  document.getElementById("passwort-fehler").textContent = "";
  const anz = document.getElementById("hinweis-anzeige");
  anz.textContent = "";
  anz.style.display = "none";

  const istFestlegen = (passwortModus === "festlegen");
  document.getElementById("passwort2").style.display = istFestlegen ? "block" : "none";
  document.getElementById("hinweis-feld").style.display = istFestlegen ? "block" : "none";

  document.getElementById("export_titel").textContent =
    istFestlegen ? t("pw_titel_festlegen") : t("pw_titel_eingeben");
  document.getElementById("export_text").textContent =
    istFestlegen ? t("pw_text_festlegen") : t("pw_text_eingeben");
  document.getElementById("passwort1").placeholder = t("export_pw1");
  document.getElementById("passwort2").placeholder = t("export_pw2");
  document.getElementById("hinweis-feld").placeholder = t("pw_hinweis_ph");

  // Immer mit Phase 1 (Passwort) starten
  document.getElementById("phase-passwort").style.display = "block";
  document.getElementById("phase-weitergeben").style.display = "none";
  document.getElementById("phase-loeschen").style.display = "none";

  document.getElementById("passwort-overlay").style.display = "flex";
}

function schliessePasswortModal() {
  document.getElementById("passwort-overlay").style.display = "none";
}

// Export starten: pruefen, ob Buchungen da sind, dann Passwort abfragen.
async function starteExport() {
  let liste = [];
  try { liste = await buchungenHole(); }
  catch (e) { console.error(e); }
  if (liste.length === 0) {
    zeigeToast(t("fehler_export_leer"), false);
    return;
  }

  const autoPw = speicherHole("export_passwort_auto");
  if (autoPw) {
    // Automatisches Passwort (vom QR-Setup) -> ohne Passwort-Eingabe direkt verschluesseln
    if (await _bereiteDateienVor(autoPw, liste)) {
      oeffnePasswortModalPhase2();
    } else {
      zeigeToast(t("fehler_export"), false);
    }
  } else {
    // Kein automatisches Passwort -> Passwort festlegen/eingeben (bisheriger Weg)
    oeffnePasswortModal();
  }
}

// Modal direkt in Phase 2 (Weitergeben) oeffnen, ohne Passwort-Phase.
function oeffnePasswortModalPhase2() {
  zeigePhase2();
  document.getElementById("passwort-overlay").style.display = "flex";
}

// Nach Passwort-Eingabe: verschluesseln und Datei bereitstellen.
// Phase 1 -> Phase 2: Passwort pruefen, verschluesseln, dann Weitergabe anbieten.
async function weiterZuPhase2() {
  const pw1 = document.getElementById("passwort1").value;
  const fehlerEl = document.getElementById("passwort-fehler");
  fehlerEl.textContent = "";

  let liste = [];
  try { liste = await buchungenHole(); }
  catch (e) { console.error(e); }
  if (liste.length === 0) {
    schliessePasswortModal();
    zeigeToast(t("fehler_export_leer"), false);
    return;
  }

  if (!pw1) { fehlerEl.textContent = t("fehler_pw_leer"); return; }

  if (passwortModus === "festlegen") {
    // Erstes Mal: Passwort festlegen (mit Wiederholung) + Hinweis, Pruefsumme speichern
    const pw2 = document.getElementById("passwort2").value;
    const hinweis = document.getElementById("hinweis-feld").value.trim();
    if (pw1 !== pw2) { fehlerEl.textContent = t("fehler_pw_ungleich"); return; }
    try {
      const pruef = await berechnePruefHash(pw1, null);
      speicherSetze("export_passwort_pruef", { salt: pruef.salt, hash: pruef.hash, hinweis: hinweis });
    } catch (e) {
      console.error("Pruefsumme fehlgeschlagen:", e);
      fehlerEl.textContent = t("fehler_export");
      return;
    }
  } else {
    // Weitere Male: Passwort gegen die gespeicherte Pruefsumme vergleichen
    const pruef = speicherHole("export_passwort_pruef");
    let korrekt = false;
    try {
      const check = await berechnePruefHash(pw1, pruef.salt);
      korrekt = (check.hash === pruef.hash);
    } catch (e) { console.error(e); }

    if (!korrekt) {
      passwortFehlversuche++;
      fehlerEl.textContent = t("fehler_pw_falsch");
      if (passwortFehlversuche >= 2 && pruef && pruef.hinweis) {
        const anz = document.getElementById("hinweis-anzeige");
        anz.textContent = t("pw_hinweis_label", { hinweis: pruef.hinweis });
        anz.style.display = "block";
      }
      return;
    }
  }

  // Passwort ist ok -> jetzt verschluesseln und Dateien vorbereiten
  if (await _bereiteDateienVor(pw1, liste)) {
    zeigePhase2();
  } else {
    fehlerEl.textContent = t("fehler_export");
  }
}

// Verschluesselt die Buchungen mit pw und bereitet die File-Objekte vor.
// Rueckgabe: true bei Erfolg, false bei Fehler. (Gemeinsam von manuellem und
// automatischem Export genutzt.)
async function _bereiteDateienVor(pw, liste) {
  const klartext = JSON.stringify({
    typ: "diridari-buchungen",
    version: 1,
    erstellt_am: heuteISO(),
    anzahl: liste.length,
    buchungen: liste
  });
  let paket;
  try {
    paket = await verschluesseleText(klartext, pw);
  } catch (e) {
    console.error("Verschluesselung fehlgeschlagen:", e);
    return false;
  }
bereitetesPaket = paket;
  const stempel = zeitstempelDatei();
  const inhalt = JSON.stringify(bereitetesPaket);
  // SPEICHERN: fester Name -> vorhandene Datei wird ueberschrieben, kein Zuwachs.
  // (Der Zeitstempel-Name bleibt als Rueckfalloption per EXPORT_FESTER_NAME erhalten.)
bereiterDateiname = EXPORT_PREFIX + stempel + DATEI_ENDUNG;
  // File-Objekte sofort fertig vorbereiten, damit beim Tippen auf "Speichern"/"Teilen"
  // nur noch die jeweilige Aktion laeuft (frische Beruehrung bleibt erhalten).
  bereitetesFile = new File([inhalt], bereiterDateiname, { type: DATEI_MIME });
  // TEILEN: hier ist ein Zeitstempel unkritisch (E-Mail/WhatsApp) und vermeidet,
  // dass gleichnamige Anhaenge verwechselt werden.
  bereitetesFileTeilen = new File([inhalt], EXPORT_PREFIX + stempel + TEILEN_ENDUNG, { type: TEILEN_MIME });
  exportierteIds = liste.map((b) => b.id);   // fuer die Loesch-Abfrage nach dem Export
  return true;
}

// Phase 2 anzeigen (Weitergabe-Auswahl). Teilen nur bei Geraeteunterstuetzung.
function zeigePhase2() {
  document.getElementById("phase-passwort").style.display = "none";
  document.getElementById("phase-weitergeben").style.display = "block";
  document.getElementById("phase-loeschen").style.display = "none";
  document.getElementById("phase2-teilen").style.display = teilenVerfuegbar() ? "block" : "none";
}

// Phase 2: fertige Datei speichern (herunterladen).
function speichereBereitetesPaket() {
  if (!bereitetesPaket) return;
  letzterExportName = bereiterDateiname;   // fuer den Datei-Hinweis in Phase 3
  exportiereDateiSpeichern(bereitetesPaket, bereiterDateiname);
  zeigePhase3();
}

// Phase 2: fertige Datei teilen. Der Aufruf kommt direkt aus der Beruehrung,
// daher oeffnet sich das Teilen-Menue zuverlaessig.
async function teileBereitetesPaket() {
  if (!bereitetesFileTeilen) return;
  // Direkter Aufruf ohne Umwege -> die frische Beruehrung bleibt erhalten.
  try {
    await navigator.share({ files: [bereitetesFileTeilen] });
    letzterExportName = "";   // beim Teilen entsteht keine bleibende Datei -> kein Hinweis
    zeigePhase3();
  } catch (e) {
    if (e && e.name === "AbortError") return;   // Nutzer hat abgebrochen
    zeigeToast(t("fehler_teilen_fehler", { grund: (e && e.name) ? e.name : "?" }), false);
  }
}

// Phase 3: nach erfolgreichem Export fragen, ob die uebertragenen Buchungen
// vom Handy geloescht werden sollen.
function zeigePhase3() {
  document.getElementById("phase-passwort").style.display = "none";
  document.getElementById("phase-weitergeben").style.display = "none";
  document.getElementById("phase-loeschen").style.display = "block";

let text = t("loeschen_frage", { anzahl: exportierteIds.length });
  // TEMPORÄRE DIAGNOSE:
  text += "\n\n[DIAG name='" + letzterExportName + "' key='" + t("loeschen_datei_hinweis", { datei: "X" }) + "']";
  // Nur beim SPEICHERN liegt eine bleibende Datei im Download-Ordner -> Hinweis anhaengen.
  if (letzterExportName) {
    text += "\n\n" + t("loeschen_datei_hinweis", { datei: letzterExportName });
  }
  const el = document.getElementById("loeschen_text");
  el.textContent = text;
  el.style.whiteSpace = "pre-line";   // \n als Zeilenumbruch darstellen
}

async function loescheExportierteBuchungen() {
  for (const id of exportierteIds) {
    try { await buchungLoesche(id); }
    catch (e) { console.error("Loeschen fehlgeschlagen:", e); }
  }
  exportierteIds = [];
  schliessePasswortModal();
  zeigeInbox();
  zeigeToast(t("loeschen_erfolg"), true);
}

function loeschenBehalten() {
  exportierteIds = [];
  schliessePasswortModal();
  zeigeToast(t("erfolg_export"), true);
}

// Datei ueber das Teilen-Menue (falls moeglich) oder als Download bereitstellen.
// Prueft, ob das native Teilen-Menue mit Dateien verfuegbar ist.
function teilenVerfuegbar() {
  try {
    const testFile = new File(["x"], "test" + TEILEN_ENDUNG, { type: TEILEN_MIME });
    return !!(navigator.canShare && navigator.canShare({ files: [testFile] }));
  } catch (e) {
    return false;
  }
}

// Datei herunterladen/speichern.
function exportiereDateiSpeichern(objekt, dateiname) {
  const blob = new Blob([JSON.stringify(objekt)], { type: DATEI_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.rel = "noopener";
  a.style.display = "none";
  // In der installierten App (Standalone) blockiert Android den normalen
  // Download. Ein neuer Browsing-Kontext (target=_blank) kann das umgehen.
  const istStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  if (istStandalone) {
    a.target = "_blank";
  }
  document.body.appendChild(a);
  a.click();
  // Link und URL erst nach dem Start des Downloads freigeben. Wird sofort
  // freigegeben, bricht der Download auf manchen Geraeten ab (keine Datei).
  setTimeout(() => {
    try { document.body.removeChild(a); } catch (e) {}
    URL.revokeObjectURL(url);
  }, 60000);
}


// ═══════════════════════════════════════════════════════════════════
//  EINSTELLUNGEN: Stammdaten laden (unveraendert seit B2)
// ═══════════════════════════════════════════════════════════════════

function zaehleKategorien(kategorien) {
  let anzahl = 0;
  if (!kategorien) return 0;
  for (const konto in kategorien) {
    const haupt = kategorien[konto];
    for (const h in haupt) { anzahl += (haupt[h] || []).length; }
  }
  return anzahl;
}

function aktualisiereStammdatenStatus() {
  const statusEl = document.getElementById("stammdaten-status");
  const iconEl = document.getElementById("stammdaten-status-icon");
  if (!statusEl) return;

  const daten = speicherHole("stammdaten");
  if (!daten) {
    statusEl.textContent = t("status_leer");
    if (iconEl) iconEl.style.display = "none";
    return;
  }
  const anzahlKonten = (daten.konten || []).length;
  const anzahlKat = zaehleKategorien(daten.kategorien);
  const stand = daten.erstellt_am || "";
  statusEl.innerHTML =
    "<b>" + t("status_geladen", { konten: anzahlKonten, kategorien: anzahlKat }) + "</b>" +
    (stand ? "<br><span style='color:#9aa19c;'>" + t("status_stand", { datum: stand }) + "</span>" : "");
if (iconEl) iconEl.style.display = "block";

  aktualisiereSpeicherStatus();
}

// Zeigt in den Einstellungen an, ob der Speicher dauerhaft geschuetzt ist.
async function aktualisiereSpeicherStatus() {
  const el = document.getElementById("speicher-status");
  if (!el) return;
  try {
    if (navigator.storage && navigator.storage.persisted) {
      const dauerhaft = await navigator.storage.persisted();
      if (dauerhaft) {
        el.textContent = "\u2713 " + t("speicher_sicher");
        el.style.color = "#15803d";
      } else {
        el.textContent = "\u26a0 " + t("speicher_unsicher");
        el.style.color = "#b45309";
      }
    } else {
      el.textContent = "";
    }
  } catch (e) {
    el.textContent = "";
  }
}

function ladeStammdatenDatei(datei) {
  const reader = new FileReader();
  reader.onload = function (e) {
    let daten;
    try { daten = JSON.parse(e.target.result); }
    catch (err) { zeigeToast(t("fehler_ungueltig"), false); return; }
    if (!daten || daten.typ !== "diridari-stammdaten") { zeigeToast(t("fehler_ungueltig"), false); return; }
    speicherSetze("stammdaten", daten);
    aktualisiereStammdatenStatus();
    zeigeToast(t("erfolg_geladen"), true);
  };
  reader.onerror = function () { zeigeToast(t("fehler_lesen"), false); };
  reader.readAsText(datei);
}


// -------------------------------------------------------------------
//  QR-Einrichtung empfangen (Etappe F2)
//  Liest den #setup=... aus der Adresse, richtet Stammdaten + Passwort
//  ein und behaelt bestehende Buchungen.
// -------------------------------------------------------------------
async function entpackeSetup(b64url) {
  // URL-sicheres base64 -> Bytes -> gunzip (browser-nativ) -> JSON
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

function _entferneSetupHash() {
  // Hash entfernen, damit das Setup nicht bei jedem Neuladen erneut laeuft
  try {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (e) {
    try { window.location.hash = ""; } catch (e2) {}
  }
}

async function verarbeiteSetupAusUrl() {
  const hash = window.location.hash || "";
  const marker = "#setup=";
  if (!hash.startsWith(marker)) return;
  const b64url = hash.slice(marker.length);
  if (!b64url) return;

  let setup;
  try {
    setup = await entpackeSetup(b64url);
  } catch (e) {
    console.error("Setup entpacken fehlgeschlagen:", e);
    zeigeToast(t("fehler_ungueltig"), false);
    _entferneSetupHash();
    return;
  }

  if (!setup || setup.typ !== "diridari-setup") {
    zeigeToast(t("fehler_ungueltig"), false);
    _entferneSetupHash();
    return;
  }

  // Stammdaten einrichten (bestehende Buchungen bleiben unberuehrt)
  const stammdatenObj = {
    typ: "diridari-stammdaten",
    version: setup.version || 1,
    konten: setup.konten || [],
    kategorien: setup.kategorien || {},
    erstellt_am: setup.erstellt_am || ""
  };
  speicherSetze("stammdaten", stammdatenObj);

  // Automatisches Passwort speichern (Export ohne Passwort-Eingabe, Etappe F3)
  if (setup.pw) {
    speicherSetze("export_passwort_auto", setup.pw);
  }

  _entferneSetupHash();
  aktualisiereStammdatenStatus();
  zeigeAnsicht("erfassen");   // laedt die neuen Konten/Kategorien in die Formulare
  zeigeToast(t("setup_erfolg", { konten: stammdatenObj.konten.length }), true);
}


// -------------------------------------------------------------------
//  App-Installation (Etappe F2b): "Als App installieren"-Banner
// -------------------------------------------------------------------
function istAppStandalone() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
         window.navigator.standalone === true;
}

function istIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

function zeigeInstallBanner(modus) {
  if (istAppStandalone() || installBannerZu) return;
  const banner = document.getElementById("install-banner");
  const btn = document.getElementById("install-btn");
  const sub = document.getElementById("install_sub");
  if (!banner) return;
  if (modus === "ios") {
    if (btn) btn.style.display = "none";
    if (sub) sub.textContent = t("install_ios_hinweis");
  } else {
    if (btn) btn.style.display = "block";
    if (sub) sub.textContent = t("install_sub");
  }
  banner.style.display = "flex";
}

function versteckeInstallBanner() {
  const banner = document.getElementById("install-banner");
  if (banner) banner.style.display = "none";
}

function schliesseInstallBanner() {
  installBannerZu = true;   // in dieser Sitzung nicht mehr zeigen
  versteckeInstallBanner();
}

async function installiereApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) {}
  installPrompt = null;
  versteckeInstallBanner();
}

// Browser bietet Installation an -> Angebot merken und Banner zeigen
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  if (document.getElementById("install-banner")) zeigeInstallBanner("android");
});
// Nach erfolgter Installation Banner ausblenden
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  versteckeInstallBanner();
});


// -------------------------------------------------------------------
//  Service Worker
// -------------------------------------------------------------------
function registriereServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((fehler) => {
      console.error("Service Worker Fehler:", fehler);
    });
  }
}


// -------------------------------------------------------------------
//  Start
// -------------------------------------------------------------------
// Bittet das System, den App-Speicher (IndexedDB + localStorage) dauerhaft zu
// behalten. Verhindert, dass Buchungen/Stammdaten bei Speicherdruck oder beim
// Aufraeumen des Browsers automatisch verworfen werden. Bei installierten PWAs
// gewaehrt Chrome dies meist ohne Rueckfrage.
async function sichereDauerhaftenSpeicher() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const schon = await navigator.storage.persisted();
      if (!schon) {
        await navigator.storage.persist();
      }
    }
  } catch (e) {
    console.warn("Dauerhafter Speicher nicht verfuegbar:", e);
  }
}

// --- TEMPORÄRER OPTION-B-PINGTEST (nach Klärung wieder entfernen) ---
async function optionBPingTest() {
  const hash = window.location.hash || "";
  const marker = "#pingtest=";
  if (!hash.startsWith(marker)) return false;

  const adresse = hash.substring(marker.length);   // "ip:port"
  const ziel = "http://" + adresse + "/ping";

  // --- VOLLDIAGNOSE ---
  let bericht = "ZIEL: " + ziel + "\n";
  bericht += "SW aktiv: " + (navigator.serviceWorker && navigator.serviceWorker.controller ? "JA" : "NEIN") + "\n";
  try {
    const r = await fetch(ziel, { method: "GET", targetAddressSpace: "private" });
    bericht += "STATUS: " + r.status + "\n";
    bericht += "TYPE: " + r.type + "\n";
    bericht += "URL: " + r.url + "\n";
    const txt = await r.text();
    bericht += "BODY: " + txt.substring(0, 200);
  } catch (e) {
    bericht += "EXCEPTION: " + (e && e.message ? e.message : e);
  }
  alert(bericht);
  return true;
  // --- ENDE VOLLDIAGNOSE (alter Code darunter wird nicht mehr erreicht) ---

  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;" +
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "padding:24px;text-align:center;font-family:sans-serif;";
  box.innerHTML = "<div style='font-size:18px;font-weight:600;margin-bottom:16px;'>" +
    "Option-B-Test</div><div id='ping-status' style='font-size:16px;'>Sende Ping an " +
    adresse + " ...</div>";
  document.body.appendChild(box);
  const statusEl = box.querySelector("#ping-status");

  try {
    const antwort = await fetch(ziel, { method: "GET", targetAddressSpace: "private" });
    if (antwort.ok) {
      const daten = await antwort.json();
      statusEl.innerHTML = "<span style='color:#15803d;font-size:22px;'>✅ Ping OK</span>" +
        "<br><br>Der direkte Weg funktioniert!<br>Antwort: " + JSON.stringify(daten);
    } else {
      statusEl.innerHTML = "<span style='color:#b91c1c;font-size:22px;'>❌ HTTP " +
        antwort.status + "</span><br><br>Server erreicht, aber Fehlerstatus.";
    }
  } catch (e) {
    statusEl.innerHTML = "<span style='color:#b91c1c;font-size:22px;'>❌ Blockiert</span>" +
      "<br><br>" + (e && e.message ? e.message : e) +
      "<br><br>(Mögliche Ursachen: Berechtigung abgelehnt, Chrome zu alt, " +
      "kein privates Netz, Server nicht erreichbar.)";
  }
  return true;
}
// --- ENDE TEMPORÄRER PINGTEST ---

window.addEventListener("load", function () {
  if (optionBPingTest()) { /* Testmodus: normaler Start laeuft trotzdem weiter */ }
  sichereDauerhaftenSpeicher();
  initSprache();
  setzeAlleTexte();

  document.querySelectorAll(".nav-knopf").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      // Ein Tipp auf "Erfassen" startet immer den Neu-Modus
      if (knopf.dataset.ansicht === "erfassen") { bearbeiteId = null; bearbeiteBuchung = null; }
      zeigeAnsicht(knopf.dataset.ansicht);
    });
  });

  document.getElementById("typ-ausgabe").addEventListener("click", () => setzeTyp("ausgabe"));
  document.getElementById("typ-einnahme").addEventListener("click", () => setzeTyp("einnahme"));
  document.getElementById("feld-konto").addEventListener("change", fuelleHauptkatDropdown);
  document.getElementById("feld-hauptkat").addEventListener("change", fuelleUnterkatDropdown);
  document.getElementById("speichern-btn").addEventListener("click", speichereBuchung);
  document.getElementById("speichern-edit-btn").addEventListener("click", speichereBuchung);
  document.getElementById("abbrechen-btn").addEventListener("click", brecheBearbeitenAb);
  document.getElementById("zu-einstellungen-btn").addEventListener("click", () => zeigeAnsicht("einstellungen"));

  const fotoBtn = document.getElementById("foto-hinzufuegen-btn");
  const fotoInput = document.getElementById("foto-input");
  fotoBtn.addEventListener("click", () => fotoInput.click());
  fotoInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) fotoAufgenommen(e.target.files[0]);
    e.target.value = "";
  });

  document.getElementById("export-btn").addEventListener("click", starteExport);
  document.getElementById("passwort-abbrechen").addEventListener("click", schliessePasswortModal);
  document.getElementById("passwort-weiter").addEventListener("click", weiterZuPhase2);
  document.getElementById("phase2-speichern").addEventListener("click", speichereBereitetesPaket);
  document.getElementById("phase2-teilen").addEventListener("click", teileBereitetesPaket);
  document.getElementById("phase2-schliessen").addEventListener("click", schliessePasswortModal);
  document.getElementById("loeschen-ja").addEventListener("click", loescheExportierteBuchungen);
  document.getElementById("loeschen-nein").addEventListener("click", loeschenBehalten);

  const sprachSelect = document.getElementById("sprache-select");
  if (sprachSelect) sprachSelect.addEventListener("change", (e) => wechsleSprache(e.target.value));

  const ladenBtn = document.getElementById("stammdaten-laden-btn");
  const dateiFeld = document.getElementById("stammdaten-input");
  if (ladenBtn && dateiFeld) {   // Datei-Weg ist ausgeblendet -> nur verknuepfen, wenn vorhanden
    ladenBtn.addEventListener("click", () => dateiFeld.click());
    dateiFeld.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) ladeStammdatenDatei(e.target.files[0]);
      e.target.value = "";
    });
  }

  aktualisiereStammdatenStatus();
  zeigeAnsicht("erfassen");
  registriereServiceWorker();
  verarbeiteSetupAusUrl();   // QR-Einrichtung verarbeiten, falls #setup=... in der Adresse

  // Installations-Banner: Android-Angebot nutzen oder iPhone-Hinweis zeigen
  document.getElementById("install-btn").addEventListener("click", installiereApp);
  document.getElementById("install-schliessen").addEventListener("click", schliesseInstallBanner);
  if (installPrompt) {
    zeigeInstallBanner("android");
  } else if (istIOS() && !istAppStandalone()) {
    zeigeInstallBanner("ios");
  }
});
