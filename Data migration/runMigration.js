// runMigration.js
import { migrateLocations, verifyMigration } from './locationMigration.js';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const rl = readline.createInterface({ input, output });

const runMigration = async () => {
  try {
    const email = await rl.question('Enter admin email: ');
    const password = await rl.question('Enter password: ');
    
    // Run migration with auth credentials
    await migrateLocations(email, password);
    
    // Verify results
    const results = await verifyMigration();
    
    // Log summary
    console.log('\n📝 Migration Summary:');
    console.log(`Shelves: ${results.shelf?.length || 0} migrated`);
    console.log(`Showcase: ${results.showcase?.length || 0} migrated`);
    console.log(`Tables: ${results.table?.length || 0} migrated`);
    console.log(`Strings: ${results.string?.length || 0} migrated`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    rl.close();
  }
};

// Run the migration
runMigration();