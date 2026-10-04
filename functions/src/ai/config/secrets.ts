import { defineSecret } from "firebase-functions/params";

/**
 * Chave do provedor de IA (uma só, para o perfil ativo).
 *
 * Produção: `firebase functions:secrets:set AI_API_KEY`.
 * A Cloud Function que usar o client precisa declarar o segredo:
 *
 *   onCall({ secrets: aiSecrets() }, ...)
 *
 * No emulador o segredo não é declarado: a chave (opcional) vem de
 * `functions/.env.local`, e sem ela o client usa o mock.
 */
export const AI_API_KEY = defineSecret("AI_API_KEY");

export function aiSecrets() {
  return process.env.FUNCTIONS_EMULATOR === "true" ? [] : [AI_API_KEY];
}
