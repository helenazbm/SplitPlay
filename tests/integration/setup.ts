import { connectFirebaseEmulators } from "@/lib/firebase";

import { clearEmulators } from "./helpers";

connectFirebaseEmulators();

beforeEach(async () => {
  await clearEmulators();
});
