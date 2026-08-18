import { chf, niveau } from "./lib";
import type { Acces } from "./acces";

const CSS = `
:root{--fond:#faf8f5;--carte:#fff;--trait:#e6e1d8;--texte:#2c2a26;--doux:#7a746a;
--ok:#3b7a3b;--attention:#c08a1f;--exces:#b83f3f;--special:#7b3fa0;--accent:#2c5f7c}
*{box-sizing:border-box;margin:0;padding:0}
body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
background:var(--fond);color:var(--texte);padding:16px;max-width:640px;margin:0 auto;
-webkit-text-size-adjust:100%}
h1{font-size:1.4rem;margin-bottom:4px}h2{font-size:1rem;margin:24px 0 8px;color:var(--doux);
text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:12px;padding:16px;margin-bottom:12px}
.gros{font-size:2.2rem;font-weight:700;letter-spacing:-.02em}
.doux{color:var(--doux);font-size:.85rem}
.rang{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--trait)}
.rang:last-child{border-bottom:0}
.barre{height:6px;background:var(--trait);border-radius:3px;overflow:hidden;margin-top:6px}
.barre i{display:block;height:100%;border-radius:3px}
.ok{color:var(--ok)}.attention{color:var(--attention)}.exces{color:var(--exces)}.special{color:var(--special)}
.alerte{background:#fdf2f2;border:1px solid #f0c9c9;color:var(--exces);border-radius:12px;padding:14px;margin-bottom:12px}
.info{background:#f2f7fb;border:1px solid #cfe0ec;color:var(--accent);border-radius:12px;padding:14px;margin-bottom:12px}
input,button,select{font:inherit}
input,select{width:100%;padding:12px;border:1px solid var(--trait);border-radius:8px;background:#fff}
button{padding:12px 18px;border:0;border-radius:8px;background:var(--texte);color:#fff;font-weight:600;cursor:pointer}
button.plat{background:transparent;color:var(--accent);padding:6px 0;font-weight:500}
.zone{border:2px dashed var(--trait);border-radius:12px;padding:32px 16px;text-align:center;color:var(--doux);
background:var(--carte);cursor:pointer;transition:.15s}
.zone.actif{border-color:var(--accent);background:#f2f7fb;color:var(--accent)}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.6rem;letter-spacing:.2em}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px 4px;border-bottom:1px solid var(--trait);font-size:.9rem}
th{color:var(--doux);font-weight:600;font-size:.75rem;text-transform:uppercase}
`;

