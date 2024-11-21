module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Services', 'id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,  // Auto-generate UUID
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Services', 'id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
