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
