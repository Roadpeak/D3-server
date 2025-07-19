// assign-staff-to-services.js
// Run this to assign your existing staff to the Hair Restoration service

const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: console.log
});

async function assignStaffToServices() {
  try {
    console.log('🔗 Assigning staff to services...');
    
    // Get the Hair Restoration service
    const [services] = await sequelize.query(`
      SELECT id, name FROM services WHERE name = 'Hair Restoration'
    `);
    
    if (services.length === 0) {
      console.log('❌ Hair Restoration service not found');
      return;
    }
    
    const hairRestorationService = services[0];
    console.log('🏷️ Found service:', hairRestorationService.name, '(' + hairRestorationService.id + ')');
    
    // Get all active staff
    const [staff] = await sequelize.query(`
      SELECT id, name, email FROM staff WHERE status = 'active'
    `);
    
    console.log('👥 Found', staff.length, 'active staff members');
    
    if (staff.length === 0) {
      console.log('❌ No active staff found');
      return;
    }
    
    // Assign all staff to the Hair Restoration service
    for (const staffMember of staff) {
      try {
        // Check if assignment already exists
        const [existing] = await sequelize.query(`
          SELECT id FROM staff_services 
          WHERE staffId = ? AND serviceId = ?
        `, {
          replacements: [staffMember.id, hairRestorationService.id]
        });
        
        if (existing.length > 0) {
          console.log('⚠️ ', staffMember.name, 'already assigned to service');
          continue;
        }
        
        // Create the assignment
        await sequelize.query(`
          INSERT INTO staff_services (id, staffId, serviceId, isActive, createdAt, updatedAt)
          VALUES (UUID(), ?, ?, 1, NOW(), NOW())
        `, {
          replacements: [staffMember.id, hairRestorationService.id]
        });
        
        console.log('✅ Assigned', staffMember.name, 'to Hair Restoration service');
        
      } catch (assignError) {
        console.error('❌ Failed to assign', staffMember.name, ':', assignError.message);
      }
    }
    
    // Verify assignments
    console.log('\n🔍 Verifying assignments...');
    const [assignments] = await sequelize.query(`
      SELECT s.name as staff_name, srv.name as service_name
      FROM staff_services ss
      INNER JOIN staff s ON ss.staffId = s.id
      INNER JOIN services srv ON ss.serviceId = srv.id
      WHERE srv.name = 'Hair Restoration'
    `);
    
    console.log('📋 Current assignments for Hair Restoration:');
    assignments.forEach(assignment => {
      console.log(`  ✓ ${assignment.staff_name} → ${assignment.service_name}`);
    });
    
    console.log('\n🎉 Staff assignment completed!');
    console.log('💡 You can now create offers for the Hair Restoration service');
    
  } catch (error) {
    console.error('❌ Assignment error:', error.message);
  } finally {
    await sequelize.close();
  }
}

assignStaffToServices();