import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { auth, db, storage } from "@/lib/firebase";
import type { User } from "@/lib/types/user";

const SIGNUP_BONUS_COINS = 10;

type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
};

type SignInInput = {
  email: string;
  password: string;
};

async function ensureUserDoc(
  firebaseUser: FirebaseUser,
  fallbackDisplayName?: string,
) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    return;
  }

  const displayName =
    fallbackDisplayName ??
    firebaseUser.displayName ??
    firebaseUser.email?.split("@")[0] ??
    "Jogador";

  await setDoc(ref, {
    uid: firebaseUser.uid,
    type: "registered",
    displayName,
    email: firebaseUser.email ?? null,
    coins: SIGNUP_BONUS_COINS,
    ownedItemIds: [],
    currentTableId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Omit<User, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  });
}

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

function requireCurrentUser(): FirebaseUser {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

export async function updateDisplayName(displayName: string) {
  const current = requireCurrentUser();
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("Nome não pode ficar vazio.");
  }

  await updateProfile(current, { displayName: trimmed });
  await updateDoc(doc(db, "users", current.uid), {
    displayName: trimmed,
    updatedAt: serverTimestamp(),
  });
}

const AVATAR_PATH = (uid: string) => `users/${uid}/avatar/profile`;

export async function uploadProfilePhoto(file: File) {
  const current = requireCurrentUser();
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Imagem maior que 5MB.");
  }

  const ref = storageRef(storage, AVATAR_PATH(current.uid));
  await uploadBytes(ref, file, { contentType: file.type });
  const photoURL = await getDownloadURL(ref);

  await updateProfile(current, { photoURL });
  await updateDoc(doc(db, "users", current.uid), {
    photoURL,
    updatedAt: serverTimestamp(),
  });

  return photoURL;
}

export async function deleteAccount() {
  const current = requireCurrentUser();
  const uid = current.uid;

  try {
    await deleteObject(storageRef(storage, AVATAR_PATH(uid)));
  } catch (err) {
    if (
      !err ||
      typeof err !== "object" ||
      !("code" in err) ||
      (err as { code: string }).code !== "storage/object-not-found"
    ) {
      throw err;
    }
  }

  await deleteDoc(doc(db, "users", uid));
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
