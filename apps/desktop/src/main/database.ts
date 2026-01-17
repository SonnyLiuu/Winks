import { MongoClient, Collection, MongoServerError, ObjectId } from 'mongodb'
import { User, UserWithId } from './types/user'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const uri = process.env.DB_URI
if (!uri) throw new Error('DB_URI environment variable is not defined')

const client = new MongoClient(uri)
const dbName = 'User_Profiles'
const collectionName = 'Profiles'

// -----------------------------
// region DB Connection
// -----------------------------
let usersCollection: Collection<User> | null = null

async function connectToDatabase(): Promise<Collection<User>> {
  if (!usersCollection) {
    await client.connect()
    const db = client.db(dbName)
    usersCollection = db.collection<User>(collectionName)
    await usersCollection.createIndex({ email: 1 }, { unique: true })
  }
  return usersCollection
}

// -----------------------------
// region Create User
// -----------------------------
async function createUser(
  email: string,
  plainPassword: string
): Promise<{ success: boolean; message: string; userId?: ObjectId }> {
  try {
    const col = await connectToDatabase()
    const hashedPassword = await bcrypt.hash(plainPassword, 10)
    const result = await col.insertOne({ email, hashedPassword })

    return { success: true, message: 'User created successfully', userId: result.insertedId }
  } catch (error: unknown) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return { success: false, message: 'Email already registered' }
    }
    return { success: false, message: 'Failed to create user' }
  }
}

// -----------------------------
// region Verify User
// -----------------------------
async function verifyUser(
  email: string,
  plainPassword: string
): Promise<
  | { success: true; message: string; user: { email: string; id: ObjectId } }
  | { success: false; message: string }
> {
  try {
    const col = await connectToDatabase()
    const user: UserWithId | null = await col.findOne({ email })

    if (!user) return { success: false, message: 'Invalid credentials' }

    const ok = await bcrypt.compare(plainPassword, user.hashedPassword)
    if (!ok) return { success: false, message: 'Invalid credentials' }

    return {
      success: true,
      message: 'Login successful',
      user: { email: user.email, id: user._id },
    }
  } catch (error) {
    console.error('Error verifying user:', error)
    return { success: false, message: 'Login failed' }
  }
}

async function disconnectFromDatabase(): Promise<void> {
  try {
    await (await client).close?.()
  } catch {}
  // reset cached collection so next run re-connects cleanly
  usersCollection = null
}

export { connectToDatabase, createUser, verifyUser, disconnectFromDatabase }
