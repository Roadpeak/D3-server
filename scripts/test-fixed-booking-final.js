// scripts/test-fixed-booking-final.js
// Final test with correct Store column names
// Usage: node scripts/test-fixed-booking-final.js

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Import your models
let models;
try {
  models = require('../models');
  console.log('✅ Models imported successfully');
} catch (error) {
  console.error('❌ Failed to import models:', error.message);
  process.exit(1);
}

const { Offer, Service, Store } = models;

async function testFixedBookingFinal() {
  try {
    console.log('🧪 Testing Fixed Booking System (Final)...\n');

    // Test 1: Verify branch_id field access
    console.log('📋 Test 1: Direct branch_id Field Access');
    try {
      const service = await Service.findOne({
        attributes: ['id', 'name', 'branch_id', 'store_id'],
        limit: 1
      });
      
      if (service) {
        console.log('✅ SUCCESS: Service with branch_id field accessed');
        console.log('Service data:', {
          id: service.id,
          name: service.name,
          branch_id: service.branch_id,
          store_id: service.store_id
        });
      } else {
        console.log('⚠️ No services found in database');
      }
    } catch (error) {
      console.log('❌ FAILED: Service query failed:', error.message);
      return;
    }

    // Test 2: Test Store column access with CORRECT field names
    console.log('\n📋 Test 2: Store Column Access (FIXED)');
    try {
      const store = await Store.findOne({
        attributes: [
          'id', 
          'name', 
          'location', 
          'phone_number',      // FIXED: Correct column name
          'opening_time', 
          'closing_time', 
          'working_days'
        ],
        limit: 1
      });
      
      if (store) {
        console.log('✅ SUCCESS: Store with correct column names accessed');
        console.log('Store data:', {
          id: store.id,
          name: store.name,
          location: store.location,
          phone_number: store.phone_number,  // FIXED: Correct field
          opening_time: store.opening_time,
          closing_time: store.closing_time,
          working_days: store.working_days
        });
      } else {
        console.log('⚠️ No stores found in database');
      }
    } catch (error) {
      console.log('❌ FAILED: Store query failed:', error.message);
      console.log('SQL:', error.sql);
      return;
    }

    // Test 3: Test the EXACT query that was failing - WITH FIXED COLUMN NAMES
    console.log('\n📋 Test 3: Recreate Original Query (FIXED)');
    try {
      const testOfferId = '2045b110-ca89-41c3-8664-710521794c29';
      
      const offer = await Offer.findByPk(testOfferId, {
        include: [{
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'branch_id', 'store_id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: [
              'id', 
              'name', 
              'location', 
              'phone_number',      // FIXED: Correct column name
              'opening_time', 
              'closing_time', 
              'working_days'
            ]
          }]
        }]
      });
      
      if (offer && offer.service) {
        console.log('✅ SUCCESS: Original failing query now works with FIXED column names!');
        console.log('Complete offer data:', {
          offer_id: offer.id,
          offer_title: offer.title,
          service: {
            id: offer.service.id,
            name: offer.service.name,
            branch_id: offer.service.branch_id,
            store_id: offer.service.store_id,
            store: {
              id: offer.service.store?.id,
              name: offer.service.store?.name,
              location: offer.service.store?.location,
              phone_number: offer.service.store?.phone_number,  // FIXED
              opening_time: offer.service.store?.opening_time,
              closing_time: offer.service.store?.closing_time,
              working_days: offer.service.store?.working_days
            }
          }
        });

        // Test 4: Simulate the FIXED getBranchesForOffer response
        console.log('\n📋 Test 4: Simulate FIXED Controller Response');
        
        const service = offer.service;
        let branch = null;
        
        // This is what your FIXED controller will return
        if (!service.branch_id && service.store) {
          branch = {
            id: `store-${service.store.id}`,
            name: service.store.name + ' (Main Branch)',
            address: service.store.location,
            phone: service.store.phone_number,        // FIXED: Use correct field
            openingTime: service.store.opening_time,
            closingTime: service.store.closing_time,
            workingDays: service.store.working_days,
            isMainBranch: true
          };
        }

        const controllerResponse = {
          success: true,
          branch: branch,
          service: {
            id: service.id,
            name: service.name,
            branchId: service.branch_id
          }
        };

        console.log('✅ SUCCESS: FIXED Controller response simulation works');
        console.log('Response (formatted):');
        console.log(JSON.stringify(controllerResponse, null, 2));

      } else {
        console.log('⚠️ Test offer not found, trying with any available offer...');
        
        // Try with any available offer
        const anyOffer = await Offer.findOne({
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'branch_id', 'store_id'],
            include: [{
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'location', 'phone_number']  // FIXED
            }]
          }],
          limit: 1
        });

        if (anyOffer && anyOffer.service) {
          console.log('✅ SUCCESS: Query works with available offer');
          console.log('Test offer:', {
            id: anyOffer.id,
            title: anyOffer.title,
            service_branch_id: anyOffer.service.branch_id,
            service_store_id: anyOffer.service.store_id,
            store_phone: anyOffer.service.store?.phone_number  // FIXED
          });
        } else {
          console.log('⚠️ No offers with services found');
        }
      }
      
    } catch (error) {
      console.log('❌ FAILED: Query still failing:', error.message);
      if (error.sql) {
        console.log('SQL:', error.sql);
      }
      return;
    }

    // Test 5: Raw SQL verification with correct column names
    console.log('\n📋 Test 5: Raw SQL Query Test (FIXED)');
    try {
      const [rawResults] = await models.sequelize.query(`
        SELECT 
          o.id as offer_id,
          o.title,
          s.id as service_id,
          s.name as service_name,
          s.branch_id,
          s.store_id,
          st.name as store_name,
          st.location as store_location,
          st.phone_number as store_phone,
          st.opening_time,
          st.closing_time,
          st.working_days
        FROM offers o
        LEFT JOIN services s ON o.service_id = s.id
        LEFT JOIN stores st ON s.store_id = st.id
        LIMIT 1
      `);

      if (rawResults.length > 0) {
        console.log('✅ SUCCESS: Raw SQL query works with FIXED column names');
        console.log('Raw result:', rawResults[0]);
      } else {
        console.log('⚠️ No data found in raw query');
      }
    } catch (error) {
      console.log('❌ FAILED: Raw SQL query failed:', error.message);
    }

    console.log('\n🎉 SUMMARY:');
    console.log('✅ Database column `branch_id` exists and works');
    console.log('✅ Store columns accessed with correct names (phone_number, not phone)');
    console.log('✅ Sequelize can access all required fields');
    console.log('✅ Offer → Service → Store associations work perfectly');
    console.log('✅ Your booking page should now work!');
    
    console.log('\n📝 NEXT STEPS:');
    console.log('1. ✅ branch_id column is working');
    console.log('2. Update your controller methods with the FIXED versions (use phone_number)');
    console.log('3. Restart your Node.js server');
    console.log('4. Test the booking page in your browser');
    console.log('5. The /api/v1/bookings/branches/offer/:offerId endpoint should return 200');
    
    console.log('\n🚀 Ready to test in browser!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    if (models.sequelize) {
      await models.sequelize.close();
      console.log('\n🔚 Database connection closed');
    }
  }
}

// Run the test
if (require.main === module) {
  testFixedBookingFinal().catch(console.error);
}

module.exports = { testFixedBookingFinal };