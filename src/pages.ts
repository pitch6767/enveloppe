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
  const badge = (c: any) => {
    if (c.statut === "exempt") return `<span style="background:var(--accent);color:#fff;padding:2px 8px;border-radius:10px;font-size:.7rem">offert</span>`;
    if (c.acces?.niveau === "lecture") return `<span style="background:var(--exces);color:#fff;padding:2px 8px;border-radius:10px;font-size:.7rem">échu</span>`;
    if (c.acces?.niveau === "bientot") return `<span style="background:var(--attention);color:#fff;padding:2px 8px;border-radius:10px;font-size:.7rem">${c.acces.joursRestants} j</span>`;
    if (c.statut === "archive") return `<span style="background:var(--doux);color:#fff;padding:2px 8px;border-radius:10px;font-size:.7rem">archivé</span>`;
    return `<span style="background:var(--ok);color:#fff;padding:2px 8px;border-radius:10px;font-size:.7rem">actif</span>`;
  };

  const lignes = comptes.map((c) => `<tr>
      <td><strong>${c.nom}</strong><br>
        <span class="doux code" style="font-size:.9rem">${c.code}</span><br>
        <input readonly value="${base}/${c.code}" onclick="this.select()"
               style="font-size:.75rem;padding:4px;margin-top:4px;width:100%;min-width:180px;color:var(--doux)"></td>
      <td>${c.tickets ?? 0}</td>
      <td>${c.statut === "exempt" ? "—" : (c.expire_le ?? "—")}<br>${badge(c)}</td>
      <td style="white-space:nowrap">
        <button class="plat" onclick="copier('${base}/${c.code}',this)">Copier le lien</button><br>
        <button class="plat" onclick="changerCode('${c.id}','${c.code}')">Changer le code</button><br>
        ${c.statut === "exempt" ? "" : `
        <select id="d_${c.id}" style="width:auto;padding:4px;font-size:.8rem">
          <option value="6">6 mois</option><option value="12" selected>12 mois</option><option value="24">24 mois</option>
        </select>
        <button class="plat" onclick="prolonger('${c.id}')">Prolonger</button><br>
        <button class="plat" onclick="offrir('${c.id}')">Rendre gratuit</button>`}
      </td></tr>`).join("");

  const payants = comptes.filter((c) => c.statut === "actif").length;

  return enveloppeHtml("Administration", `
<h1>Espaces</h1>
<p class="doux">${comptes.length} espace${comptes.length > 1 ? "s" : ""}, dont ${payants} payant${payants > 1 ? "s" : ""} — ${payants * 65} CHF par an.</p>

<div class="carte" style="margin-top:16px">
  <input id="nom" placeholder="Nom de la personne">
  <label style="display:flex;align-items:center;gap:8px;margin:12px 0">
    <input type="checkbox" id="gratuit" style="width:auto"> Gratuit, sans échéance
  </label>
  <button onclick="creer()" style="width:100%">Créer l'espace</button>
  <div id="resultat" style="margin-top:12px"></div>
</div>

<h2>Liste</h2>
<div class="carte" style="overflow-x:auto"><table>
  <tr><th>Personne</th><th>Tickets</th><th>Jusqu'au</th><th></th></tr>${lignes}
</table></div>
<script>
let dernierLien='';
const BASE=${JSON.stringify(base)};
async function creer(){
  const nom=document.getElementById('nom').value.trim();
  if(!nom){alert('Indique un nom.');return}
  const r=await fetch('/api/admin/creer',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({nom,gratuit:document.getElementById('gratuit').checked})});
  const d=await r.json();
  if(!r.ok){alert(d.erreur||'Échec');return}
  dernierLien=BASE+'/'+d.code;
  const boite=document.getElementById('resultat');
  boite.innerHTML='';
  const cadre=document.createElement('div');
  cadre.className='info';
  const t=document.createElement('div');
  t.innerHTML='Code <strong class="code">'+d.code+'</strong>';
  const u=document.createElement('input');
  u.readOnly=true;
  u.value=dernierLien;
  u.style.width='100%';
  u.style.fontSize='.8rem';
  u.style.marginTop='6px';
  u.onclick=()=>u.select();
  const b=document.createElement('button');
  b.className='plat';
  b.textContent='Copier le lien';
  b.onclick=()=>copier(dernierLien,b);
  cadre.append(t,u,b);
  boite.append(cadre);
}
async function prolonger(id){
  const mois=+document.getElementById('d_'+id).value;
  const r=await fetch('/api/admin/prolonger',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id,mois})});
  if(!r.ok){alert('Échec');return}
  location.reload();
}
async function changerCode(id,actuel){
  const voulu=prompt('Nouveau code à six chiffres pour cet espace :',actuel);
  if(!voulu)return;
  const r=await fetch('/api/admin/code',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id,code:voulu})});
  const d=await r.json();
  if(!r.ok){alert(d.erreur||'Échec');return}
  alert('Nouveau code : '+d.code+' — le lien précédent ne fonctionne plus, renvoie le nouveau à la personne.');
  location.reload();
}
async function offrir(id){
  if(!confirm('Rendre cet espace gratuit et sans échéance ?'))return;
  await fetch('/api/admin/gratuit',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id})});
  location.reload();
}
function retour(bouton){
  if(!bouton)return;
  const avant=bouton.textContent;
  bouton.textContent='Copié';
  setTimeout(()=>{bouton.textContent=avant},1500);
}
function copier(t,bouton){
  // navigator.clipboard échoue selon le navigateur et le contexte : on garde deux replis.
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(t).then(()=>retour(bouton),()=>vieilleCopie(t,bouton));
  }else{
    vieilleCopie(t,bouton);
  }
}
function vieilleCopie(t,bouton){
  const z=document.createElement('textarea');
  z.value=t;
  z.style.position='fixed';
  z.style.opacity='0';
  document.body.appendChild(z);
  z.focus();z.select();
  let ok=false;
  try{ok=document.execCommand('copy')}catch(e){ok=false}
  document.body.removeChild(z);
  if(ok)retour(bouton); else prompt('Copie ce lien à la main :',t);
}
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

  const note = e.horsRythme > 0
    ? `<div class="doux" style="margin:-4px 0 12px">Rythme calculé sur ${chf(e.totalDepense - e.horsRythme)}, hors ${chf(e.horsRythme)} d'achats exceptionnels.</div>`
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
${bandeau}${alerteRythme}${note}
<div class="carte">
  <div class="doux">Disponible ce mois</div>
  <div class="gros ${env_.disponible < 0 ? "exces" : ""}">${chf(env_.disponible)}</div>
  <div class="doux" style="margin-top:8px">
    Salaire ${chf(env_.salaire)} − fixes ${chf(env_.fixes)} (${env_.pctFixes.toFixed(0)} %)
    − épargne ${chf(env_.epargne)} (${env_.pctEpargne.toFixed(0)} %)
  </div>
</div>
${e.aVerifier > 0 ? `<div class="info"><a href="/classer" style="color:inherit"><strong>${e.aVerifier} ligne${e.aVerifier > 1 ? "s" : ""} à classer</strong> — touche ici pour choisir la catégorie.</a></div>` : ""}
<div style="display:flex;gap:8px;margin-bottom:12px">
  <button onclick="photo.click()" style="flex:1">Prendre une photo</button>
  <button onclick="fic.click()" style="flex:1;background:var(--accent)">Choisir un fichier</button>
</div>
<input type="file" id="photo" accept="image/*" capture="environment" hidden>
<div class="zone" id="zone">
  Glisse un ticket ou une capture d'écran<br>
  <span class="doux">ou colle avec Ctrl+V</span>
  <input type="file" id="fic" accept="image/*" hidden>
</div>
<h2>Catégories</h2>
<div class="carte">${cats}</div>
<div style="margin:16px 0 40px;display:flex;flex-direction:column;gap:8px">
  <a href="/depenses" style="color:var(--accent)">Corriger les dépenses</a>
  <a href="/categories" style="color:var(--accent)">Catégories et budgets</a>
  <a href="/reglages" style="color:var(--accent)">Salaire, charges fixes et épargne</a>
</div>
<script>
const zone=document.getElementById('zone'),fic=document.getElementById('fic'),photo=document.getElementById('photo');
zone.onclick=()=>fic.click();
fic.onchange=()=>fic.files[0]&&envoyer(fic.files[0]);
photo.onchange=()=>photo.files[0]&&envoyer(photo.files[0]);
['dragenter','dragover'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.add('actif')}));
['dragleave','drop'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.remove('actif')}));
zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)envoyer(f)});
document.addEventListener('paste',e=>{
  for(const it of e.clipboardData.items){if(it.type.startsWith('image/'))envoyer(it.getAsFile())}
});
async function reduire(f){
  // Les photos de téléphone dépassent souvent la limite de l'API.
  if(f.size < 900000) return f;
  const img=await createImageBitmap(f);
  const max=1600, e=Math.min(1, max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');
  c.width=Math.round(img.width*e); c.height=Math.round(img.height*e);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.85));
  return new File([b],'ticket.jpg',{type:'image/jpeg'});
}
async function envoyer(f){
  zone.textContent='Lecture en cours…';
  try{
    const fd=new FormData();
    fd.append('image', await reduire(f));
    const r=await fetch('/api/scan',{method:'POST',body:fd});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){zone.textContent='Échec : '+(d.erreur||('erreur '+r.status));return}
    location.href = d.aClasser>0 ? '/classer' : '/depenses';
  }catch(e){
    zone.textContent='Échec : '+e.message;
  }
}
</script>`);
}

export function pageReglages(s: { nom: string; salaire: number; epargne: number }, fixes: any[]): string {
  const total = fixes.reduce((a, f) => a + f.montant, 0);
  const lignes = fixes.map((f) => `<div class="rang">
    <span>${f.libelle}</span>
    <span><strong>${chf(f.montant)}</strong>
    <button class="plat" style="margin-left:12px" onclick="suppr('${f.id}')">×</button></span>
  </div>`).join("") || `<div class="doux">Aucune charge fixe.</div>`;

  return enveloppeHtml("Réglages", `
