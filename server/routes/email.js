var express = require('express');  
var router = express.Router();
var Email = require('../models/Email.js')

/* GET all Emails */
router.get('/', function (req, res, next) {
   
    Email.
        find().
        exec(function (err, emails) {
            res.json(emails);
        });
});

/* GET  one Email */
router.get('/:gmailId', function (req, res, next) {

    Email.
        findOne({"gmailId": req.params.gmailId}).
        exec(function (err, email) {
            res.json(email);
        });
});
module.exports = router;