function enveloppeHtml(titre: string, corps: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>${titre}</title><style>${CSS}</style></head><body>${corps}</body></html>`;
}

export function pageEntree(erreur?: string, admin = false): string {
  return enveloppeHtml("Enveloppe", `
<h1>Enveloppe</h1>
<p class="doux">${admin ? "Espace d'administration." : "Entre ton code à six chiffres."}</p>
${erreur ? `<div class="alerte" style="margin-top:12px">${erreur}</div>` : ""}
<form method="post" action="${admin ? "/admin" : "/entrer"}" class="carte" style="margin-top:16px">
  <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code"
         placeholder="000000" class="code" style="text-align:center" autofocus>
  <button type="submit" style="width:100%;margin-top:12px">Entrer</button>
</form>`);
}

export function pageAdmin(comptes: any[], base: string): string {
  const lignes = comptes.map((c) => {
    const lien = `${base}/${c.code}`;
    const ech = c.statut === "exempt"
      ? `<span class="doux">gratuit</span>`
      : c.expire_le ?? "—";
    return `<tr>
      <td><strong>${c.nom}</strong><br><span class="doux code" style="font-size:.9rem">${c.code}</span></td>
      <td>${ech}</td>
      <td>
        <button class="plat" onclick="copier('${lien}')">Copier le lien</button><br>
        ${c.statut === "exempt" ? "" : `<button class="plat" onclick="prolonger('${c.id}')">+1 an</button>`}
      </td></tr>`;
  }).join("");

  return enveloppeHtml("Administration", `
<h1>Espaces</h1>
<div class="carte" style="margin-top:16px">
  <input id="nom" placeholder="Nom de la personne">
  <label style="display:flex;align-items:center;gap:8px;margin:12px 0">
    <input type="checkbox" id="gratuit" style="width:auto"> Gratuit
  </label>
  <button onclick="creer()" style="width:100%">Créer l'espace</button>
  <div id="resultat" style="margin-top:12px"></div>
</div>
<h2>Liste</h2>
<div class="carte"><table>
  <tr><th>Personne</th><th>Échéance</th><th></th></tr>${lignes}
</table></div>
<script>
async function creer(){
  const nom=document.getElementById('nom').value.trim();
  if(!nom)return;
  const r=await fetch('/api/admin/creer',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({nom,gratuit:document.getElementById('gratuit').checked})});
  const d=await r.json();
  const lien=location.origin+'/'+d.code;
  document.getElementById('resultat').innerHTML=
    '<div class="info">Code <strong class="code">'+d.code+'</strong><br><span class="doux">'+lien+'</span><br>'+
    '<button class="plat" onclick="copier(\\''+lien+'\\')">Copier le lien</button></div>';
}
async function prolonger(id){
  await fetch('/api/admin/prolonger',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id})});
  location.reload();
}
function copier(t){navigator.clipboard.writeText(t);}
</script>`);
}

export function pageApp(s: { nom: string; salaire: number; epargne: number; acces: Acces }, e: any): string {
  const env_ = e.enveloppe;
  const pr = e.projection;

  const bandeau = s.acces.niveau === "lecture"
    ? `<div class="alerte">Ton accès est arrivé à échéance il y a ${s.acces.joursDepasses} jours. Consultation seule.</div>`
    : s.acces.niveau === "bientot"
      ? `<div class="info">Accès à renouveler dans ${s.acces.joursRestants} jours.</div>`
      : "";

  const alerteRythme = pr.ecart < 0
    ? `<div class="alerte"><strong>À ce rythme : ${chf(pr.ecart)} CHF le ${pr.joursDuMois}.</strong>${
        pr.jourDeRupture ? `<br>À sec le ${pr.jourDeRupture}.` : ""}</div>`
    : "";

  const cats = e.categories.map((c: any) => {
    const n = c.systeme === 1 ? "special" : niveau(c.depense, c.budget);
    const pct = c.budget ? Math.min(100, (c.depense / c.budget) * 100) : 0;
    const couleur = c.systeme === 1 ? "var(--special)"
      : n === "exces" ? "var(--exces)" : n === "attention" ? "var(--attention)" : "var(--ok)";
    return `<div class="rang" style="display:block">
      <div style="display:flex;justify-content:space-between">
        <span>${c.nom}</span>
        <strong class="${n}">${chf(c.depense)}${c.budget ? ` <span class="doux">/ ${chf(c.budget)}</span>` : ""}</strong>
      </div>
      ${c.budget ? `<div class="barre"><i style="width:${pct}%;background:${couleur}"></i></div>` : ""}
    </div>`;
  }).join("");

  return enveloppeHtml("Enveloppe", `
<h1>${s.nom}</h1>
${bandeau}${alerteRythme}
<div class="carte">
  <div class="doux">Disponible ce mois</div>
  <div class="gros ${env_.disponible < 0 ? "exces" : ""}">${chf(env_.disponible)}</div>
  <div class="doux" style="margin-top:8px">
    Salaire ${chf(env_.salaire)} − fixes ${chf(env_.fixes)} (${env_.pctFixes.toFixed(0)} %)
    − épargne ${chf(env_.epargne)} (${env_.pctEpargne.toFixed(0)} %)
  </div>
</div>
${e.aVerifier > 0 ? `<div class="info">${e.aVerifier} ligne${e.aVerifier > 1 ? "s" : ""} à vérifier.</div>` : ""}
<div class="zone" id="zone">
  Glisse un ticket ou une capture d'écran<br>
  <span class="doux">ou colle avec Ctrl+V, ou touche pour photographier</span>
  <input type="file" id="fic" accept="image/*" hidden>
</div>
<h2>Catégories</h2>
<div class="carte">${cats}</div>
<script>
const zone=document.getElementById('zone'),fic=document.getElementById('fic');
zone.onclick=()=>fic.click();
fic.onchange=()=>fic.files[0]&&envoyer(fic.files[0]);
['dragenter','dragover'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.add('actif')}));
['dragleave','drop'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.remove('actif')}));
zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)envoyer(f)});
document.addEventListener('paste',e=>{
  for(const it of e.clipboardData.items){if(it.type.startsWith('image/'))envoyer(it.getAsFile())}
});
async function envoyer(f){
  zone.textContent='Lecture en cours…';
  const fd=new FormData();fd.append('image',f);
  const r=await fetch('/api/scan',{method:'POST',body:fd});
  if(!r.ok){zone.textContent='Échec de la lecture. Réessaie.';return}
  location.reload();
}
</script>`);
}
