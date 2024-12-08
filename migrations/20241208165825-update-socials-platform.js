'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Socials', 'platform', {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        isIn: [
          'facebook', 'instagram', 'twitter', 'linkedin', 'youtube',
          'tiktok', 'pinterest', 'snapchat', 'whatsapp', 'discord',
          'tumblr', 'reddit', 'vimeo', 'github', 'flickr'
        ],
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Socials', 'platform', {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        isIn: [
          'facebook', 'instagram', 'twitter', 'linkedin', 'youtube',
        ], // Original platforms before the change
      },
    });
  },
};
