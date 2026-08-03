/**
 * Variáveis carregadas ANTES de qualquer import do Firebase nos testes
 * de integração. Aponta o SDK e o Admin para os emulators locais.
 */
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "split-play.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "split-play";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "split-play.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:integration";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST = "127.0.0.1:5001";
