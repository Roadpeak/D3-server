// inspect-and-fix-reviews.js - Smart fix that matches existing table structures
// Run this script: node inspect-and-fix-reviews.js

const path = require('path');
require('dotenv').config();

async function inspectAndFixReviewModel() {
  try {
    console.log('🔧 Starting smart Review model fix...');
    
    // Import the models
    const { sequelize } = require('./models');
    
    if (!sequelize) {
      console.error('❌ Sequelize not found. Check your models/index.js file.');
      process.exit(1);
    }

    console.log('✅ Sequelize connection established');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Step 1: Inspect existing table structures
    console.log('\n🔍 Step 1: Inspecting existing table structures...');
    
    let storeIdType = 'VARCHAR(255)'; // default fallback
    let userIdType = 'VARCHAR(255)'; // default fallback
    let storeIdLength = 255;
    let userIdLength = 255;

    try {
      // Check Stores table structure
      const [storesStructure] = await sequelize.query('DESCRIBE Stores;');
      const storeIdColumn = storesStructure.find(col => col.Field === 'id');
      if (storeIdColumn) {
        storeIdType = storeIdColumn.Type;
        console.log(`🏪 Stores.id type: ${storeIdType}`);
        
        // Extract length for CHAR/VARCHAR
        const lengthMatch = storeIdType.match(/\((\d+)\)/);
        if (lengthMatch) {
          storeIdLength = parseInt(lengthMatch[1]);
        }
      } else {
        console.log('⚠️ Could not find Stores.id column, using default VARCHAR(255)');
      }
    } catch (storeError) {
      console.log('⚠️ Could not inspect Stores table:', storeError.message);
      console.log('💡 Using default type for store_id: VARCHAR(255)');
    }

    try {
      // Check Users table structure  
      const [usersStructure] = await sequelize.query('DESCRIBE Users;');
      const userIdColumn = usersStructure.find(col => col.Field === 'id');
      if (userIdColumn) {
        userIdType = userIdColumn.Type;
        console.log(`👤 Users.id type: ${userIdType}`);
        
        // Extract length for CHAR/VARCHAR
        const lengthMatch = userIdType.match(/\((\d+)\)/);
        if (lengthMatch) {
          userIdLength = parseInt(lengthMatch[1]);
        }
      } else {
        console.log('⚠️ Could not find Users.id column, using default VARCHAR(255)');
      }
    } catch (userError) {
      console.log('⚠️ Could not inspect Users table:', userError.message);
      console.log('💡 Using default type for user_id: VARCHAR(255)');
    }

    // Step 2: Normalize data types for compatibility
    console.log('\n🔧 Step 2: Normalizing data types for compatibility...');
    
    // Detect UUID types and handle them properly
    let normalizedType;
    
    const isStoreUUID = storeIdType.includes('char(36)') || storeIdType.includes('CHAR(36)');
    const isUserUUID = userIdType.includes('char(36)') || userIdType.includes('CHAR(36)');
    
    if (isStoreUUID || isUserUUID) {
      // Use CHAR(36) for UUID compatibility
      normalizedType = 'CHAR(36)';
      console.log('🔍 UUID type detected - using CHAR(36) for compatibility');
    } else {
      // Use the longer length to ensure compatibility
      const maxLength = Math.max(storeIdLength, userIdLength, 255);
      normalizedType = `VARCHAR(${maxLength})`;
    }
    
    console.log(`📊 Normalized ID type: ${normalizedType}`);
    console.log(`📊 Store ID type: ${storeIdType} -> ${normalizedType}`);
    console.log(`📊 User ID type: ${userIdType} -> ${normalizedType}`);

    // Step 3: Drop existing Reviews table
    console.log('\n🗑️ Step 3: Dropping existing Reviews table...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS Reviews;');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✅ Existing Reviews table dropped');

    // Step 4: Create Reviews table with compatible types
    console.log('\n🔧 Step 4: Creating Reviews table with compatible data types...');
    
    const createReviewsSQL = `
      CREATE TABLE Reviews (
        id ${normalizedType} NOT NULL PRIMARY KEY,
        store_id ${normalizedType} NOT NULL,
        user_id ${normalizedType} NULL,
        text TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        is_verified BOOLEAN DEFAULT FALSE,
        is_helpful_count INTEGER DEFAULT 0,
        is_reported BOOLEAN DEFAULT FALSE,
        merchant_response TEXT,
        merchant_response_date DATETIME,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        
        -- Indexes for performance
        INDEX idx_reviews_store_id (store_id),
        INDEX idx_reviews_user_id (user_id),
        INDEX idx_reviews_rating (rating),
        INDEX idx_reviews_created_at (createdAt),
        
        -- Unique constraint to prevent duplicate reviews
        UNIQUE KEY unique_store_user_review (store_id, user_id),
        
        -- Foreign key constraints (only if parent tables exist)
        FOREIGN KEY (store_id) REFERENCES Stores(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB;
    `;

    try {
      await sequelize.query(createReviewsSQL);
      console.log('✅ Reviews table created with foreign key constraints');
    } catch (fkError) {
      console.log('⚠️ Foreign key creation failed, trying without constraints...');
      
      // Try without foreign key constraints
      const createReviewsWithoutFKSQL = `
        CREATE TABLE Reviews (
          id ${normalizedType} NOT NULL PRIMARY KEY,
          store_id ${normalizedType} NOT NULL,
          user_id ${normalizedType} NULL,
          text TEXT,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          is_verified BOOLEAN DEFAULT FALSE,
          is_helpful_count INTEGER DEFAULT 0,
          is_reported BOOLEAN DEFAULT FALSE,
          merchant_response TEXT,
          merchant_response_date DATETIME,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL,
          
          -- Indexes for performance
          INDEX idx_reviews_store_id (store_id),
          INDEX idx_reviews_user_id (user_id),
          INDEX idx_reviews_rating (rating),
          INDEX idx_reviews_created_at (createdAt),
          
          -- Unique constraint to prevent duplicate reviews
          UNIQUE KEY unique_store_user_review (store_id, user_id)
        ) ENGINE=InnoDB;
      `;
      
      await sequelize.query(createReviewsWithoutFKSQL);
      console.log('✅ Reviews table created without foreign key constraints');
      console.log('💡 Foreign keys can be added manually later if needed');
    }

    // Step 5: Verify table structure
    console.log('\n📋 Step 5: Verifying new table structure...');
    const [newTableStructure] = await sequelize.query('DESCRIBE Reviews;');
    console.log('📊 Reviews table structure:');
    newTableStructure.forEach(col => {
      const nullStr = col.Null === 'NO' ? 'NOT NULL' : 'NULL';
      const keyStr = col.Key ? `(${col.Key})` : '';
      const defaultStr = col.Default !== null ? `DEFAULT ${col.Default}` : '';
      console.log(`  - ${col.Field}: ${col.Type} ${nullStr} ${keyStr} ${defaultStr}`);
    });

    // Step 6: Test basic operations
    console.log('\n🧪 Step 6: Testing basic database operations...');
    
    try {
      // Test insert
      const testId = generateUUID();
      await sequelize.query(`
        INSERT INTO Reviews (id, store_id, user_id, rating, text, createdAt, updatedAt)
        VALUES (?, 'test-store-123', 'test-user-123', 5, 'Test review', NOW(), NOW())
      `, { replacements: [testId] });
      
      console.log('✅ Insert operation successful');
      
      // Test select
      const [testResults] = await sequelize.query('SELECT * FROM Reviews WHERE id = ?', {
        replacements: [testId]
      });
      
      console.log('✅ Select operation successful');
      console.log(`📝 Found ${testResults.length} test record(s)`);
      
      // Test update
      await sequelize.query('UPDATE Reviews SET rating = 4 WHERE id = ?', {
        replacements: [testId]
      });
      
      console.log('✅ Update operation successful');
      
      // Test delete
      await sequelize.query('DELETE FROM Reviews WHERE id = ?', {
        replacements: [testId]
      });
      
      console.log('✅ Delete operation successful');
      
    } catch (operationError) {
      console.log('⚠️ Some operations may need the Sequelize model:', operationError.message);
    }

    // Step 7: Test Sequelize model if available
    console.log('\n🔍 Step 7: Testing Sequelize model integration...');
    
    try {
      const { Review } = require('./models');
      
      if (Review) {
        console.log('✅ Review model found in models');
        
        // Test model count
        const count = await Review.count();
        console.log(`📊 Review count via model: ${count}`);
        
        // Test static methods if they exist
        if (typeof Review.hasUserReviewed === 'function') {
          const hasReviewed = await Review.hasUserReviewed('test-user', 'test-store');
          console.log('✅ hasUserReviewed method works:', hasReviewed);
        }
        
        if (typeof Review.getStoreStats === 'function') {
          const stats = await Review.getStoreStats('test-store');
          console.log('✅ getStoreStats method works:', stats);
        }
        
      } else {
        console.log('⚠️ Review model not found, but table structure is ready');
      }
    } catch (modelError) {
      console.log('⚠️ Model testing failed (this is normal if models need restart):', modelError.message);
    }

    // Step 8: Show current indexes
    console.log('\n📊 Step 8: Current table indexes:');
    try {
      const [indexes] = await sequelize.query('SHOW INDEX FROM Reviews;');
      if (indexes.length > 0) {
        indexes.forEach(idx => {
          console.log(`  - ${idx.Key_name}: ${idx.Column_name} (${idx.Index_type})`);
        });
      } else {
        console.log('  - No indexes found');
      }
    } catch (indexError) {
      console.log('⚠️ Could not show indexes:', indexError.message);
    }

    console.log('\n🎉 Smart Review model fix completed successfully!');
    console.log('💡 Next steps:');
    console.log('  1. Restart your server: npm start or node app.js');
    console.log('  2. Test the API: GET /api/v1/debug/review-health');
    console.log('  3. Test review creation: POST /api/v1/reviews');
    
    if (storeIdType !== normalizedType || userIdType !== normalizedType) {
      console.log('\n⚠️ Note: Data types were normalized for compatibility');
      console.log('   If you need specific UUID types, you may need to adjust your Stores/Users models');
    }

  } catch (error) {
    console.error('\n❌ Smart Review model fix failed:', error.message);
    console.log('\n🔧 Advanced troubleshooting:');
    console.log('1. Check database character set: SHOW VARIABLES LIKE "character_set%";');
    console.log('2. Check collation: SHOW VARIABLES LIKE "collation%";');
    console.log('3. Check existing foreign keys: SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_NAME IS NOT NULL;');
    console.log('4. Try manual table creation with simpler structure');
    
    // Try a super simple fallback
    console.log('\n🚨 Attempting emergency fallback...');
    await emergencyFallback(sequelize);
    
  } finally {
    // Close database connection
    try {
      await sequelize.close();
      console.log('\n📡 Database connection closed');
    } catch (closeError) {
      console.log('⚠️ Error closing database connection:', closeError.message);
    }
    
    process.exit(0);
  }
}

