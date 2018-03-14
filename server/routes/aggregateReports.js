var express = require('express');  
var router = express.Router();
var AggregateReport = require('../models/AggregateReport.js')

/* GET all Aggregate Reports */
router.get('/', function (req, res, next) {  
   
    var select = "";
    var queryObject = {}

    //Check for filter query param, which should be a comma delimited list that
    // can contain reportMetadata, record, or policyPublished
    if (req.query.filter){

        if(req.query.filter.includes("reportMetadata")){
            select = select + " reportMetadata";
        }

        if(req.query.filter.includes("record")){
            select = select + " record";
        }
        if(req.query.filter.includes("policyPublished")){
            select = select + " policyPublished";
        }
    }

    //Check for orgName
    if (req.query.orgName){
        queryObject = {'reportMetadata.orgName':req.query.orgName};
    } 
    
    AggregateReport.
        find(queryObject).
        select(select).
        exec(function (err, docs) {
            res.json(docs);
        });
});

module.exports = router;