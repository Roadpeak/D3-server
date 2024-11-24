'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('StaffServices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      staffId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Staff',  // Reference to the Staff table
          key: 'id',
        },
        onDelete: 'CASCADE', // Deletes StaffService records when a Staff is deleted
        onUpdate: 'CASCADE',
      },
      serviceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Services',  // Reference to the Service table
          key: 'id',
        },
        onDelete: 'CASCADE', // Deletes StaffService records when a Service is deleted
        onUpdate: 'CASCADE',
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

    // Create a composite unique constraint to prevent duplicate entries for the same staffId and serviceId
    await queryInterface.addConstraint('StaffServices', {
      fields: ['staffId', 'serviceId'],
      type: 'unique',
      name: 'staff_service_unique_constraint',  // You can give the constraint a custom name
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the StaffServices table and the unique constraint during rollback
    await queryInterface.dropTable('StaffServices');
  },
};
