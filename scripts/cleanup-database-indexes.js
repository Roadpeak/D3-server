// scripts/cleanup-database-indexes.js - Automated index cleanup
const { sequelize } = require('../models/index');

class DatabaseIndexCleaner {
  constructor() {
    this.dryRun = true; // Set to false to actually execute cleanup
  }

  async analyzeTable(tableName) {
    console.log(`\n🔍 Analyzing table: ${tableName}`);
    
    try {
      // Get all indexes for the table
      const [indexes] = await sequelize.query(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          SEQ_IN_INDEX,
          INDEX_TYPE
        FROM information_schema.statistics 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, { replacements: [tableName] });

      console.log(`📊 Found ${indexes.length} index entries for ${tableName}`);

      // Group indexes by name
      const indexGroups = {};
      indexes.forEach(idx => {
        if (!indexGroups[idx.INDEX_NAME]) {
          indexGroups[idx.INDEX_NAME] = [];
        }
        indexGroups[idx.INDEX_NAME].push(idx.COLUMN_NAME);
      });

      const indexCount = Object.keys(indexGroups).length;
      console.log(`📈 Total unique indexes: ${indexCount}`);

      if (indexCount > 50) {
        console.log(`⚠️ WARNING: ${tableName} has ${indexCount} indexes (approaching MySQL limit of 64)`);
      }

      // Identify potential duplicates
      const duplicates = this.findDuplicateIndexes(indexGroups);
      if (duplicates.length > 0) {
        console.log(`🔄 Found ${duplicates.length} potential duplicate index groups:`);
        duplicates.forEach(dup => {
          console.log(`   - ${dup.columns.join(', ')}: ${dup.indexes.join(', ')}`);
        });
      }

      return {
        tableName,
        indexCount,
        indexes: indexGroups,
        duplicates,
        needsCleanup: indexCount > 50 || duplicates.length > 0
      };

    } catch (error) {
      console.error(`❌ Error analyzing ${tableName}:`, error.message);
      return { tableName, error: error.message };
    }
  }

  findDuplicateIndexes(indexGroups) {
    const columnGroups = {};
    
    // Group indexes by their column combinations
    Object.entries(indexGroups).forEach(([indexName, columns]) => {
      const columnKey = columns.sort().join(',');
      if (!columnGroups[columnKey]) {
        columnGroups[columnKey] = [];
      }
      columnGroups[columnKey].push(indexName);
    });

    // Find groups with multiple indexes
    return Object.entries(columnGroups)
      .filter(([columns, indexes]) => indexes.length > 1)
      .map(([columns, indexes]) => ({
        columns: columns.split(','),
        indexes
      }));
  }

  async cleanupTable(tableName, analysis) {
    if (!analysis.needsCleanup) {
      console.log(`✅ ${tableName} doesn't need cleanup`);
      return;
    }

    console.log(`\n🧹 Cleaning up ${tableName}...`);

    for (const duplicate of analysis.duplicates) {
      // Keep the first index, remove the rest
      const [keepIndex, ...removeIndexes] = duplicate.indexes;
      
      console.log(`🔄 Duplicate group [${duplicate.columns.join(', ')}]:`);
      console.log(`   ✅ Keeping: ${keepIndex}`);
      
      for (const removeIndex of removeIndexes) {
        console.log(`   ❌ ${this.dryRun ? 'Would remove' : 'Removing'}: ${removeIndex}`);
        
        if (!this.dryRun && removeIndex !== 'PRIMARY') {
          try {
            await sequelize.query(`DROP INDEX \`${removeIndex}\` ON \`${tableName}\``);
            console.log(`   ✅ Removed ${removeIndex}`);
          } catch (error) {
            console.log(`   ⚠️ Error removing ${removeIndex}:`, error.message);
          }
        }
      }
    }
  }

  async cleanupAllTables() {
    console.log('🚀 Starting database index cleanup...');
    console.log(`🔧 Mode: ${this.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MODE (changes will be executed)'}`);

    const tablesToCheck = ['users', 'merchants', 'stores', 'chats', 'messages', 'bookings'];
    const results = {};

    // Analyze all tables
    for (const tableName of tablesToCheck) {
      results[tableName] = await this.analyzeTable(tableName);
    }

    console.log('\n📊 SUMMARY:');
    let totalProblems = 0;
    Object.values(results).forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.tableName}: Error - ${result.error}`);
      } else if (result.needsCleanup) {
        console.log(`⚠️ ${result.tableName}: ${result.indexCount} indexes, ${result.duplicates.length} duplicate groups`);
        totalProblems++;
      } else {
        console.log(`✅ ${result.tableName}: ${result.indexCount} indexes (OK)`);
      }
    });

    if (totalProblems > 0) {
      console.log(`\n🔧 Found issues in ${totalProblems} tables.`);
      
      if (this.dryRun) {
        console.log('\n💡 TO FIX: Set dryRun = false and run again to execute cleanup');
        console.log('⚠️ WARNING: Backup your database before running cleanup!');
      } else {
        console.log('\n🧹 Starting cleanup...');
        for (const result of Object.values(results)) {
          if (result.needsCleanup) {
            await this.cleanupTable(result.tableName, result);
          }
        }
      }
    } else {
      console.log('\n🎉 All tables look good!');
    }

    return results;
  }

  async fixUsersTableSpecifically() {
    console.log('\n🎯 SPECIFIC FIX for users table key limit issue...');
    
    try {
      // Get current index count
      const [indexCount] = await sequelize.query(`
        SELECT COUNT(DISTINCT INDEX_NAME) as count
        FROM information_schema.statistics 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users'
      `);

      const currentCount = indexCount[0].count;
      console.log(`📊 Current users table index count: ${currentCount}`);

      if (currentCount >= 60) {
        console.log('⚠️ Users table is near or over the MySQL index limit!');
        
        // List all indexes
        const [indexes] = await sequelize.query(`
          SELECT DISTINCT INDEX_NAME, INDEX_TYPE
          FROM information_schema.statistics 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'users'
          ORDER BY INDEX_NAME
        `);

        console.log('\n📋 Current indexes on users table:');
        indexes.forEach((idx, i) => {
          console.log(`${i + 1}. ${idx.INDEX_NAME} (${idx.INDEX_TYPE})`);
        });

        // Suggest indexes to remove
        const unnecessaryIndexes = indexes.filter(idx => 
          idx.INDEX_NAME !== 'PRIMARY' && 
          idx.INDEX_NAME !== 'email' &&
          !idx.INDEX_NAME.includes('foreign') &&
          (idx.INDEX_NAME.includes('temp') || 
           idx.INDEX_NAME.includes('old') ||
           idx.INDEX_NAME.includes('unused') ||
           idx.INDEX_NAME.length > 30)
        );

        if (unnecessaryIndexes.length > 0) {
          console.log('\n🗑️ Suggested indexes to remove:');
          unnecessaryIndexes.forEach(idx => {
            console.log(`DROP INDEX \`${idx.INDEX_NAME}\` ON \`users\`;`);
          });
        }
      }

    } catch (error) {
      console.error('❌ Error analyzing users table:', error.message);
    }
  }
}

// Usage
async function main() {
  const cleaner = new DatabaseIndexCleaner();
  
  try {
    // Set to false to actually execute cleanup
    cleaner.dryRun = true;
    
    console.log('🔍 Starting database index analysis...');
    
    // First, check the specific users table issue
    await cleaner.fixUsersTableSpecifically();
    
    // Then analyze all tables
    await cleaner.cleanupAllTables();
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Export for use in other scripts
module.exports = { DatabaseIndexCleaner };

// Run if called directly
if (require.main === module) {
  main();
}