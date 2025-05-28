const express = require('express');
const axios = require('axios');
const jsforce = require('jsforce');
require('dotenv').config();

const app = express();
app.use(express.json());

// Salesforce connection
const conn = new jsforce.Connection({
  loginUrl: 'https://login.salesforce.com'
});

// Login to Salesforce
async function loginToSalesforce() {
  try {
    await conn.login(
      process.env.SALESFORCE_USERNAME, 
      process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
    );
    console.log('Connected to Salesforce');
  } catch (error) {
    console.error('Salesforce login failed:', error);
  }
}

// Save message to Salesforce
async function saveMessageToSalesforce(messageData) {
  try {
    const result = await conn.sobject('Telegram_Message__c').create({
      Message_Text__c: messageData.text,
      Sender_Name__c: messageData.senderName,
      Telegram_User_ID__c: messageData.userId,
      Received_Date__c: new Date().toISOString()
    });
    
    console.log('Message saved to Salesforce:', result.id);
    return result;
  } catch (error) {
    console.error('Error saving to Salesforce:', error);
    throw error;
  }
}

// Telegram webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    if (update.message) {
      const message = update.message;
      
      // Extract message data
      const messageData = {
        text: message.text || 'No text',
        senderName: `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim() || 'Unknown',
        userId: message.from.id
      };
      
      // Save to Salesforce
      await saveMessageToSalesforce(messageData);
      
      console.log(`Message from ${messageData.senderName}: ${messageData.text}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Telegram-Salesforce Integration Running');
});

// Set Telegram webhook
async function setWebhook() {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`;
    await axios.post(url, {
      url: `${process.env.WEBHOOK_URL}/webhook`
    });
    console.log('Webhook set successfully');
  } catch (error) {
    console.error('Error setting webhook:', error);
  }
}

// Start server
async function start() {
  await loginToSalesforce();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Set webhook in production
    if (process.env.NODE_ENV === 'production') {
      setTimeout(setWebhook, 2000);
    }
  });
}

start();