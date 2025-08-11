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
          model: 'users',
          key: 'id',
        },
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id',
        },
      },
    },
    {
      timestamps: true,
      tableName: 'follows',
    }
  );

  Follow.associate = (models) => {
    Follow.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    Follow.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store',
    });
  };

  return Follow;
};
