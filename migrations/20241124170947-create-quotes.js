'use strict';
const { UUID, UUIDV4, FLOAT, TEXT } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Quotes', {
      id: {
        type: UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      form_response_id: {
        type: UUID,
        references: {
          model: 'FormResponses',
          key: 'id',
        },
        allowNull: false,
      },
      quote_amount: {
        type: FLOAT,
        allowNull: false,
      },
      quote_details: {
        type: TEXT,
        allowNull: false,
      },
      status: {
        type: STRING,
        defaultValue: 'Pending',
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
    await queryInterface.dropTable('Quotes');
  },
};
