const { Booking, Offer, Service, Store, User } = require('../models'); // Ensure models are properly imported
const QRCode = require('qrcode');
const { sendEmail } = require('../utils/emailUtil');

const BookingController = {

    async create(req, res) {
        const { offerId, userId, paymentId, paymentUniqueCode, status, startTime, endTime } = req.body;

        try {
            // Create a new booking
            const booking = await Booking.create({
                offerId,
                userId,
                paymentId,
                paymentUniqueCode,
                status: status || 'pending',
                startTime,
                endTime,
            });

            // Generate QR code for the booking
            const qrData = JSON.stringify({ paymentUniqueCode: booking.paymentUniqueCode });
            const qrCode = await QRCode.toDataURL(qrData);

            booking.qrCode = qrCode;
            await booking.save();

            // Fetch associated staff via service and offer hierarchy
            const offer = await Offer.findByPk(offerId, {
                include: {
                    model: Service,
                    attributes: ['id', 'name'],
                    include: {
                        model: Store,
                        attributes: ['id', 'name'],
                    },
                },
            });

            const service = offer?.Service;
            const assignedStaff = await service?.getStaff(); // Assuming Service has a `getStaff` association

            if (assignedStaff) {
                const emailContent = `<p>Dear ${assignedStaff.name},</p>
                <p>A new booking has been made for the service <strong>${service.name}</strong>.</p>
                <p>Booking details:</p>
                <ul>
                    <li>Start Time: ${startTime}</li>
                    <li>End Time: ${endTime}</li>
                </ul>
                <p>Thank you!</p>`;
                await sendEmail(
                    assignedStaff.email,
                    'New Booking Notification',
                    '',
                    emailContent
                );
            }

            res.status(201).json({ message: 'Booking created successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create booking' });
        }
    },

    // Get all bookings
    async getAll(req, res) {
        try {
            const bookings = await Booking.findAll();
            res.status(200).json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch bookings' });
        }
    },

    // Get a single booking by ID with all associated details
    async getById(req, res) {
        const { id } = req.params; // Get booking ID from URL params

        try {
            const booking = await Booking.findOne({
                where: { id },
                include: [
                    {
                        model: Offer, // Include Offer associated with Booking
                        attributes: ['discount', 'expiration_date', 'description', 'status'],
                        include: [
                            {
                                model: Service, // Include Service associated with Offer
                                attributes: ['name', 'price', 'duration', 'category', 'description'],
                                include: [
                                    {
                                        model: Store, // Include Store associated with Service
                                        attributes: ['name', 'location'],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        model: User, // Include User associated with Booking
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'], // Include necessary User fields
                    },
                ],
            });

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            res.status(200).json(booking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch booking details' });
        }
    },

    // Update booking
    async update(req, res) {
        const { id } = req.params;
        const { status, startTime, endTime } = req.body;

        try {
            const booking = await Booking.findByPk(id);

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            booking.status = status || booking.status;
            booking.startTime = startTime || booking.startTime;
            booking.endTime = endTime || booking.endTime;
            await booking.save();

            res.status(200).json({ message: 'Booking updated successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update booking' });
        }
    },

    // Delete booking
    async delete(req, res) {
        const { id } = req.params;

        try {
            const booking = await Booking.findByPk(id);

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            await booking.destroy();
            res.status(200).json({ message: 'Booking deleted successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to delete booking' });
        }
    },

    // Validate and fulfill booking
    async validateAndFulfill(req, res) {
        const { qrData } = req.body;

        try {
            const { paymentUniqueCode } = JSON.parse(qrData);

            const booking = await Booking.findOne({ where: { paymentUniqueCode, status: 'pending' } });

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found or already fulfilled/cancelled' });
            }

            booking.status = 'fulfilled';
            await booking.save();

            res.status(200).json({ message: 'Booking marked as fulfilled successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to validate and fulfill booking' });
        }
    },

    // Get bookings by offer
    async getByOffer(req, res) {
        const { offerId } = req.params;

        try {
            const bookings = await Booking.findAll({
                where: { offerId },
                include: [
                    {
                        model: Offer,
                        attributes: ['name', 'description'],
                        include: [
                            {
                                model: Service,
                                attributes: ['name'],
                                include: [
                                    {
                                        model: Store,
                                        attributes: ['name', 'location'],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            if (!bookings.length) {
                return res.status(404).json({ error: 'No bookings found for this offer' });
            }

            res.status(200).json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch bookings by offer' });
        }
    },

    async getByStore(req, res) {
        const { storeId } = req.params; // Get storeId from URL params

        try {
            const bookings = await Booking.findAll({
                include: [
                    {
                        model: Offer,  // Include Offer associated with Booking
                        attributes: ['discount', 'expiration_date', 'description', 'status'],
                        include: [
                            {
                                model: Service,  // Include Service associated with Offer
                                attributes: ['name', 'price', 'duration', 'category', 'description'],
                                include: [
                                    {
                                        model: Store,  // Include Store associated with Service
                                        where: { id: storeId },  // Filter to the storeId
                                        attributes: ['name', 'location'],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        model: User,  // Include User associated with Booking
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'], // Include necessary User fields
                    },
                ],
            });

            if (!bookings.length) {
                return res.status(404).json({ error: 'No bookings found for this store' });
            }

            res.status(200).json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch bookings by store' });
        }
    },

    // Mark booking as fulfilled
    async markAsFulfilled(req, res) {
        const { paymentUniqueCode } = req.body;

        try {
            const booking = await Booking.findOne({ where: { paymentUniqueCode, status: 'pending' } });

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found or already fulfilled/cancelled' });
            }

            booking.status = 'fulfilled';
            await booking.save();

            res.status(200).json({ message: 'Booking marked as fulfilled successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to mark booking as fulfilled' });
        }
    },
};

module.exports = BookingController;
