const { Invoice, Store } = require('../models');
const { sendInvoiceEmail } = require('../services/emailService');

exports.generateInvoice = async (storeId, amount, transactionId = null) => {
    try {
        const store = await Store.findByPk(storeId);
        if (!store) throw new Error('Store not found');

        const now = new Date();
        const dueDate = new Date();
        dueDate.setMonth(now.getMonth() + 1);

        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const invoice = await Invoice.create({
            store_id: storeId,
            invoice_number: invoiceNumber,
            billing_date: now,
            due_date: dueDate,
            amount,
            payment_status: transactionId ? 'paid' : 'unpaid',
            mpesa_transaction_id: transactionId,
        });

        await sendInvoiceEmail(store.primary_email, {
            storeName: store.name,
            invoiceNumber,
            billingDate: now.toDateString(),
            dueDate: dueDate.toDateString(),
            amount,
            paymentStatus: transactionId ? 'Paid' : 'Unpaid',
        });

        return invoice;
    } catch (error) {
        console.error('Error generating invoice:', error);
        throw new Error('Could not generate invoice');
    }
};
