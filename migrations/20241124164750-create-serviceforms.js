'use strict';
const { UUID, UUIDV4, STRING, TEXT, BOOLEAN } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ServiceForms', {
      id: {
        type: UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      service_id: {
        type: UUID,
        references: {
          model: 'Services',
          key: 'id',
        },
        allowNull: false,
      },
      field_name: {
        type: STRING,
        allowNull: false,
      },
      field_type: {
        type: STRING,
        allowNull: false,
      },
      required: {
        type: BOOLEAN,
        defaultValue: true,
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
    await queryInterface.dropTable('ServiceForms');
  },
};
