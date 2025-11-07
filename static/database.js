
const DB_NAME = 'OptiholDB';
const DB_VERSION = 1;
const PROFILE_STORE_NAME = 'user_profile';
const DRINKS_STORE_NAME = 'drinks';

let db;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE_NAME)) {
        db.createObjectStore(PROFILE_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DRINKS_STORE_NAME)) {
        const drinksStore = db.createObjectStore(DRINKS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        drinksStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject('Error opening database');
    };
  });
}

async function saveProfile(profile) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(PROFILE_STORE_NAME);
    const request = store.put({ id: 1, ...profile });

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Error saving profile: ' + event.target.error);
  });
}

async function getProfile() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(PROFILE_STORE_NAME);
    const request = store.get(1);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      reject('Error getting profile: ' + event.target.error);
    };
  });
}

async function addDrink(drink) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRINKS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(DRINKS_STORE_NAME);
    const request = store.add(drink);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Error adding drink: ' + event.target.error);
  });
}

async function getDrinksForPeriod(startTime, endTime) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRINKS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(DRINKS_STORE_NAME);
    const index = store.index('timestamp');
    const range = IDBKeyRange.bound(startTime, endTime);
    const request = index.getAll(range);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      reject('Error getting drinks: ' + event.target.error);
    };
  });
}

async function clearAllData() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PROFILE_STORE_NAME, DRINKS_STORE_NAME], 'readwrite');
        const profileStore = transaction.objectStore(PROFILE_STORE_NAME);
        const drinksStore = transaction.objectStore(DRINKS_STORE_NAME);

        const clearProfileRequest = profileStore.clear();
        const clearDrinksRequest = drinksStore.clear();

        let completed = 0;
        const total = 2;

        const onComplete = () => {
            completed++;
            if (completed === total) {
                resolve();
            }
        };

        clearProfileRequest.onsuccess = onComplete;
        clearProfileRequest.onerror = (event) => reject('Error clearing profile store: ' + event.target.error);

        clearDrinksRequest.onsuccess = onComplete;
        clearDrinksRequest.onerror = (event) => reject('Error clearing drinks store: ' + event.target.error);

        transaction.oncomplete = () => {
            // This is not strictly necessary with the counter, but good practice
            if (completed < total) {
                console.warn("Transaction completed, but not all clear requests may have succeeded.");
            }
        };
        transaction.onerror = (event) => {
            reject('Transaction error during clear: ' + event.target.error);
        };
    });
}


window.db = {
  saveProfile,
  getProfile,
  addDrink,
  getDrinksForPeriod,
  clearAllData,
};
