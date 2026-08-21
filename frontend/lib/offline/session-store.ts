import { fromStoredSession, type StoredSession } from "@/lib/offline/types";
import { openDatabase, requestResult, transactionDone } from "@/lib/offline/idb";

export async function saveStoredSession(session: StoredSession): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("sessions", "readwrite");
  const store = transaction.objectStore("sessions");
  store.put(session);
  await transactionDone(transaction);
}

export async function loadStoredSession(key: string): Promise<StoredSession | null> {
  const db = await openDatabase();
  const transaction = db.transaction("sessions", "readonly");
  const store = transaction.objectStore("sessions");
  const value = await requestResult(store.get(key));
  await transactionDone(transaction);
  return fromStoredSession(value);
}

export async function updateStoredSession(
  key: string,
  patch: Partial<StoredSession>,
): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("sessions", "readwrite");
  const store = transaction.objectStore("sessions");
  const current = (await requestResult(store.get(key))) as StoredSession | undefined;
  if (current) {
    store.put({ ...current, ...patch, key, updatedAt: new Date().toISOString() });
  }
  await transactionDone(transaction);
}

export async function clearStoredSession(key: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("sessions", "readwrite");
  const store = transaction.objectStore("sessions");
  store.delete(key);
  await transactionDone(transaction);
}
