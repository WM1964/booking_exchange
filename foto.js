// ===================================================================
//  Diridari Erfassung – Foto-Verarbeitung
//  Etappe C2
//
//  Nimmt eine Bilddatei von der Kamera, verkleinert sie auf eine
//  maximale Kantenlaenge und komprimiert sie als JPEG. Ergebnis ist
//  ein Base64-DataURL (gut speicher- und spaeter am Desktop als
//  Dokument verwendbar). Haelt Fotos klein (meist < 500 KB).
// ===================================================================

// ---- Parametersteuerung ----
const FOTO_MAX_KANTE = 1600;   // laengste Kante in Pixeln
const FOTO_QUALITAET = 0.7;    // JPEG-Qualitaet 0..1

// Verkleinert + komprimiert eine Bilddatei. Gibt ein Promise<string>
// (Base64-DataURL) zurueck. Bei Fehlern (z. B. nicht lesbares Format)
// wird das Promise abgelehnt.
function komprimiereFoto(datei) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();

    img.onload = function () {
      URL.revokeObjectURL(url);
      let breite = img.width;
      let hoehe = img.height;
      if (!breite || !hoehe) {
        reject(new Error("Bild hat keine Groesse"));
        return;
      }
      const faktor = Math.min(1, FOTO_MAX_KANTE / Math.max(breite, hoehe));
      breite = Math.round(breite * faktor);
      hoehe = Math.round(hoehe * faktor);

      const canvas = document.createElement("canvas");
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, breite, hoehe);

      try {
        resolve(canvas.toDataURL("image/jpeg", FOTO_QUALITAET));
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht geladen werden"));
    };

    img.src = url;
  });
}
