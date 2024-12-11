'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Quotes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      form_response_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'FormResponses',  // The name of the table to reference
          key: 'id',
        },
        onDelete: 'CASCADE',  // Delete quotes if the corresponding form response is deleted
      },
      quote_details: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON for MySQL
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Quotes');
  },
};