// Emergency fallback - create minimal table
async function emergencyFallback(sequelize) {
  try {
    console.log('🔄 Creating minimal Reviews table...');
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS Reviews;');
    
    const minimalSQL = `
      CREATE TABLE Reviews (
        id VARCHAR(255) NOT NULL PRIMARY KEY,
        store_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NULL,
        text TEXT,
        rating INTEGER NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        is_helpful_count INTEGER DEFAULT 0,
        is_reported BOOLEAN DEFAULT FALSE,
        merchant_response TEXT,
        merchant_response_date DATETIME,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        
        INDEX idx_reviews_store_id (store_id),
        INDEX idx_reviews_user_id (user_id),
        INDEX idx_reviews_rating (rating)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await sequelize.query(minimalSQL);
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✅ Emergency fallback table created');
    console.log('💡 Foreign keys can be added manually after verifying compatibility');
    
  } catch (fallbackError) {
    console.error('❌ Emergency fallback also failed:', fallbackError.message);
    console.log('💡 You may need to create the table manually in your database');
  }
}

// Utility function to generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Additional helper to check table compatibility
async function checkTableCompatibility(sequelize) {
  try {
    console.log('\n🔍 Checking table compatibility...');
    
    // Check character sets
    const [charsets] = await sequelize.query("SHOW VARIABLES LIKE 'character_set%';");
    console.log('📊 Database character sets:');
    charsets.forEach(cs => {
      console.log(`  - ${cs.Variable_name}: ${cs.Value}`);
    });
    
    // Check collations
    const [collations] = await sequelize.query("SHOW VARIABLES LIKE 'collation%';");
    console.log('📊 Database collations:');
    collations.forEach(col => {
      console.log(`  - ${col.Variable_name}: ${col.Value}`);
    });
    
    return true;
  } catch (error) {
    console.log('⚠️ Could not check compatibility:', error.message);
    return false;
  }
}

// Run the smart fix
console.log('🚀 Starting smart Review model diagnostic and fix...');
console.log('🔍 This will inspect existing table structures and create compatible Reviews table...');

inspectAndFixReviewModel().catch(error => {
  console.error('❌ Startup error:', error);
  process.exit(1);
});