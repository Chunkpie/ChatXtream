import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface ChatDB extends DBSchema {
    localState: {
        key: string;
        value: any;
    };
    // Future stores for messages, contacts, etc.
}

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<ChatDB>('anonymous-chat-db', 1, {
            upgrade(db) {
                db.createObjectStore('localState');
            },
        });
    }
    return dbPromise;
};

export const saveLocalState = async (key: string, value: any) => {
    const db = await getDB();
    await db.put('localState', value, key);
};

export const getLocalState = async (key: string) => {
    const db = await getDB();
    return db.get('localState', key);
};

export const hasLocalState = async (key: string): Promise<boolean> => {
    const db = await getDB();
    const keys = await db.getAllKeys('localState');
    return keys.includes(key);
};
