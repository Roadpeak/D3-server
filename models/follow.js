'use strict';

module.exports = (sequelize, DataTypes) => {
  const Follow = sequelize.define(
    'Follow',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Stores',
          key: 'id',
        },
      },
    },
    {
      timestamps: true,
      tableName: 'Follows',
    }
  );

  Follow.associate = (models) => {
    // FIXED: Consistent foreign key naming
    Follow.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',  // Keep this alias - used in controller
    });

    Follow.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store',  // Keep this alias - used in controller
    });
  };

  return Follow;
};