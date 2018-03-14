// AggregateReport model
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var AggregateReportSchema = new Schema({
  gmailId: {type: String},
  //gmailId: { type : String , unique : true, required : true, dropDups: true },   //The immutable ID of the message.
  reportMetadata: {
    orgName: String,
    email: String,
    extraContactInfo: String,
    reportId: String,
    dateRange:{
      begin: Date, 
      end: Date
    }
  },
  policyPublished: {
    domain: String,
    adkim: String,
    aspf: String,
    p: String,
    sp: String,
    pct: Number
  },
  record: [{
    row: {
      sourceIp: String,
      count: Number,
      policyEvaluated: {
        disposition: String,
        dkim: String,
        spf: String
      }
    },
    identifiers: {
      headerFrom: String,
      envelopeFrom: String
    },
    authResults:{
      spf: {
        domain: String,
        result: String,
        scope: String
      },
      dkim: {
        domain: String,
        result: String,
        scope: String
      }
    }
  }],
  created_at: {type: Date, default: Date.now},
  updated_at: {type: Date, default: Date.now},
});

module.exports = mongoose.model('AggregateReport', AggregateReportSchema);