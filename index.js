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
  origin: function (origin, callback) {
    // Build list of allowed origins from env vars (supports comma-separated list)
    const envOrigins = (process.env.FRONTEND_URL || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'capacitor://localhost',
      'ionic://localhost',
      ...envOrigins
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
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

// ─── Payment result pages served by backend (app is Android/Capacitor, no hosted web frontend) ───

app.get('/payment-success', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Successful - Eternora</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: linear-gradient(135deg, #064e3b, #065f46, #047857);
           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: white;
           padding: 20px; }
    .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px);
            border-radius: 24px; padding: 48px 40px; text-align: center; max-width: 420px; width: 100%; }
    .icon { font-size: 72px; margin-bottom: 20px; animation: pop 0.5s ease; }
    @keyframes pop { 0%{transform:scale(0)} 80%{transform:scale(1.2)} 100%{transform:scale(1)} }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.85); font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .btn { display: inline-block; background: rgba(255,255,255,0.25); color: white;
           padding: 14px 32px; border-radius: 50px; font-size: 15px; font-weight: 600;
           text-decoration: none; border: 2px solid rgba(255,255,255,0.4);
           cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .btn:hover { background: rgba(255,255,255,0.35); }
    .countdown { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Payment Successful!</h1>
    <p>Your purchase has been confirmed and your premium benefits are being activated in Eternora.</p>
    <a class="btn" id="returnBtn" href="https://localhost/payment-success">Return to App</a>
    <div class="countdown" id="countdown">Returning to app in <span id="sec">3</span>s...</div>
  </div>
  <script>
    var t = 3;
    var el = document.getElementById('sec');
    var interval = setInterval(function() {
      t--; el.textContent = t;
      if (t <= 0) { clearInterval(interval); window.location.href = 'https://localhost/payment-success'; }
    }, 1000);
  </script>
</body>
</html>`);
});

app.get('/payment-cancel', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Cancelled - Eternora</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: linear-gradient(135deg, #1e1b4b, #312e81, #1e3a5f);
           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: white;
           padding: 20px; }
    .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px);
            border-radius: 24px; padding: 48px 40px; text-align: center; max-width: 420px; width: 100%; }
    .icon { font-size: 72px; margin-bottom: 20px; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.85); font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .btn { display: inline-block; background: rgba(255,255,255,0.25); color: white;
           padding: 14px 32px; border-radius: 50px; font-size: 15px; font-weight: 600;
           text-decoration: none; border: 2px solid rgba(255,255,255,0.4);
           cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .btn:hover { background: rgba(255,255,255,0.35); }
    .countdown { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Payment Cancelled</h1>
    <p>Your payment was not completed. No charges were made. You can return to Eternora and try again.</p>
    <a class="btn" href="https://localhost/payment-cancel">Return to App</a>
    <div class="countdown" id="countdown">Returning to app in <span id="sec">5</span>s...</div>
  </div>
  <script>
    var t = 5;
    var el = document.getElementById('sec');
    var interval = setInterval(function() {
      t--; el.textContent = t;
      if (t <= 0) { clearInterval(interval); window.location.href = 'https://localhost/payment-cancel'; }
    }, 1000);
  </script>
</body>
</html>`);
});

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

    const pkg = PAYMENT_PACKAGES[packageId];
    if (!pkg) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid package ID' 
      });
    }

    // Use BACKEND_URL for redirect URLs — backend serves its own payment result pages
    // This works for Android/Capacitor apps that have no hosted web frontend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

    // Prepare UddoktaPay payment request
    const paymentData = {
      full_name: fullName || 'Customer',
      email: email || '',
      amount: pkg.amount,
      metadata: {
        packageId,
        uid,
        fullName: fullName || '',
        email: email || '',
        phone: phone || ''
      },
      redirect_url: `${backendUrl}/payment-success`,
      cancel_url: `${backendUrl}/payment-cancel`,
      webhook_url: `${process.env.WEBHOOK_URL}/api/webhook`
    };

    console.log('Initiating UddoktaPay checkout for package:', packageId, 'uid:', uid);
    console.log('UddoktaPay URL:', `${process.env.UDDOKTAPAY_BASE_URL}/checkout`);

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

    console.log('UddoktaPay response:', uddoktaPayResponse.data);

    if (uddoktaPayResponse.data.payment_url) {
      res.json({
        success: true,
        paymentUrl: uddoktaPayResponse.data.payment_url,
        invoiceId: uddoktaPayResponse.data.invoice_id
      });
    } else {
      res.status(400).json({
        success: false,
        error: uddoktaPayResponse.data.message || 'Failed to create payment session',
        raw: uddoktaPayResponse.data
      });
    }
  } catch (error) {
    console.error('Checkout error details:', {
      message: error.message,
      responseData: error.response?.data,
      responseStatus: error.response?.status
    });
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Internal server error during checkout'
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
      const pkg = PAYMENT_PACKAGES[packageId];

      if (!pkg) {
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
            packageName: pkg.name,
            amount,
            status: 'completed',
            timestamp: new Date().toISOString()
          }
        ]
      };

      // Handle subscription updates
      if (pkg.plan === 'lifetime') {
        updateData.eternora_subscriptionActive = true;
        updateData.eternora_subscriptionPlan = 'lifetime';
        updateData.eternora_subscriptionStart = new Date().toISOString();
        updateData.eternora_adFree = true;
        updateData.eternora_premiumLifeAccess = true;

        // Add bonus coins for lifetime subscription
        if (pkg.coins) {
          updateData.eternora_currencyBalance = currentCoins + pkg.coins;
        }
      } else if (pkg.plan === 'monthly' || pkg.plan === 'seasonal') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (pkg.duration || 30));

        updateData.eternora_subscriptionActive = true;
        updateData.eternora_subscriptionPlan = pkg.plan;
        updateData.eternora_subscriptionStart = startDate.toISOString();
        updateData.eternora_subscriptionEnd = endDate.toISOString();
        updateData.eternora_adFree = true;
        updateData.eternora_premiumLifeAccess = true;
      }

      // Handle coin purchases
      if (pkg.coins && !pkg.plan) {
        updateData.eternora_currencyBalance = currentCoins + pkg.coins;
      }

      // Handle ad-free purchases
      if (pkg.adFree && !pkg.plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (pkg.duration || 7));

        updateData.eternora_adFree = true;
        updateData.eternora_adFreeEnd = endDate.toISOString();
      }

      // Handle character pack purchases
      if (pkg.characters) {
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
