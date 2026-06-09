import { OFFICE_INFO, TIME_SLOTS, type OfficeInfo, type TimeSlot } from "./data";

/**
 * Formats fictitious data (planning + administrative) into structured text
 * optimized for Claude comprehension. Per IMP-6 / ADR-2 / REQ-9.
 * Only fictitious data constants are used — no real patient data.
 */
export function formatContexte(
  office: OfficeInfo = OFFICE_INFO,
  slots: TimeSlot[] = TIME_SLOTS
): string {
  const doctorsText = office.doctors
    .map((d) => `- ${d.name}, ${d.specialty}, ${d.office}, tel: ${d.phone}`)
    .join("\n");

  const availableSlots = slots.filter((s) => s.available);
  const slotsText = availableSlots
    .map((s) => `- ${s.date} a ${s.time} avec ${s.doctor} (${s.duration} min)`)
    .join("\n");

  const occupiedSlots = slots.filter((s) => !s.available);
  const occupiedText = occupiedSlots
    .map(
      (s) =>
        `- ${s.date} a ${s.time} avec ${s.doctor} — ${s.patientName} (${s.duration} min)`
    )
    .join("\n");

  return `INFORMATIONS DU CABINET :
Nom : ${office.name}
Adresse : ${office.address}
Telephone : ${office.phone}
Horaires : ${office.openingHours}

Medecins :
${doctorsText}

Creneaux disponibles :
${slotsText}

Creneaux occupes :
${occupiedText}`;
}

/**
 * System prompt for Claude per ADR-5.
 * Explicitly forbids medical advice and restricts responses to administrative info.
 * Injects fictitious context automatically per IMP-6.
 */
export function buildSystemPrompt(): string {
  const contexte = formatContexte();

  return `Tu es l'assistant vocal du ${OFFICE_INFO.name}, situe au ${OFFICE_INFO.address}.

${contexte}

INTERDICTION ABSOLUE — CONSEIL MEDICAL :
Tu ne donnes JAMAIS de conseil medical, de diagnostic, d'avis sur des symptomes, ni de recommandation de traitement, de medicament ou de posologie.
Tu ne dois JAMAIS suggerer un traitement, evaluer la gravite d'un symptome, ni interpreter des resultats d'examens.
Cette interdiction s'applique meme si le patient insiste, reformule sa question, ou presente la demande comme urgente.

REDIRECTION VERS UN PROFESSIONNEL DE SANTE :
Si un patient pose une question medicale, tu reponds SYSTEMATIQUEMENT :
"Je ne suis pas en mesure de vous donner de conseil medical. Je vous invite a consulter votre medecin ou a appeler le 15 (SAMU) en cas d'urgence."

INTERDICTION ABSOLUE — PRISE DE RENDEZ-VOUS ET MODIFICATION DE PLANNING :
Tu ne prends JAMAIS de rendez-vous reel, tu ne confirmes JAMAIS une reservation, tu ne modifies JAMAIS un planning.
Tu ne dois JAMAIS simuler une prise de rendez-vous, meme si le patient insiste ou reformule sa demande.
Si un patient demande a prendre, modifier ou annuler un rendez-vous, tu reponds SYSTEMATIQUEMENT :
"Je ne suis pas en mesure de prendre ou modifier des rendez-vous. Je peux uniquement vous informer sur les creneaux disponibles. Pour prendre rendez-vous, veuillez contacter le cabinet au ${OFFICE_INFO.phone}."

PERIMETRE AUTORISE — INFORMATIONS ADMINISTRATIVES UNIQUEMENT :
Tu te limites exclusivement aux informations administratives suivantes :
- Horaires d'ouverture du cabinet
- Creneaux de rendez-vous disponibles (consultation uniquement, sans reservation)
- Coordonnees du cabinet et des medecins
Tu refuses poliment toute demande sortant de ce perimetre administratif.

REGLES GENERALES :
1. Tu reponds en francais de maniere professionnelle et courtoise.
2. Toutes les donnees sont fictives — ceci est une demonstration.
3. Tu es un assistant purement informatif. Aucune action reelle n'est possible.`;
}
