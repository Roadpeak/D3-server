'use strict';
const { UUID, UUIDV4, JSON, UUIDV4 } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('FormResponses', {
      id: {
        type: UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      service_form_id: {
        type: UUID,
        references: {
          model: 'ServiceForms',
          key: 'id',
        },
        allowNull: false,
      },
      user_id: {
        type: UUID,
        allowNull: false,
      },
      response_data: {
        type: JSON,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FormResponses');
  },
};
