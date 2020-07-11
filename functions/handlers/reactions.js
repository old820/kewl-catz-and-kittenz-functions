const { db } = require('../util/admin');

exports.getAllReactions = (req, res) => {
  db.collection('reactions')
    .orderBy('createdAt', 'desc')
    .get()
    .then((data) => {
      let reactions = [];
      data.forEach((doc) => {
        reactions.push({
          reactionId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          userImage: doc.data().userImage,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
        });
      });
      return res.json(reactions);
    })
    .catch((error) => console.error(error));
};

exports.postOneReaction = (req, res) => {
  if (req.body.body.trim() === '') {
    return res.status(400).json({ body: 'Must not be empty' });
  }

  const newReaction = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };
  db.collection('reactions')
    .add(newReaction)
    .then((doc) => {
      const resReaction = newReaction;
      resReaction.reactionId = doc.id;
      res.json(resReaction);
    })
    .catch((error) => {
      res.status(500).json({ error: 'something went wrong' });
      console.error(error);
    });
};

// Fetch one reaction
exports.getReaction = (req, res) => {
  let reactionData = {};
  db.doc(`/reactions/${req.params.reactionId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      reactionData = doc.data();
      reactionData.reactionId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('reactionId', '==', req.params.reactionId)
        .get();
    })
    .then((data) => {
      reactionData.comments = [];
      data.forEach((doc) => {
        reactionData.comments.push(doc.data());
      });

      return res.json(reactionData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// Comment on a reaction(post)
exports.commentOnReaction = (req, res) => {
  if (req.body.body.trim() === '') {
    return res.status(400).json({ comment: 'Must not be empty' });
  }
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    reactionId: req.params.reactionId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
  };

  db.doc(`/reactions/${req.params.reactionId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection('comments').add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong' });
    });
};

exports.likeReaction = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('reactionId', '==', req.params.reactionId)
    .limit(1);

  const reactionDocument = db.doc(`/reactions/${req.params.reactionId}`);
  let reactionData;
  reactionDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        reactionData = doc.data();
        reactionData.reactionId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Scream not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            reactionId: req.params.reactionId,
            userHandle: req.user.handle,
          })
          .then(() => {
            reactionData.likeCount++;
            return reactionDocument.update({
              likeCount: reactionData.likeCount,
            });
          })
          .then(() => {
            return res.json(reactionData);
          });
      } else {
        return res.status(400).json({ error: 'Reaction already liked' });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unlikeReaction = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('reactionId', '==', req.params.reactionId)
    .limit(1);

  const reactionDocument = db.doc(`/reactions/${req.params.reactionId}`);
  let reactionData;
  reactionDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        reactionData = doc.data();
        reactionData.reactionId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Scream not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: 'Reaction not liked' });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            reactionData.likeCount--;
            return reactionDocument.update({
              likeCount: reactionData.likeCount,
            });
          })
          .then(() => {
            res.json(reactionData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.deleteReaction = (req, res) => {
  const document = db.doc(`/reactions/${req.params.reactionId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: 'Unauthorized' });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: 'Reaction deleted successfully' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
