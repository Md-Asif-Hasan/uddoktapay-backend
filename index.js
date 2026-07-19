require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Firebase Admin SDK import with error handling
let admin;
let getFirestore;
try {
  admin = require('firebase-admin');
  if (!admin) {
    throw new Error('firebase-admin module is undefined');
  }
  getFirestore = require('firebase-admin/firestore').getFirestore;
  console.log('firebase-admin module loaded successfully');
} catch (error) {
  console.error('Failed to import firebase-admin:', error.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'capacitor://localhost',
    'file://',
    'ionic://localhost',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

// Firebase Admin SDK Initialization (Environment Variables)
let db;
try {
  // Check if required environment variables are present
  const requiredEnvVars = [
    'FIREBASE_TYPE',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_CLIENT_ID',
    'FIREBASE_AUTH_URI',
    'FIREBASE_TOKEN_URI',
    'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
    'FIREBASE_CLIENT_X509_CERT_URL',
    'UDDOKTAPAY_API_KEY',
    'UDDOKTAPAY_BASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    process.exit(1);
  }

  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  console.log('Firebase service account loaded for project:', serviceAccount.project_id);

  // Use admin.cert() directly (not admin.credential.cert)
  const app = admin.initializeApp({
    credential: admin.cert(serviceAccount),
  });

  // Access Firestore using getFirestore
  db = getFirestore();
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error.message);
  console.error('Error details:', error);
  process.exit(1);
}

// Payment packages configuration
const PAYMENT_PACKAGES = {
  lifetime_premium: {
    name: 'Lifetime Premium',
    amount: 999,
    plan: 'lifetime',
    coins: 500,
    adFree: true,
    premiumLifeAccess: true
  },
  monthly_premium: {
    name: 'Monthly Premium',
    amount: 49,
    plan: 'monthly',
    duration: 30,
    adFree: true,
    premiumLifeAccess: true
  },
  coin_bundle: {
    name: 'Coin Bundle',
    amount: 299,
    coins: 1000
  },
  starter_coin_pack: {
    name: 'Starter Coin Pack',
    amount: 99,
    coins: 300
  },
  coin_pack_a: {
    name: 'Coin Pack A',
    amount: 199,
    coins: 600
  },
  coin_pack_b: {
    name: 'Coin Pack B',
    amount: 499,
    coins: 1500
  },
  coin_pack_c: {
    name: 'Coin Pack C',
    amount: 999,
    coins: 3500
  },
  seasonal_pass: {
    name: 'Seasonal Pass',
    amount: 199,
    plan: 'seasonal',
    duration: 30
  },
  character_pack: {
    name: 'Character Pack',
    amount: 149,
    characters: 5
  },
  ad_free_week: {
    name: 'Ad-Free Week',
    amount: 29,
    adFree: true,
    duration: 7
  }
};

// POST /api/checkout - Initialize payment session
app.post('/api/checkout', async (req, res) => {
  try {
    const { packageId, uid, fullName, email, phone } = req.body;

    if (!packageId || !uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'packageId and uid are required' 
      });
    }

    const package = PAYMENT_PACKAGES[packageId];
    if (!package) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid package ID' 
      });
    }

    // Prepare UddoktaPay payment request
    const paymentData = {
      amount: package.amount,
      metadata: {
        packageId,
        uid,
        fullName: fullName || '',
        email: email || '',
        phone: phone || ''
      },
      redirect_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      webhook_url: `${process.env.WEBHOOK_URL || 'https://your-backend-url.onrender.com'}/api/webhook`
    };

    // Call UddoktaPay API
    const uddoktaPayResponse = await axios.post(
      `${process.env.UDDOKTAPAY_BASE_URL}/checkout`,
      paymentData,
      {
        headers: {
          'RT-UDDOKTAPAY-API-KEY': process.env.UDDOKTAPAY_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (uddoktaPayResponse.data.success) {
      res.json({
        success: true,
        paymentUrl: uddoktaPayResponse.data.payment_url,
        invoiceId: uddoktaPayResponse.data.invoice_id
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to create payment session'
      });
    }
  } catch (error) {
    console.error('Checkout error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error during checkout'
    });
  }
});

