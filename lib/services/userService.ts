import { updateProfile, type User as FirebaseUser } from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { User } from "@/lib/types/user";

const SIGNUP_BONUS_COINS = 10;

function requireCurrentUser(): FirebaseUser {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

export async function getUserDoc(): Promise<User | null> {
  const current = requireCurrentUser();
  const snapshot = await getDoc(doc(db, "users", current.uid));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as User;
}

export async function ensureUserDoc(
  firebaseUser: FirebaseUser,
  fallbackDisplayName?: string,
  avatarUrl?: string | null,
) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    if (!firebaseUser.isAnonymous && snapshot.data().type === "anonymous") {
      await promoteUserToRegistered(firebaseUser);
    }
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
    avatarUrl: avatarUrl ?? firebaseUser.photoURL ?? null,
    coins: SIGNUP_BONUS_COINS,
    currentTableId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Omit<User, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  });
}

/**
 * Atualiza o doc do usuário após vincular credenciais a uma conta anônima:
 * marca como registrada e grava o e-mail. Demais campos são preservados.
 */
export async function promoteUserToRegistered(firebaseUser: FirebaseUser) {
  await updateDoc(doc(db, "users", firebaseUser.uid), {
    type: "registered",
    email: firebaseUser.email ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function reconcileRegisteredType(): Promise<void> {
  const current = auth.currentUser;
  if (!current || current.isAnonymous) {
    return;
  }

  const snapshot = await getDoc(doc(db, "users", current.uid));
  if (snapshot.exists() && snapshot.data().type === "anonymous") {
    await promoteUserToRegistered(current);
  }
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

export async function updateAvatar(avatarUrl: string | null) {
  const current = requireCurrentUser();
  // Vazio = "sem foto": limpa o photoURL/avatarUrl.
  const value = avatarUrl && avatarUrl.trim() ? avatarUrl : null;

  await updateProfile(current, { photoURL: value });
  await updateDoc(doc(db, "users", current.uid), {
    avatarUrl: value,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserData(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}
