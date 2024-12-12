const cron = require('node-cron');
const { StoreSubscription, Invoice, Store } = require('../models');
const { sendInvoiceEmail } = require('../services/emailService');
const { Op } = require('sequelize');

cron.schedule('0 0 * * *', async () => {
    console.log('Running daily billing checks...');
    const today = new Date();

    // Find subscriptions that need billing
    const subscriptions = await StoreSubscription.findAll({
        where: {
            next_billing_date: { [Op.lte]: today },
            is_active: true,
        },
    });

    for (const subscription of subscriptions) {
        const store = await Store.findByPk(subscription.store_id);
        if (!store) continue;

        // Check if an invoice already exists for the billing date
        const existingInvoice = await Invoice.findOne({
            where: {
                store_id: subscription.store_id,
                billing_date: subscription.next_billing_date,
            },
        });

        if (!existingInvoice) {
            const now = new Date();
            const dueDate = new Date();
            dueDate.setDate(now.getDate() + 7); // 7 days due from generation

            const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

            // Generate invoice
            const invoice = await Invoice.create({
                store_id: subscription.store_id,
                invoice_number: invoiceNumber,
                billing_date: subscription.next_billing_date,
                due_date: dueDate,
                amount: 300, // KES 300 subscription fee
                payment_status: 'unpaid',
            });

            // Send invoice email
            await sendInvoiceEmail(store.primary_email, {
                storeName: store.name,
                invoiceNumber,
                billingDate: subscription.next_billing_date.toDateString(),
                dueDate: dueDate.toDateString(),
                amount: invoice.amount,
                paymentStatus: 'Unpaid',
            });

            console.log(`Generated invoice ${invoiceNumber} for Store ID: ${subscription.store_id}`);
        }

        // Update next billing date
        // Keep the same day of the month as the next billing date
        const nextBillingDate = new Date(subscription.next_billing_date);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); // +1 month for next billing date
        subscription.next_billing_date = nextBillingDate;
        await subscription.save();
    }
});
