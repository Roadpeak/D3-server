// routes/webhooks.js
const express = require('express');
const router = express.Router();

router.post('/sendgrid/events', express.json(), (req, res) => {
  // Process SendGrid event data
  const events = req.body;
  
  events.forEach(event => {
    console.log(`SendGrid Event: ${event.event} for ${event.email}`);
    // Update your database or trigger actions based on events
  });
  
  res.status(200).send('OK');
});

module.exports = router;