import type { AnalysisResult } from "./types";

const DATABASE_NAME = "voiceact-local-audio";
const STORE_NAME = "attempts";
const DATABASE_VERSION = 1;
const MAX_ATTEMPTS = 30;

export type StoredVoiceAttempt = {
  id: string;
  lessonId: string;
  createdAt: string;
  blob: Blob;
  analysis: AnalysisResult;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponible"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Stockage audio inaccessible"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Ecriture audio interrompue"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Ecriture audio annulee"));
  });
}

async function pruneOldAttempts(database: IDBDatabase) {
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  const records = await new Promise<StoredVoiceAttempt[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as StoredVoiceAttempt[]);
    request.onerror = () => reject(request.error);
  });

  records
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(MAX_ATTEMPTS)
    .forEach((record) => store.delete(record.id));
  await waitForTransaction(transaction);
}

export async function saveVoiceAttempt(record: StoredVoiceAttempt) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await waitForTransaction(transaction);
    await pruneOldAttempts(database);
  } finally {
    database.close();
  }
}

export async function loadVoiceAttempt(id: string): Promise<StoredVoiceAttempt | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as StoredVoiceAttempt | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
