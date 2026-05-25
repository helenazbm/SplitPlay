import { updateProfile, type User as FirebaseUser } from "firebase/auth";
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

const AVATAR_PATH = (uid: string) => `users/${uid}/avatar/profile`;

function requireCurrentUser(): FirebaseUser {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

export async function ensureUserDoc(
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

export async function deleteUserData(uid: string) {
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
}
