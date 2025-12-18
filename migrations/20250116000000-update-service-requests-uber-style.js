'use strict';

/**
 * Migration: Update Service Requests for Uber-style realtime bidding
 *
 * This migration adds support for:
 * - Three request types: IMMEDIATE, SCHEDULED, CHECK_LATER
 * - Scheduled date/time for future services
 * - Cutoff time for when offers should stop
 * - Updated status flow: OPEN → BOOKED → EXPIRED
 *
 * Reference: D3_Service_Request_SRS.pdf & D3_Service_Request_Technical_Design.pdf
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add new urgency field (request type)
    await queryInterface.addColumn('service_requests', 'urgency', {
      type: Sequelize.ENUM('IMMEDIATE', 'SCHEDULED', 'CHECK_LATER'),
      allowNull: true, // Allowing null initially for existing records
      after: 'timeline',
      comment: 'Request type: IMMEDIATE (realtime), SCHEDULED (future), CHECK_LATER (async)'
    });

    // 2. Add scheduled date/time field for SCHEDULED requests
    await queryInterface.addColumn('service_requests', 'scheduledDateTime', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'urgency',
      comment: 'When the service is needed (for SCHEDULED requests)'
    });

    // 3. Add cutoff time field for when offers should stop
    await queryInterface.addColumn('service_requests', 'cutoffTime', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'scheduledDateTime',
      comment: 'When offers should stop being accepted (for SCHEDULED requests)'
    });

    // 4. Update status enum to include new states
    // Note: MySQL doesn't allow direct ENUM modification, so we need to change the column type
    await queryInterface.changeColumn('service_requests', 'status', {
      type: Sequelize.ENUM(
        'open',           // Initial state - accepting offers
        'booked',         // NEW: Offer accepted, service booked
        'in_progress',    // Service is being performed
        'completed',      // Service completed successfully
        'expired',        // NEW: Request expired without booking
        'cancelled',      // Cancelled by client
        'disputed'        // Service disputed
      ),
      defaultValue: 'open'
    });

    // 5. Add index on urgency for faster filtering
    await queryInterface.addIndex('service_requests', ['urgency', 'status', 'createdAt'], {
      name: 'idx_service_requests_urgency_status_created'
    });

    // 6. Add index on scheduledDateTime for scheduled requests
    await queryInterface.addIndex('service_requests', ['scheduledDateTime', 'urgency'], {
      name: 'idx_service_requests_scheduled_datetime'
    });

    // 7. Add index on cutoffTime for expiry processing
    await queryInterface.addIndex('service_requests', ['cutoffTime', 'status'], {
      name: 'idx_service_requests_cutoff_time'
    });

    // 8. Migrate existing data: Set urgency based on timeline
    // This is optional - you can keep existing requests with null urgency
    // or migrate them to CHECK_LATER as a safe default
    await queryInterface.sequelize.query(`
      UPDATE service_requests
      SET urgency = CASE
        WHEN timeline = 'urgent' THEN 'IMMEDIATE'
        WHEN timeline IN ('thisweek', 'nextweek') THEN 'SCHEDULED'
        ELSE 'CHECK_LATER'
      END
      WHERE urgency IS NULL AND status = 'open'
    `);

    console.log('✅ Service Requests table updated for Uber-style realtime bidding');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('service_requests', 'idx_service_requests_urgency_status_created');
    await queryInterface.removeIndex('service_requests', 'idx_service_requests_scheduled_datetime');
    await queryInterface.removeIndex('service_requests', 'idx_service_requests_cutoff_time');

    // Remove new columns
    await queryInterface.removeColumn('service_requests', 'cutoffTime');
    await queryInterface.removeColumn('service_requests', 'scheduledDateTime');
    await queryInterface.removeColumn('service_requests', 'urgency');

    // Revert status enum to original
    await queryInterface.changeColumn('service_requests', 'status', {
      type: Sequelize.ENUM('open', 'in_progress', 'completed', 'cancelled', 'disputed'),
      defaultValue: 'open'
    });

    console.log('✅ Service Requests table reverted to original schema');
  }
};
