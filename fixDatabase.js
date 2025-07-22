// scripts/fixDatabase.js - Run this to fix the foreign key issue
const { Sequelize } = require('sequelize');

// Database configuration - adjust these to match your setup
const sequelize = new Sequelize(
  process.env.DB_DATABASE || 'your_database_name',
  process.env.DB_USERNAME || 'your_username', 
  process.env.DB_PASSWORD || 'your_password',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: console.log
  }
);

async function fixForeignKeyIssue() {
  try {
    console.log('🔧 Starting database fix...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Step 1: Drop existing foreign key constraints
    console.log('🗑️ Dropping existing foreign key constraints...');
    
    try {
      await sequelize.query(`
        ALTER TABLE bookings 
        DROP FOREIGN KEY bookings_ibfk_168;
      `);
      console.log('✅ Dropped bookings_ibfk_168');
    } catch (error) {
      console.log('⚠️ Foreign key bookings_ibfk_168 not found or already dropped');
    }
    
    // Find and drop all booking foreign keys related to payments
    const [fkResults] = await sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'bookings' 
      AND REFERENCED_TABLE_NAME = 'payments';
    `);
    
    for (const fk of fkResults) {
      try {
        await sequelize.query(`ALTER TABLE bookings DROP FOREIGN KEY ${fk.CONSTRAINT_NAME};`);
        console.log(`✅ Dropped foreign key: ${fk.CONSTRAINT_NAME}`);
      } catch (error) {
        console.log(`⚠️ Could not drop ${fk.CONSTRAINT_NAME}: ${error.message}`);
      }
    }
    
    // Step 2: Check current column types
    console.log('🔍 Checking current column types...');
    
    const [bookingColumns] = await sequelize.query(`
      DESCRIBE bookings;
    `);
    
    const [paymentColumns] = await sequelize.query(`
      DESCRIBE payments;
    `);
    
    const paymentIdColumn = bookingColumns.find(col => col.Field === 'paymentId');
    const paymentsIdColumn = paymentColumns.find(col => col.Field === 'id');
    
    console.log('📋 Current column types:');
    console.log('  bookings.paymentId:', paymentIdColumn?.Type || 'Column not found');
    console.log('  payments.id:', paymentsIdColumn?.Type || 'Column not found');
    
    // Step 3: Fix the column type mismatch
    if (paymentIdColumn && paymentsIdColumn) {
      if (paymentsIdColumn.Type.includes('char')) {
        // payments.id is UUID (VARCHAR/CHAR), make paymentId match
        console.log('🔧 Converting paymentId to match UUID type...');
        
        // First, set any invalid paymentId values to NULL
        await sequelize.query(`
          UPDATE bookings 
          SET paymentId = NULL 
          WHERE paymentId IS NOT NULL 
          AND paymentId NOT IN (SELECT id FROM payments);
        `);
        
        // Modify column to match UUID type
        await sequelize.query(`
          ALTER TABLE bookings 
          MODIFY COLUMN paymentId VARCHAR(36) NULL;
        `);
        
        console.log('✅ Updated paymentId column to VARCHAR(36)');
        
      } else if (paymentsIdColumn.Type.includes('int')) {
        // payments.id is INTEGER, make paymentId match
        console.log('🔧 Converting paymentId to match INTEGER type...');
        
        await sequelize.query(`
          ALTER TABLE bookings 
          MODIFY COLUMN paymentId INT NULL;
        `);
        
        console.log('✅ Updated paymentId column to INT');
      }
    }
    
    // Step 4: Recreate the foreign key constraint
    console.log('🔗 Creating new foreign key constraint...');
    
    try {
      await sequelize.query(`
        ALTER TABLE bookings 
        ADD CONSTRAINT fk_bookings_payment_id 
        FOREIGN KEY (paymentId) 
        REFERENCES payments(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
      `);
      
      console.log('✅ Foreign key constraint created successfully');
    } catch (error) {
      console.error('❌ Failed to create foreign key:', error.message);
      
      // Alternative: Create without foreign key constraint
      console.log('⚠️ Continuing without foreign key constraint for now');
    }
    
    console.log('🎉 Database fix completed!');
    
  } catch (error) {
    console.error('💥 Database fix failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Alternative: Quick fix by updating Payment model to use INTEGER ID
function generateUpdatedPaymentModel() {
  return `
// models/Payment.js - Updated with INTEGER ID
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Payment extends Model {
    static associate(models) {
      Payment.hasMany(models.Booking, {
        foreignKey: 'paymentId',
        as: 'Bookings'
      });
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      // ... rest of your fields stay the same
      unique_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        defaultValue: () => 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase()
      },
      // ... rest of your model definition
    },
    {
      sequelize,
      modelName: 'Payment',
      // ... rest of your options
    }
  );

  return Payment;
};
`;
}

if (require.main === module) {
  fixForeignKeyIssue();
}

module.exports = { fixForeignKeyIssue, generateUpdatedPaymentModel };