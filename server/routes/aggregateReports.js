var express = require('express');  
var router = express.Router();
var AggregateReport = require('../models/AggregateReport.js')

/* GET all Aggregate Reports */
router.get('/', function (req, res, next) {  
   
    var select = "";
    var queryObject = {$and: []};

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
        
        var orgQuery = {
            'reportMetadata.orgName':{
                $regex: new RegExp(req.query.orgName)
            }
        };

        queryObject.$and.push(orgQuery);
    } 

    //Check for sourceIp
    if (req.query.sourceIp){
        
        var ipQuery = {
            'record':{
                $elemMatch:{
                    'row.sourceIp':{
                        $regex: new RegExp(req.query.sourceIp)
                    } 
                }
            }
        }
        queryObject.$and.push(ipQuery);
    }

    //Query returns no results if there is an empty $and array, so delete if 
    //we aren't using it.
    if (queryObject.$and.length == 0){
        delete queryObject.$and;
    }
    
    AggregateReport.
        find(queryObject).
        select(select).
        exec(function (err, docs) {
            res.json(docs);
        });
});

module.exports = router;