// debug-staff-service.js
// Run this to check your staff-service relationships

const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: console.log
});

async function debugStaffService() {
  try {
    console.log('🔍 Debugging staff-service relationships...');
    
    // Check if tables exist
    console.log('\n📋 Checking tables...');
    const [tables] = await sequelize.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    console.log('Available tables:', tableNames);
    
    const hasStaff = tableNames.includes('staff');
    const hasServices = tableNames.includes('services');
    const hasStaffServices = tableNames.includes('staff_services');
    
    console.log('✅ Staff table exists:', hasStaff);
    console.log('✅ Services table exists:', hasServices);
    console.log('✅ StaffServices table exists:', hasStaffServices);
    
    if (!hasStaffServices) {
      console.log('❌ staff_services table is missing!');
      console.log('💡 You need to create the junction table for many-to-many relationship');
      return;
    }
    
    // Check staff_services table structure
    console.log('\n📊 StaffServices table structure:');
    const [staffServiceCols] = await sequelize.query("DESCRIBE staff_services");
    staffServiceCols.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check data in staff_services
    console.log('\n💾 StaffServices data:');
    const [staffServiceData] = await sequelize.query("SELECT * FROM staff_services LIMIT 10");
    console.log('Staff-Service assignments:', staffServiceData.length);
    staffServiceData.forEach(record => {
      console.log(`  Staff: ${record.staffId} → Service: ${record.serviceId}`);
    });
    
    if (staffServiceData.length === 0) {
      console.log('⚠️ No staff-service assignments found!');
      console.log('💡 You need to assign staff to services first');
    }
    
    // Check services
    console.log('\n🏷️ Available services:');
    const [services] = await sequelize.query("SELECT id, name FROM services LIMIT 5");
    services.forEach(service => {
      console.log(`  ${service.name} (${service.id})`);
    });
    
    // Check staff
    console.log('\n👥 Available staff:');
    const [staff] = await sequelize.query("SELECT id, name, email FROM staff LIMIT 5");
    staff.forEach(member => {
      console.log(`  ${member.name} - ${member.email} (${member.id})`);
    });
    
    // Try to find staff for each service
    if (services.length > 0 && staffServiceData.length > 0) {
      console.log('\n🔗 Testing staff-service relationships:');
      for (const service of services.slice(0, 3)) {
        const [serviceStaff] = await sequelize.query(`
          SELECT s.name, s.email 
          FROM staff s 
          INNER JOIN staff_services ss ON s.id = ss.staffId 
          WHERE ss.serviceId = ?
        `, {
          replacements: [service.id]
        });
        
        console.log(`  ${service.name}: ${serviceStaff.length} staff members`);
        serviceStaff.forEach(member => {
          console.log(`    - ${member.name} (${member.email})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
  } finally {
    await sequelize.close();
  }
}

debugStaffService();