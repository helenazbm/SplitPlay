import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = getAuth();
const db = getFirestore();

// Função para verificar token do Firebase
export const verifyFirebaseToken = async (token: string) => {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return { success: true, user: decodedToken };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Função para definir role como custom claim
export const setUserRole = async (uid: string, role: string) => {
  try {
    await adminAuth.setCustomUserClaims(uid, { role });
    return { success: true };
  } catch (error) {
    console.error("Erro ao definir role:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const syncUserRole = async (uid: string, role: string) => {
  try {
    // 1. Definir custom claim no Firebase Auth
    const setRoleResult = await setUserRole(uid, role);
    
    if (!setRoleResult.success) {
      return { success: false, error: setRoleResult.error };
    }

    // 2. Atualizar documento no Firestore
    await db.collection("users").doc(uid).update({
      role: role
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao sincronizar role:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
