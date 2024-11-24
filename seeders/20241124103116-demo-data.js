'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed Merchants
    const merchants = await queryInterface.bulkInsert('Merchants', [
      {
        id: uuidv4(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        phoneNumber: '1234567890',
        password: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'janedoe@example.com',
        phoneNumber: '0987654321',
        password: await bcrypt.hash('password456', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], { returning: true }); // Fetch the IDs after inserting

    // Seed Users
    const users = await queryInterface.bulkInsert('Users', [
      {
        id: uuidv4(),
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        phoneNumber: '1234567890',
        password: await bcrypt.hash('adminpassword', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], { returning: true });

    // Seed Stores (ensure merchants[0].id and users[0].id are valid)
    const stores = await queryInterface.bulkInsert('Stores', [
      {
        id: uuidv4(),
        merchant_id: merchants[0].id, // Use the first merchant's ID
        name: 'Super Cuts',
        location: '123 Main St, City',
        primary_email: 'supercuts@example.com',
        phone_number: '1231231234',
        description: 'A great place for haircuts',
        website_url: 'https://supercuts.example.com',
        logo_url: 'https://supercuts.example.com/logo.png',
        opening_time: '08:00:00',
        closing_time: '18:00:00',
        working_days: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
        status: 'open',
        created_by: users[0].id, // Use the admin user
        updated_by: users[0].id, // Use the admin user
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], { returning: true });

    // Seed Services (ensure stores[0].id is valid)
    await queryInterface.bulkInsert('Services', [
      {
        id: uuidv4(),
        name: 'Haircut',
        price: 15.00,
        duration: 30, // in minutes
        store_id: stores[0].id, // Use the first store's ID
        category: 'Beauty',
        description: 'A basic haircut',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Massage',
        price: 40.00,
        duration: 60, // in minutes
        store_id: stores[0].id, // Use the first store's ID
        category: 'Wellness',
        description: 'Relaxing massage',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    // Delete all data
    await queryInterface.bulkDelete('Services', null, {});
    await queryInterface.bulkDelete('Stores', null, {});
    await queryInterface.bulkDelete('Merchants', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  }
};
