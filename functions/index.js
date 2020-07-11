const functions = require('firebase-functions');
const express = require('express');
const app = express();
const { db } = require('./util/admin');
const cors = require('cors')({ origin: true });
app.use(cors);

const {
  getAllReactions,
  postOneReaction,
  getReaction,
  commentOnReaction,
  likeReaction,
  unlikeReaction,
  deleteReaction,
} = require('./handlers/reactions');
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead,
} = require('./handlers/users');
const FBAuth = require('./util/fbAuth');

// reaction routes
app.get('/reactions', getAllReactions);
app.post('/reaction', FBAuth, postOneReaction);
app.get('/reaction/:reactionId', getReaction);
app.post('/reaction/:reactionId/comment', FBAuth, commentOnReaction);
app.get('/reaction/:reactionId/like', FBAuth, likeReaction);
app.get('/reaction/:reactionId/unlike', FBAuth, unlikeReaction);
app.delete('/reaction/:reactionId', FBAuth, deleteReaction);

// user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.https.onRequest(app);

exports.createNotificationsOnLike = functions.firestore
  .document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/reactions/${snapshot.data().reactionId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            reactionId: doc.id,
          });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });

exports.deleteNotificationsOnUnlike = functions.firestore
  .document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
      });
  });

exports.createNotificationsOnComment = functions.firestore
  .document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/reactions/${snapshot.data().reactionId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            reactionId: doc.id,
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions.firestore
  .document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('IMAGE HAS CHANGED');
      const batch = db.batch();
      return db
        .collection('reactions')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const reaction = db.doc(`/reactions/${doc.id}`);
            batch.update(reaction, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else {
      return true;
    }
  });

exports.onReactionDelete = functions.firestore
  .document('/reactions/{reactionId}')
  .onDelete((snapshot, context) => {
    const reactionId = context.params.reactionId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('reactionId', '==', reactionId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('reactionId', '==', reactionId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('reactionId', '==', reactionId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
