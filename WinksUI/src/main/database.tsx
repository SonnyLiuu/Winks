import { MongoClient, Collection } from 'mongodb'
import bcrypt from 'bcryptjs'

const uri =
  'mongodb+srv://root:RickLinebacker12345@winks.n0ibi.mongodb.net/?retryWrites=true&w=majority&appName=Winks'
const client = new MongoClient(uri)
const dbName = 'User_Profiles'
const collectionName = 'Profiles'

let usersCollection: Collection

async function connectToDatabase(): Promise<void> {
  try {
    await client.connect()
    console.log('Connected successfully to MongoDB')
    const db = client.db(dbName)
    usersCollection = db.collection(collectionName)
    await usersCollection.createIndex({ email: 1 }, { unique: true })
    console.log('Unique index on email field ensured.')
  } catch (error) {
    console.error('Could not connect to MongoDB:', error)
    process.exit(1)
  }
}

interface MongoServerError {
  code?: number;
  message: string;
}

function isMongoServerError(error: unknown): error is MongoServerError {
  return (
    typeof error === 'object' && error !== null && 'code' in error // Checks if 'code' property exists on the object
  )
}

async function createUser(email: string, passwordPlain: string): Promise<any> {
  try {
    const hashedPassword = await bcrypt.hash(passwordPlain, 10)
    const result = await usersCollection.insertOne({ email, password: hashedPassword })
    console.log('User created:', result.insertedId)
    return { success: true, message: 'User created successfully', userId: result.insertedId }
  } catch (error: unknown) {
    console.error('Error creating user:', error)
    if (isMongoServerError(error) && error.code === 11000) {
      return {
        success: false,
        message: 'Email already registered'
      }
    }
    return {
      success: false,
      message: 'Failed to create user'
    }
  }
}

async function verifyUser(email: string, passwordPlain: string): Promise<any> {
  try {
    const user = await usersCollection.findOne({ email })
    if (!user) {
      return { success: false, message: 'User not found' }
    }

    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password)
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid credentials' }
    }

    return { success: true, message: 'Login successful', user: { email: user.email, id: user._id } }
  } catch (error) {
    console.error('Error verifying user:', error)
    return { success: false, message: 'Login failed' }
  }
}

export { connectToDatabase, createUser, verifyUser }