// POST /api/webhook - Handle UddoktaPay payment notifications
app.post('/api/webhook', async (req, res) => {
  try {
    // Verify webhook source by validating the API key header
    const requestApiKey = req.headers['rt-uddoktapay-api-key'];
    if (!requestApiKey || requestApiKey !== process.env.UDDOKTAPAY_API_KEY) {
      console.warn('Unauthorized webhook request received');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { invoice_id, status, amount, metadata, transaction_id } = req.body;

    if (status === 'completed') {
      const { packageId, uid } = metadata;
      const package = PAYMENT_PACKAGES[packageId];

      if (!package) {
        console.error('Invalid package ID in webhook:', packageId);
        return res.status(400).json({ success: false, error: 'Invalid package' });
      }

      // Update user profile in Firestore
      const userRef = db.collection('eternora_userProfiles').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.error('User not found:', uid);
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const userData = userDoc.data();
      const currentCoins = userData.eternora_currencyBalance || 0;
      const paymentHistory = userData.eternora_paymentHistory || [];

      // Check if transaction has already been processed (idempotency check)
      const alreadyProcessed = paymentHistory.some(
        payment => payment.invoiceId === invoice_id || payment.transactionId === transaction_id
      );
      if (alreadyProcessed) {
        console.log(`Webhook: transaction ${transaction_id} or invoice ${invoice_id} already processed.`);
        return res.json({ success: true, message: 'Already processed' });
      }

      // Prepare update data
      const updateData = {
        eternora_paymentHistory: [
          ...paymentHistory,
          {
            invoiceId: invoice_id,
            transactionId: transaction_id,
            packageId,
            packageName: package.name,
            amount,
            status: 'completed',
            timestamp: new Date().toISOString()
          }
        ]
      };

      // Handle subscription updates
      if (package.plan === 'lifetime') {
        updateData.eternora_subscriptionActive = true;
        updateData.eternora_subscriptionPlan = 'lifetime';
        updateData.eternora_subscriptionStart = new Date().toISOString();
        updateData.eternora_adFree = true;
        updateData.eternora_premiumLifeAccess = true;

        // Add bonus coins for lifetime subscription
        if (package.coins) {
          updateData.eternora_currencyBalance = currentCoins + package.coins;
        }
      } else if (package.plan === 'monthly' || package.plan === 'seasonal') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (package.duration || 30));

        updateData.eternora_subscriptionActive = true;
        updateData.eternora_subscriptionPlan = package.plan;
        updateData.eternora_subscriptionStart = startDate.toISOString();
        updateData.eternora_subscriptionEnd = endDate.toISOString();
        updateData.eternora_adFree = true;
        updateData.eternora_premiumLifeAccess = true;
      }

      // Handle coin purchases
      if (package.coins && !package.plan) {
        updateData.eternora_currencyBalance = currentCoins + package.coins;
      }

      // Handle ad-free purchases
      if (package.adFree && !package.plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (package.duration || 7));

        updateData.eternora_adFree = true;
        updateData.eternora_adFreeEnd = endDate.toISOString();
      }

      // Handle character pack purchases
      if (package.characters) {
        const unlockedCharacters = userData.eternora_unlockedCharacters || [];
        // Add character pack unlock logic here
        updateData.eternora_unlockedCharacters = unlockedCharacters;
      }

      await userRef.update(updateData);
      console.log('User profile updated successfully for uid:', uid);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// GET /api/verify/:uid - Verify subscription status
app.get('/api/verify/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    const userRef = db.collection('eternora_userProfiles').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();
    const subscriptionActive = userData.eternora_subscriptionActive || false;
    const subscriptionPlan = userData.eternora_subscriptionPlan || null;
    const subscriptionEnd = userData.eternora_subscriptionEnd || null;

    // Check if subscription has expired
    let isActive = subscriptionActive;
    if (subscriptionEnd) {
      const endDate = new Date(subscriptionEnd);
      if (endDate < new Date()) {
        isActive = false;
        // Update expired subscription
        await userRef.update({
          eternora_subscriptionActive: false,
          eternora_adFree: false,
          eternora_premiumLifeAccess: false
        });
      }
    }

    res.json({
      success: true,
      subscription: {
        active: isActive,
        plan: subscriptionPlan,
        end: subscriptionEnd
      },
      adFree: userData.eternora_adFree || false,
      premiumLifeAccess: userData.eternora_premiumLifeAccess || false,
      coins: userData.eternora_currencyBalance || 0
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify subscription' 
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'UddoktaPay Payment Gateway Backend is running successfully.',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
