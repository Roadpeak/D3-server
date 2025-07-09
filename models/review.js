'use strict';

module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define(
    'Review',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Stores',
          key: 'id',
        },
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
          max: 5,
        },
      },
    },
    {
      timestamps: true,
      tableName: 'Reviews',
    }
  );

  Review.associate = (models) => {
    Review.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store',
      onDelete: 'CASCADE',
    });

    Review.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user', // ✅ Important: Alias must match controller's `include: { as: 'user' }`
      onDelete: 'SET NULL',
    });
  };

  return Review;
};