<h1>Réglages</h1>
<p class="doux"><a href="/" style="color:var(--accent)">← Retour</a></p>

<h2>Salaire et épargne</h2>
<div class="carte">
  <label class="doux">Salaire net mensuel</label>
  <input id="salaire" type="number" inputmode="decimal" value="${s.salaire || ""}" placeholder="5000">
  <label class="doux" style="display:block;margin-top:12px">Épargne à virer chaque mois</label>
  <input id="epargne" type="number" inputmode="decimal" value="${s.epargne || ""}" placeholder="1000">
  <div class="doux" id="pct" style="margin-top:8px"></div>
  <button onclick="enregistrer()" style="width:100%;margin-top:12px">Enregistrer</button>
</div>

<h2>Charges fixes — ${chf(total)}</h2>
<div class="carte">${lignes}</div>
<div class="carte">
  <input id="lib" placeholder="Loyer, assurance, abonnement…">
  <input id="mnt" type="number" inputmode="decimal" placeholder="Montant" style="margin-top:8px">
  <button onclick="ajouter()" style="width:100%;margin-top:12px">Ajouter</button>
</div>
<h2>Recommencer</h2>
<div class="carte">
  <button onclick="vider('depenses')" style="width:100%;background:var(--accent)">Effacer toutes les dépenses</button>
  <div class="doux" style="margin:6px 0 14px">Tickets et lignes effacés. Salaire, charges fixes, catégories, budgets et apprentissage conservés.</div>

  <button onclick="vider('apprentissage')" style="width:100%;background:var(--accent)">Oublier l'apprentissage</button>
  <div class="doux" style="margin:6px 0 14px">Les corrections mémorisées sont effacées. Les prochains tickets repartent de zéro pour le classement.</div>

  <button onclick="vider('tout')" style="width:100%;background:var(--exces)">Tout remettre à zéro</button>
  <div class="doux" style="margin-top:6px">Tout est effacé : dépenses, charges fixes, budgets, catégories ajoutées, salaire, épargne. Les catégories d'origine sont recréées. Ton code d'accès ne change pas.</div>
