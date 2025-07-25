// migrations/YYYYMMDDHHMMSS-create-chats.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      storeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('active', 'archived', 'blocked'),
        defaultValue: 'active',
        allowNull: false
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('chats', ['userId'], {
      name: 'chats_userId_index'
    });

    await queryInterface.addIndex('chats', ['storeId'], {
      name: 'chats_storeId_index'
    });

    await queryInterface.addIndex('chats', ['userId', 'storeId'], {
      unique: true,
      name: 'chats_userId_storeId_unique'
    });

    await queryInterface.addIndex('chats', ['lastMessageAt'], {
      name: 'chats_lastMessageAt_index'
    });

    await queryInterface.addIndex('chats', ['status'], {
      name: 'chats_status_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('chats');
  }
};

// migrations/YYYYMMDDHHMMSS-create-messages.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      chat_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'chats',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sender_type: {
        type: Sequelize.ENUM('user', 'merchant', 'system'),
        allowNull: false,
        defaultValue: 'user'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      messageType: {
        type: Sequelize.ENUM('text', 'image', 'file', 'system'),
        defaultValue: 'text',
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('sent', 'delivered', 'read'),
        defaultValue: 'sent',
        allowNull: false
      },
      attachments: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: true
      },
      edited_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('messages', ['chat_id'], {
      name: 'messages_chat_id_index'
    });

    await queryInterface.addIndex('messages', ['sender_id'], {
      name: 'messages_sender_id_index'
    });

    await queryInterface.addIndex('messages', ['status'], {
      name: 'messages_status_index'
    });

    await queryInterface.addIndex('messages', ['createdAt'], {
      name: 'messages_createdAt_index'
    });

    await queryInterface.addIndex('messages', ['chat_id', 'createdAt'], {
      name: 'messages_chat_id_createdAt_index'
    });

    await queryInterface.addIndex('messages', ['sender_type'], {
      name: 'messages_sender_type_index'
    });

    await queryInterface.addIndex('messages', ['messageType'], {
      name: 'messages_messageType_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('messages');
  }
};

// migrations/YYYYMMDDHHMMSS-add-chat-fields-to-users.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add chat-related fields to users table
    await queryInterface.addColumn('users', 'isOnline', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'lastSeen', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'chatSettings', {
      type: Sequelize.JSON,
      defaultValue: {
        notifications: true,
        soundEnabled: true,
        emailNotifications: true
      },
      allowNull: true
    });

    // Add index for online status
    await queryInterface.addIndex('users', ['isOnline'], {
      name: 'users_isOnline_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'isOnline');
    await queryInterface.removeColumn('users', 'lastSeen');
    await queryInterface.removeColumn('users', 'chatSettings');
  }
};

// migrations/YYYYMMDDHHMMSS-add-chat-fields-to-stores.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add chat-related fields to stores table
    await queryInterface.addColumn('stores', 'isOnline', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('stores', 'lastSeen', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('stores', 'chatSettings', {
      type: Sequelize.JSON,
      defaultValue: {
        chatEnabled: true,
        autoReply: {
          enabled: false,
          message: ''
        },
        businessHours: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' },
          saturday: { open: '09:00', close: '17:00' },
          sunday: { open: '09:00', close: '17:00' }
        }
      },
      allowNull: true
    });

    // Add index for online status
    await queryInterface.addIndex('stores', ['isOnline'], {
      name: 'stores_isOnline_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('stores', 'isOnline');
    await queryInterface.removeColumn('stores', 'lastSeen');
    await queryInterface.removeColumn('stores', 'chatSettings');
  }
};

// seeders/YYYYMMDDHHMMSS-demo-chats.js (Optional - for testing)
'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Only run this seeder if you want demo data
    // You can skip this in production

    // Get some existing users and stores for demo
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users LIMIT 5',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const stores = await queryInterface.sequelize.query(
      'SELECT id FROM stores LIMIT 3',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0 || stores.length === 0) {
      console.log('No users or stores found, skipping chat seeder');
      return;
    }

    const chats = [];
    const messages = [];

    // Create demo chats
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      const chatId = uuidv4();
      const userId = users[i].id;
      const storeId = stores[i % stores.length].id;

      chats.push({
        id: chatId,
        userId: userId,
        storeId: storeId,
        status: 'active',
        lastMessageAt: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Add some demo messages
      messages.push({
        id: uuidv4(),
        chat_id: chatId,
        sender_id: userId,
        sender_type: 'user',
        content: 'Hi! I\'m interested in your store. Can you help me?',
        messageType: 'text',
        status: 'read',
        attachments: [],
        metadata: {},
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        updatedAt: new Date(Date.now() - 60000)
      });

      messages.push({
        id: uuidv4(),
        chat_id: chatId,
        sender_id: userId, // This would be store owner in real scenario
        sender_type: 'merchant',
        content: 'Hello! Welcome to our store. How can I assist you today?',
        messageType: 'text',
        status: 'delivered',
        attachments: [],
        metadata: {},
        createdAt: new Date(Date.now() - 30000), // 30 seconds ago
        updatedAt: new Date(Date.now() - 30000)
      });
    }

    if (chats.length > 0) {
      await queryInterface.bulkInsert('chats', chats);
      await queryInterface.bulkInsert('messages', messages);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('messages', null, {});
    await queryInterface.bulkDelete('chats', null, {});
  }
};

// Run migrations with:
// npx sequelize-cli db:migrate

// Run seeders with (optional):
// npx sequelize-cli db:seed:all