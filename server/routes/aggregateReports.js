var express = require('express');  
var router = express.Router();
var AggregateReport = require('../models/AggregateReport.js')

/* GET all Aggregate Reports */
router.get('/', function (req, res, next) {  
   
    AggregateReport.
        find().
        exec(function (err, docs) {
            res.json(docs);
        });
});

module.exports = router;