</div>

<script>
async function vider(portee){
  const textes={
    depenses:'Effacer toutes les dépenses ? Les réglages sont conservés.',
    apprentissage:"Oublier toutes les corrections mémorisées ?",
    tout:'TOUT remettre à zéro ? Dépenses, charges fixes, budgets, catégories et salaire seront effacés. Cette action est définitive.'
  };
  if(!confirm(textes[portee]))return;
  if(portee==='tout' && prompt('Pour confirmer, tape : EFFACER')!=='EFFACER')return;
  const r=await fetch('/api/vider',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({portee})});
  if(!r.ok){alert('Échec');return}
  location.href='/';
}
function maj(){
  const s=+document.getElementById('salaire').value||0, e=+document.getElementById('epargne').value||0;
  document.getElementById('pct').textContent = s>0 ? 'Épargne = '+(e/s*100).toFixed(0)+' % du salaire' : '';
}
document.getElementById('salaire').oninput=maj;
document.getElementById('epargne').oninput=maj;maj();
async function enregistrer(){
  await fetch('/api/reglages',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({salaire:+document.getElementById('salaire').value||0,
                         epargne:+document.getElementById('epargne').value||0})});
  location.href='/';
}
async function ajouter(){
  const libelle=document.getElementById('lib').value.trim();
  const montant=+document.getElementById('mnt').value||0;
  if(!libelle||!montant)return;
  await fetch('/api/fixe',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({libelle,montant})});
  location.reload();
}
async function suppr(id){
  await fetch('/api/fixe/'+id,{method:'DELETE'});
  location.reload();
}
</script>`);
}

export function pageDepenses(deps: any[], lignes: any[], cats: any[]): string {
  const options = (sel: string) => cats.map((c) =>
    `<option value="${c.id}"${c.id === sel ? " selected" : ""}>${c.nom}</option>`).join("");

  const blocs = deps.map((d) => {
    const mes = lignes.filter((l) => l.depense_id === d.id);
    const rangs = mes.map((l) => `
      <div class="rang" style="display:block" data-id="${l.id}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <span style="flex:1">${l.libelle}${l.confiance < 0.6 ? ' <span class="attention">•</span>' : ""}</span>
          <input type="number" step="0.05" value="${l.montant.toFixed(2)}"
                 style="width:90px;padding:6px;text-align:right"
                 onchange="majLigne('${l.id}',this.value,null)">
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <select style="flex:1;padding:6px" onchange="majLigne('${l.id}',null,this.value)">
            ${options(l.categorie_id)}
          </select>
          <button class="plat" onclick="scinder('${l.id}',${l.montant})">Scinder</button>
        </div>
      </div>`).join("");

    return `<h2>${d.date} — ${d.marchand ?? "sans nom"} — ${chf(d.total)}</h2>
      <div class="carte">${rangs || '<div class="doux">Aucune ligne.</div>'}
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:.9rem">
          <input type="checkbox" style="width:auto" ${d.exceptionnel ? "checked" : ""}
                 onchange="exceptionnel('${d.id}',this.checked)">
          Achat exceptionnel — compte dans le mois, pas dans le rythme
        </label>
        <button style="background:var(--exces);width:100%;margin-top:12px" onclick="supprDep('${d.id}')">Annuler ce ticket</button>
      </div>`;
  }).join("");

  return enveloppeHtml("Dépenses", `
