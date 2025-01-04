// models/Message.js
module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        chatId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Chats',
                key: 'id',
            },
        },
        senderType: {
            type: DataTypes.ENUM('user', 'storeOwner'),
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    });

    Message.associate = (models) => {
        Message.belongsTo(models.Chat, { foreignKey: 'chatId', as: 'chat' });
    };

    return Message;
};
