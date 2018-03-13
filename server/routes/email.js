var express = require('express');
var router = express.Router();
var Email = require('../models/Email.js')

/* GET all Emails */
router.get('/', function (req, res, next) {
    Email.
        find().
        exec(function (err, docs) {
            res.json(docs);
        });
});

module.exports = router;