<h1>Dépenses</h1>
<p class="doux"><a href="/" style="color:var(--accent)">← Retour</a></p>
${blocs || '<div class="carte doux">Aucune dépense enregistrée.</div>'}
<datalist id="cats">${cats.map((c) => `<option value="${c.nom}">`).join("")}</datalist>
<script>
const CATS=${JSON.stringify(cats.map((c) => ({ id: c.id, nom: c.nom })))};
async function majLigne(id,montant,categorie_id){
  const corps={};
  if(montant!==null)corps.montant=parseFloat(montant);
  if(categorie_id!==null)corps.categorie_id=categorie_id;
  const r=await fetch('/api/ligne/'+id,{method:'PATCH',headers:{'content-type':'application/json'},
    body:JSON.stringify(corps)});
  if(!r.ok){alert('Échec de la modification');return}
  location.reload();
}
async function scinder(id,total){
  const m=prompt('Quel montant déplacer vers une autre catégorie ? (max '+(total-0.05).toFixed(2)+')');
  if(!m)return;
  const noms=CATS.map((c,i)=>i+' = '+c.nom).join('\\n');
  const i=prompt('Vers quelle catégorie ?\\n\\n'+noms);
  if(i===null||!CATS[+i])return;
  const r=await fetch('/api/ligne/'+id+'/scinder',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({montant:parseFloat(m),categorie_id:CATS[+i].id})});
  if(!r.ok){const e=await r.json();alert(e.erreur||'Échec');return}
  location.reload();
}
async function exceptionnel(id,coche){
  await fetch('/api/depense/'+id,{method:'PATCH',headers:{'content-type':'application/json'},
    body:JSON.stringify({exceptionnel:coche})});
  location.reload();
}
async function supprDep(id){
  if(!confirm('Annuler ce ticket ? Toutes ses lignes seront effacées.'))return;
  await fetch('/api/depense/'+id,{method:'DELETE'});
  location.reload();
}
</script>`);
}

export function pageCategories(cats: any[]): string {
  const rangs = cats.map((c) => `
    <div class="rang" style="display:block">
      <div style="display:flex;gap:8px;align-items:center">
        <span style="flex:1">${c.nom}</span>
        <input type="number" step="10" placeholder="budget" value="${c.budget ?? ""}"
               style="width:100px;padding:8px;text-align:right"
               onchange="maj('${c.id}',this.value)">
      </div>
      <div class="doux" style="margin-top:4px;display:flex;justify-content:space-between">
        <span>Dépensé ${chf(c.depense)}${c.systeme === 1 ? " · catégorie verrouillée" : ""}</span>
        ${c.systeme === 1 ? "" : `<button class="plat" style="color:var(--exces)" onclick="suppr('${c.id}')">Supprimer</button>`}
      </div>
    </div>`).join("");

  return enveloppeHtml("Catégories", `
