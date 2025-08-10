// ===============================
// SOLUTION: Fix Reviews Table Structure Error
// ===============================

// Create this script: fix-reviews-table.js

const { sequelize } = require('./models');

async function fixReviewsTable() {
  try {
    console.log('🔧 Fixing Reviews table structure...');
    
    // Step 1: Check current table structure
    console.log('📋 Checking current Reviews table structure...');
    try {
      const [results] = await sequelize.query('DESCRIBE Reviews;');
      console.log('Current Reviews table columns:', results.map(r => r.Field));
    } catch (error) {
      console.log('Reviews table might not exist yet');
    }
    
    // Step 2: Safely drop the Reviews table
    console.log('🗑️ Dropping existing Reviews table...');
    
    // Disable foreign key checks to avoid constraint errors
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Drop the table completely
    await sequelize.query('DROP TABLE IF EXISTS Reviews;');
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✅ Reviews table dropped successfully!');
    
    // Step 3: Force sync the Review model to recreate with correct structure
    console.log('🔄 Recreating Reviews table with correct structure...');
    
    // Force sync only the Review model
    const Review = sequelize.models.Review;
    if (Review) {
      await Review.sync({ force: true });
      console.log('✅ Reviews table recreated with proper structure!');
      
      // Check the new structure
      const [newResults] = await sequelize.query('DESCRIBE Reviews;');
      console.log('✅ New Reviews table columns:', newResults.map(r => r.Field));
    } else {
      console.error('❌ Review model not found in sequelize.models');
    }
    
    console.log('🎉 Reviews table fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing Reviews table:', error);
    
    // Alternative approach: Manual table creation
    console.log('🔄 Trying manual table creation...');
    try {
      await createReviewsTableManually();
    } catch (manualError) {
      console.error('❌ Manual creation also failed:', manualError);
    }
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

async function createReviewsTableManually() {
  console.log('🛠️ Creating Reviews table manually...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS Reviews (
      id VARCHAR(36) PRIMARY KEY,
      store_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      text TEXT,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      is_verified BOOLEAN DEFAULT FALSE,
      is_helpful_count INTEGER DEFAULT 0,
      is_reported BOOLEAN DEFAULT FALSE,
      merchant_response TEXT,
      merchant_response_date DATETIME,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      
      -- Foreign key constraints
      FOREIGN KEY (store_id) REFERENCES Stores(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
      
      -- Indexes for performance
      INDEX idx_reviews_store_id (store_id),
      INDEX idx_reviews_user_id (user_id),
      INDEX idx_reviews_rating (rating),
      INDEX idx_reviews_created_at (createdAt),
      
      -- Unique constraint to prevent duplicate reviews
      UNIQUE KEY unique_store_user_review (store_id, user_id)
    );
  `;
  
  await sequelize.query(createTableSQL);
  console.log('✅ Reviews table created manually!');
}

// Run the fix
fixReviewsTable();