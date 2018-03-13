// Email model
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var EmailSchema = new Schema({
  //gmailId: { type : String , unique : true, required : true, dropDups: true },   //The immutable ID of the message.
  gmailId: {type: String},
  snippet: { type : String },
  internalDate: { type : Date },
  labelIds: [{type: String}],
  subject: { type : String },
  from: { type : String },
  sender: { type : String },
  created_at: {type: Date, default: Date.now},
  updated_at: {type: Date, default: Date.now},
});

module.exports = mongoose.model('Email', EmailSchema);