<h1>Catégories</h1>
<p class="doux"><a href="/" style="color:var(--accent)">← Retour</a></p>
<div class="carte">${rangs}</div>

<h2>Ajouter</h2>
<div class="carte">
  <input id="nom" placeholder="Nom, par exemple Vigne">
  <input id="desc" placeholder="Description : sulfate, piquets, sécateurs…" style="margin-top:8px">
  <input id="budget" type="number" placeholder="Budget mensuel (facultatif)" style="margin-top:8px">
  <div class="doux" style="margin-top:8px">La description sert à classer les tickets automatiquement. Sois concret.</div>
  <button onclick="ajouter()" style="width:100%;margin-top:12px">Ajouter</button>
</div>
<script>
async function maj(id,budget){
  await fetch('/api/categorie/'+id,{method:'PATCH',headers:{'content-type':'application/json'},
    body:JSON.stringify({budget:budget===''?null:parseFloat(budget)})});
  location.reload();
}
async function ajouter(){
  const nom=document.getElementById('nom').value.trim();
  const description=document.getElementById('desc').value.trim();
  if(!nom||!description){alert('Le nom et la description sont nécessaires.');return}
  await fetch('/api/categorie',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({nom,description,budget:document.getElementById('budget').value||null})});
  location.reload();
}
async function suppr(id){
  if(!confirm('Supprimer ? Les dépenses basculent dans Divers.'))return;
  await fetch('/api/categorie/'+id,{method:'DELETE'});
  location.reload();
}
</script>`);
}

export function pageClasser(lignes: any[], cats: any[]): string {
  if (!lignes.length) {
    return enveloppeHtml("Tout est classé", `
<h1>Tout est classé</h1>
<div class="carte doux">Aucune ligne en attente.</div>
<p><a href="/" style="color:var(--accent)">← Retour</a></p>`);
  }

  const boutons = (ligne: any) => cats.map((c) =>
    `<button class="choix" onclick="choisir('${ligne.id}','${c.id}')"
      style="background:${c.couleur};margin:4px 4px 0 0;padding:8px 12px;font-size:.85rem">${c.nom}</button>`,
  ).join("");

  const blocs = lignes.map((l) => `
    <div class="carte">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong>${l.libelle}</strong>
        <span class="gros" style="font-size:1.2rem">${chf(l.montant)}</span>
      </div>
      <div class="doux" style="margin:4px 0 10px">${l.marchand ?? ""} · ${l.date}</div>
      <div>${boutons(l)}</div>
      <button class="plat" style="color:var(--exces);margin-top:10px"
              onclick="annuler('${l.depense_id}')">Annuler tout ce ticket</button>
    </div>`).join("");

  return enveloppeHtml("À classer", `
<h1>Où ranger ?</h1>
<p class="doux">Je n'ai pas su décider seul. Touche la bonne catégorie — je m'en souviendrai la prochaine fois.</p>
${blocs}
<p style="margin:20px 0 40px"><a href="/" style="color:var(--accent)">← Retour</a></p>
<script>
async function choisir(ligne,categorie){
  const r=await fetch('/api/ligne/'+ligne,{method:'PATCH',headers:{'content-type':'application/json'},
    body:JSON.stringify({categorie_id:categorie})});
  if(!r.ok){alert('Échec');return}
  location.reload();
}
async function annuler(dep){
  if(!confirm('Annuler ce ticket ? Toutes ses lignes seront effacées.'))return;
  await fetch('/api/depense/'+dep,{method:'DELETE'});
  location.reload();
}
</script>`);
}
