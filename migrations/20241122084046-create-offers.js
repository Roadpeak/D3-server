module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Offers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      discount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      expiration_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        // You can add a custom getter to calculate the fee if needed
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'expired', 'paused'),
        defaultValue: 'active',
      },
      service_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Services', // Reference the Services table
          key: 'id',         // The `id` column from Services table
        },
        onDelete: 'CASCADE',
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
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
    await queryInterface.dropTable('Offers');
  },
};
