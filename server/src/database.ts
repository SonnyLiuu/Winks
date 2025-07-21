import { MongoClient, Collection, ObjectId, Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { AppContext, Settings } from './types';

let client: MongoClient;
let db: Db;
let usersCollection: Collection;
let settingsCollection: Collection;
let connectionPromise: Promise<void> | null = null;

function connectToDatabase(c: AppContext): Promise<void> {
    if (!connectionPromise) {
        console.log('No existing connection promise, creating a new one.');
        connectionPromise = (async () => {
            try {
                console.log('Attempting to connect to database...');
                const uri = c.env.MONGO_URI;
                if (!uri) {
                    throw new Error('MONGO_URI is not defined in the environment variables.');
                }
                client = new MongoClient(uri);
                await client.connect();
                console.log('MongoDB client connected successfully');

                db = client.db(c.env.DB_NAME);
                usersCollection = db.collection('Profiles');
                settingsCollection = db.collection('Settings');
                console.log('Collections initialized');

                await Promise.all([
                    usersCollection.createIndex({ email: 1 }, { unique: true }),
                    settingsCollection.createIndex({ userId: 1 }, { unique: true, sparse: true })
                ]);
                console.log('Indexes created successfully');
            } catch (e) {
                console.error('Database connection failed:', e);
                connectionPromise = null; // Reset on error to allow retries
                throw e; // Re-throw to fail the operation
            }
        })();
    } else {
        console.log('Returning existing connection promise.');
    }
    return connectionPromise;
}

export async function getCollection(c: AppContext, collectionName: string): Promise<Collection> {
    await connectToDatabase(c);
    if (collectionName === 'Profiles') {
        return usersCollection;
    }
    if (collectionName === 'Settings') {
        return settingsCollection;
    }
    return db.collection(collectionName);
}

export async function createUser(c: AppContext, email, passwordPlain) {
    const users = await getCollection(c, 'Profiles');
    const settings = await getCollection(c, 'Settings');
    try {
        const hashedPassword = await bcrypt.hash(passwordPlain, 10);
        const result = await users.insertOne({ email, password: hashedPassword });
        const userId = result.insertedId;

        const defaultSettings: Settings = {
            leftWinkSensitivity: 0.50,
            rightWinkSensitivity: 0.50,
            yaw: 45,
            pitch: 45,
            deadZone: 6,
            tiltAngle: 20,
        };
        await settings.insertOne({ userId: userId, ...defaultSettings });

        return {
            success: true,
            message: 'User created successfully',
            user: {
                id: userId.toHexString(),
                email: email,
                settings: defaultSettings
            }
        };
    } catch (error) {
        if (error.code === 11000) {
            return { success: false, message: 'Email already registered' };
        }
        return { success: false, message: 'Failed to create user' };
    }
}

export async function verifyUser(c: AppContext, email, passwordPlain) {
    console.log('verifyUser called with email:', email);
    try {
        const collection = await getCollection(c, 'Profiles');
        console.log('Got Profiles collection');

        const user = await collection.findOne({ email });
        console.log('User lookup result:', user ? 'found' : 'not found');

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const isPasswordValid = await bcrypt.compare(passwordPlain, user.password);
        if (!isPasswordValid) {
            return { success: false, message: 'Invalid credentials' };
        }

        const settingsCollection = await getCollection(c, 'Settings');
        const userSettings = await settingsCollection.findOne({ userId: user._id });
        console.log('Settings lookup result:', userSettings ? 'found' : 'not found');

        const defaultSettings: Settings = {
            leftWinkSensitivity: 0.50,
            rightWinkSensitivity: 0.50,
            yaw: 45,
            pitch: 45,
            deadZone: 6,
            tiltAngle: 20,
        };

        const finalSettings = { ...defaultSettings, ...userSettings };


        return { success: true, message: 'Login successful', user: { email: user.email, id: user._id.toHexString(), settings: finalSettings } };
    } catch (error) {
        console.error("Error in verifyUser:", error);
        return { success: false, message: 'An internal error occurred during login.' };
    }
}

export async function getUserSettings(c: AppContext, userId: string) {
    try {
        const collection = await getCollection(c, 'Settings');
        const settings = await collection.findOne({ userId: new ObjectId(userId) });

        if (!settings) {
            return { success: false, message: 'Settings not found' };
        }

        return { success: true, settings };
    } catch (error) {
        console.error("Error in getUserSettings:", error);
        return { success: false, message: 'An internal error occurred while fetching settings.' };
    }
}

export async function updateUserSettings(c: AppContext, userId: string, settings: Settings) {
    const collection = await getCollection(c, 'Settings');
    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...updateData } = settings as { _id?: ObjectId };

        await collection.updateOne(
            { userId: new ObjectId(userId) },
            { $set: updateData },
            { upsert: true }
        );
        return { success: true, message: 'Settings updated successfully' };
    } catch (error) {
        return { success: false, message: 'Failed to update settings' };
    }
}
