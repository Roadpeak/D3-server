module.exports = (sequelize, DataTypes) => {
    const Social = sequelize.define('Social', {
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
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },
        platform: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['facebook', 'instagram', 'twitter', 'linkedin', 'youtube']], // Add more platforms as needed
            },
        },
        link: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true,  // Ensures the link is a valid URL
            },
        },
    }, {
        // Sequelize automatically manages createdAt and updatedAt unless you specify custom behavior
        timestamps: true,  // This is enabled by default
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
    });

    Social.associate = (models) => {
        // Define associations if needed
    };

    return Social;
};
