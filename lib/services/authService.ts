import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { deleteUserData, ensureUserDoc } from "@/lib/services/userService";

type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
};

type SignInInput = {
  email: string;
  password: string;
};

export async function signUpWithEmail({
  email,
  password,
  displayName,
}: SignUpInput) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  await ensureUserDoc(credential.user, displayName);
  return credential.user;
}

export async function signInWithEmail({ email, password }: SignInInput) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(credential.user);
  return credential.user;
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
