const serviceAccount = require('../ServiceAccountKey.json');
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

module.exports = { admin, db };
