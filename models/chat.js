module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  });

  Chat.belongsTo(sequelize.models.User, { foreignKey: 'userId', as: 'user' });

  return Chat;
};
