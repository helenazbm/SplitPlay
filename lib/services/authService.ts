import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  deleteUserData,
  ensureUserDoc,
  promoteUserToRegistered,
} from "@/lib/services/userService";

type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  avatarUrl?: string | null;
};

type SignInInput = {
  email: string;
  password: string;
};

export async function signUpWithEmail({
  email,
  password,
  displayName,
  avatarUrl,
}: SignUpInput) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName || avatarUrl) {
    await updateProfile(credential.user, {
      ...(displayName ? { displayName } : {}),
      ...(avatarUrl ? { photoURL: avatarUrl } : {}),
    });
  }

  await ensureUserDoc(credential.user, displayName, avatarUrl);
  return credential.user;
}

/**
 * Converte a conta anônima atual em uma conta registrada (e-mail + senha),
 * preservando o mesmo uid e todos os dados (mesa atual, participações, etc.).
 */
export async function upgradeAnonymousAccount({
  email,
  password,
}: SignInInput) {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  if (!current.isAnonymous) {
    throw new Error("Esta conta já está registrada.");
  }

  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(current, credential);

  await promoteUserToRegistered(result.user);
  return result.user;
}

export async function signInWithEmail({ email, password }: SignInInput) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(credential.user);
  return credential.user;
}

/**
 * Altera a senha da conta registrada atual. O Firebase pode exigir login
 */
export async function updateUserPassword(newPassword: string) {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  if (current.isAnonymous) {
    throw new Error("Conta de convidado não possui senha.");
  }

  await updatePassword(current, newPassword);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function deleteAccount() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }

  await deleteUserData(current.uid);
  await deleteUser(current);
}

const FIREBASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "Esse e-mail já está em uso.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "Senha muito fraca (mínimo 6 caracteres).",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "Usuário não encontrado.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/operation-not-allowed":
    "Método de login não habilitado no Firebase Console.",
  "auth/network-request-failed": "Falha de rede. Verifique sua conexão.",
  "auth/requires-recent-login":
    "Por segurança, faça login novamente antes de excluir a conta.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (typeof console !== "undefined") {
    console.error("[auth]", error);
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code in FIREBASE_AUTH_ERROR_MESSAGES) {
      return FIREBASE_AUTH_ERROR_MESSAGES[code];
    }
    return `Algo deu errado (${code}). Tente novamente.`;
  }
  return "Algo deu errado. Tente novamente.";
}
