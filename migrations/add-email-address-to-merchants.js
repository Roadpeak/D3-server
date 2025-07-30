// migrations/add-email-address-to-merchants.js
module.exports = {
    async up(queryInterface, Sequelize) {
      // First add the column as nullable
      await queryInterface.addColumn('merchants', 'email_address', {
        type: Sequelize.STRING,
        allowNull: true
      });
      
      // Update empty/null values with unique placeholders
      await queryInterface.sequelize.query(`
        UPDATE merchants 
        SET email_address = CONCAT('user_', id, '@placeholder.com')
        WHERE email_address IS NULL OR email_address = ''
      `);
      
      // Now add the unique constraint
      await queryInterface.addConstraint('merchants', {
        fields: ['email_address'],
        type: 'unique',
        name: 'merchants_email_address_unique'
      });
      
      // Finally make it NOT NULL if needed
      await queryInterface.changeColumn('merchants', 'email_address', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      });
    },
    
    async down(queryInterface, Sequelize) {
      await queryInterface.removeColumn('merchants', 'email_address');
    }
  };