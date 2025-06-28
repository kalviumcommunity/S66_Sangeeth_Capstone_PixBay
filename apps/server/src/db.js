// db.js
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient()

// Verify database connection
export async function verifyDatabaseConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not defined');
    }
    
    // Run a simple query to check connection
    await prisma.$queryRaw`SELECT 1`
    // console.log('✅ PostgreSQL database connected')
    return true
  } catch (error) {
    console.error('❌ Unable to connect to the PostgreSQL database:', error)
    throw error
  }
}

export default prisma