import {
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { ensureUserDoc } from "@/lib/services/userService";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "split-play";

export async function clearEmulators(): Promise<void> {
  await Promise.all([
    fetch(
      `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" },
    ),
    fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`,
      { method: "DELETE" },
    ),
  ]);

  if (auth.currentUser) {
    await signOut(auth);
  }
}

export async function createRegisteredUser(
  email: string,
  displayName: string,
  password = "senha123",
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await ensureUserDoc(credential.user, displayName);
  return credential.user;
}

export async function signOutCurrent(): Promise<void> {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export async function waitFor(
  predicate: () => Promise<boolean>,
  {
    timeoutMs = 15000,
    intervalMs = 250,
    label = "condição",
  }: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout esperando: ${label}`);
}

export async function getParticipantData(tableId: string, uid: string) {
  const snap = await getDoc(doc(db, "tables", tableId, "participants", uid));
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

export async function getTableData(tableId: string) {
  const snap = await getDoc(doc(db, "tables", tableId));
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

export async function getUserData(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

export async function getItemData(tableId: string, itemId: string) {
  const snap = await getDoc(doc(db, "tables", tableId, "items", itemId));
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

/** Aguarda a Cloud Function recalcular o total do participante. */
export async function waitForTotalCents(
  tableId: string,
  uid: string,
  expected: number,
): Promise<void> {
  await waitFor(
    async () => {
      const data = await getParticipantData(tableId, uid);
      return Number(data?.totalCents ?? -1) === expected;
    },
    { label: `totalCents === ${expected} para ${uid}` },
  );
}
