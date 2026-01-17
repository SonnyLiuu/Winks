import { WithId } from 'mongodb'

export interface User {
  email: string
  hashedPassword: string
}

export type UserWithId = WithId<User>
