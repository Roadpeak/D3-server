'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Stores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      merchant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Merchants', // Table name for merchants
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      primary_email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      website_url: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      logo_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      opening_time: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      closing_time: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      working_days: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      status: {
        type: Sequelize.ENUM('open', 'closed', 'under_construction'),
        defaultValue: 'closed',
        allowNull: false,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true, // Change to allow NULL
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL', // This will now work because NULL is allowed
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
    await queryInterface.dropTable('Stores');
  },
};
