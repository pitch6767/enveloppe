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
- Une ligne par article. Ne regroupe pas.
- L'alcool et le tabac ne vont JAMAIS dans Nourriture, même achetés au supermarché.
- Les frais de port, frais de dossier et taxes vont dans Divers.
- Ignore les rabais globaux, les points de fidélité et le rendu de monnaie.
- Si le total du ticket ne correspond pas à la somme des lignes, garde le total imprimé.
- confiance : 0 à 1. Sous 0.6 la ligne sera revue à la main, ne force pas.
- Montants en CHF, nombres décimaux, pas de symbole monétaire.
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
