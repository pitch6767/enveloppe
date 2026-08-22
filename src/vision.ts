// Extraction et classification d'un ticket ou d'une capture de confirmation.

export interface CategorieRow {
  id: string;
  nom: string;
  description: string;
}

export interface LigneExtraite {
  libelle: string;
  montant: number;
  categorie: string;
  confiance: number;
}

export interface TicketExtrait {
  marchand: string | null;
  date: string | null;
  total: number;
  lignes: LigneExtraite[];
}

/** Le prompt est reconstruit à chaque scan depuis la table `categories` du compte. */
export function construirePrompt(categories: CategorieRow[]): string {
  const liste = categories
    .map((c) => `- ${c.nom} — ${c.description}`)
    .join("\n");

  return `Tu analyses l'image d'un ticket de caisse OU la capture d'écran d'une confirmation de commande en ligne.

Catégories disponibles pour ce foyer :
${liste}

Règles :
- Une ligne par article acheté. Ne regroupe pas.
- RABAIS : si une ligne de rabais, remise ou « offre spéciale » suit un article,
  soustrais-la du prix de cet article et ne crée pas de ligne séparée.
  Exemple : « DYSON 849.00 » puis « Offre Spéciale -250.00 » donne une seule
  ligne DYSON à 599.00.
- Ignore les lignes techniques : numéros d'article, codes-barres, sous-totaux,
  points de fidélité, rendu de monnaie, mentions de panier.
- MONNAIE : si le ticket affiche plusieurs devises, retiens le total en francs
  suisses (CHF, noté parfois « f »), pas la conversion en euros.
- L'alcool et le tabac ne vont JAMAIS dans Nourriture, même achetés au supermarché.
- Les frais de port, frais de dossier et taxes vont dans Divers.
- Si le total imprimé ne correspond pas à la somme des lignes, garde le total imprimé.
- confiance : 0 à 1. Mets une confiance BASSE (sous 0.5) dès que tu hésites entre
  deux catégories ou que l'article ne correspond clairement à aucune. Ne devine pas :
  une ligne peu sûre sera soumise à la personne, c'est le comportement voulu.
- Montants en nombres décimaux, sans symbole monétaire.
- Dates au format AAAA-MM-JJ.

Réponds UNIQUEMENT avec cet objet JSON, sans texte autour, sans balises Markdown :
{"marchand":"...","date":"AAAA-MM-JJ","total":0.00,"lignes":[{"libelle":"...","montant":0.00,"categorie":"...","confiance":0.0}]}`;
}

export async function analyserImage(
  apiKey: string,
  base64: string,
  mediaType: string,
  categories: CategorieRow[],
): Promise<TicketExtrait> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: construirePrompt(categories) },
        ],
      }],
    }),
  });

  if (!r.ok) throw new Error(`Vision ${r.status}: ${await r.text()}`);

  const data = await r.json<any>();
  const texte = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return parserReponse(texte);
}

/** Le modèle glisse parfois des backticks malgré la consigne. */
export function parserReponse(texte: string): TicketExtrait {
  const net = texte.replace(/```json/gi, "").replace(/```/g, "").trim();
  const debut = net.indexOf("{");
  const fin = net.lastIndexOf("}");
  if (debut === -1 || fin === -1) throw new Error("Réponse Vision illisible");

  const brut = JSON.parse(net.slice(debut, fin + 1));

  return {
    marchand: brut.marchand ?? null,
    date: brut.date ?? null,
    total: Number(brut.total) || 0,
    lignes: (brut.lignes ?? []).map((l: any) => ({
      libelle: String(l.libelle ?? "").trim(),
      montant: Number(l.montant) || 0,
      categorie: String(l.categorie ?? "Divers"),
      confiance: typeof l.confiance === "number" ? l.confiance : 0,
    })),
  };
}

export interface Elucidation {
  libelle: string;
  categorie: string;
  confiance: number;
  quoi: string;
}

/**
 * Deuxième passe sur les seules lignes incertaines : le modèle cherche sur le web
 * ce qu'est le produit avant de trancher. Une seule requête pour toutes les lignes.
 */
export function construirePromptRecherche(libelles: string[], categories: CategorieRow[]): string {
  const liste = categories.map((c) => `- ${c.nom} — ${c.description}`).join("\n");
  const articles = libelles.map((l, i) => `${i + 1}. ${l}`).join("\n");

  return `Voici des libellés d'articles relevés sur des tickets de caisse suisses. Ils sont
abrégés et je n'ai pas su les classer.

Pour chacun, cherche sur le web de quel produit il s'agit (marque, modèle, type d'objet),
puis range-le dans une des catégories ci-dessous.

Articles :
${articles}

Catégories :
${liste}

Si après recherche le produit reste indéterminé, mets une confiance basse plutôt que
d'inventer : la personne tranchera elle-même.

Réponds UNIQUEMENT avec ce JSON, sans texte autour, sans balises Markdown :
{"resultats":[{"libelle":"le libellé d'origine, recopié tel quel","quoi":"ce que c'est en trois mots","categorie":"...","confiance":0.0}]}`;
}

export async function elucider(
  apiKey: string,
  libelles: string[],
  categories: CategorieRow[],
): Promise<Elucidation[]> {
  if (!libelles.length) return [];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: construirePromptRecherche(libelles, categories) }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
    }),
  });

  if (!r.ok) throw new Error(`Recherche ${r.status}: ${await r.text()}`);

  const data = await r.json<any>();
  const texte = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return parserElucidation(texte);
}

export function parserElucidation(texte: string): Elucidation[] {
  const net = texte.replace(/```json/gi, "").replace(/```/g, "").trim();
  const debut = net.indexOf("{");
  const fin = net.lastIndexOf("}");
  if (debut === -1 || fin === -1) return [];

  try {
    const brut = JSON.parse(net.slice(debut, fin + 1));
    return (brut.resultats ?? []).map((x: any) => ({
      libelle: String(x.libelle ?? "").trim(),
      categorie: String(x.categorie ?? ""),
      confiance: typeof x.confiance === "number" ? x.confiance : 0,
      quoi: String(x.quoi ?? "").trim(),
    }));
  } catch {
    // La recherche est un bonus : si elle échoue, la ligne part au classement manuel.
    return [];
  }
}
