import { pool } from './db.js';

async function wipeDatabase() {
  try {
    console.log('Nuking database state...');
    
    // TRUNCATE is faster than DELETE and RESTART IDENTITY resets the auto-incrementing user IDs
    await pool.query('TRUNCATE TABLE users, documents, collaborators, versions RESTART IDENTITY CASCADE;');
    
    console.log('SUCCESS: All users, documents, versions, and roles have been wiped.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to wipe database:', err);
    process.exit(1);
  }
}

wipeDatabase();