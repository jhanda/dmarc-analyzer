var fs              = require('fs');
var readline        = require('readline');
var {google}        = require('googleapis');
const {GoogleAuth, JWT, OAuth2Client} = require('google-auth-library');
//var googleAuth      = require('google-auth-library');
var Email           = require('./models/Email.js');
var AggregateReport = require('./models/AggregateReport.js');
var mongoose        = require('mongoose');
var parseString     = require('xml2js').parseString;
const zlib          = require('zlib');

// Sets the connection to MongoDB
mongoose.connect("mongodb://127.0.0.1/dmarc-analyzer");
mongoose.set('debug', false);

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/gmail-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'dmarc-importer.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Gmail API.
  authorize(JSON.parse(content), start);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new GoogleAuth();
  //var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
  var oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function start(auth) {
  //Find the label ID for the Processed label.
  getLabelId(auth, 'Processed', function(err, labelId){
    if (err){
      console.log(err);
    }

    processEmails(auth, labelId, function(err, result){
    });
  });
}

// ====================================================

/**
 * Get the Label ID for the label that will indicate the message
 * has been processed succsefully.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} labelName Name of the requested label.
 * @param {function} callback The callback to call with the authorized client.
 */
function getLabelId(auth, labelName, callback) {
  var labelId;
  var gmail = google.gmail('v1');
  gmail.users.labels.list({
    auth: auth,
    userId: 'me',
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      callback(err, null);
      return;
    }

    var labels = response.data.labels;
    if (labels.length == 0) {
      console.log('No labels found.');
    } else {
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].name == labelName){
          labelId = labels[i].id;
        }
      }

      callback(null, labelId);
      return;
    }
  });
}

/**
 * Lists the messages in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} labelId Id of the label to be applied to successfully processed messages.
 * @param {function} callback The callback to call with the authorized client.
 */
function processEmails(auth, labelId, callback) {
  var gmail = google.gmail('v1');
  gmail.users.messages.list({
    auth: auth,
    userId: 'me',
    labelIds:['Label_2']
  }, function(err, response) {
    if (err) {
      //console.log("error in process emails - " );
      //console.log('- %j', response);
      //console.log(err);
      callback(err, null);
      return;
    }

    var messages = response.data.messages;
    if (messages.length == 0) {
      console.log('No messages found.');
    } else {
      for (var i = 0; i < messages.length; i++) {
        processEmail(auth, messages[i], function(err, message){
          if (err){
            callback(err, null);
            return;
          }

          processAttachment(auth, message, function(err, message){
            if(err){
              callback(err, null);
              return;
            }

            updateLabel(auth, message.id, labelId, function(err, result){
              if(err){
                callback(err, null);
              }

              //console.log(result);
              callback(null, result);
              return;
            });
          });
        });
      }
    }

    callback(null, null);
    return;
  });
}

/**
 * Get Message Details
 *
* @param {google.auth.OAuth2} auth An authorized OAuth2 client.
* @param {number} id An authorized OAuth2 client.
 */
function processEmail(auth, message, callback) {
  var gmail = google.gmail('v1');
  gmail.users.messages.get({
    auth: auth,
    userId: 'me',
    id: message.id,
    format: 'full'
  }, function(err, response) {
    if (err) {
      console.log(err);
      callback(err, null);
      return;
    }

    var fullMessage = response.data;

    if (message.id == '161fa6521c6e2949'){
      //console.log('Bad message --- %j', fullMessage);
    } 
    
    if (message.id == '161fdf9847bccedc'){
      //console.log('Good message --- %j', fullMessage);
    } 
    
    var headerMap = new Map(response.data.payload.headers.map((i) => [i.name, i.value]));

    var internalDate = new Date(0);
    internalDate.setUTCMilliseconds(fullMessage.internalDate);

    // Create an instance of model Email
    var messageModel = new Email({ gmailId: message.id,
      snippet: fullMessage.snippet,
      labelIds: fullMessage.labelIds,
      internalDate: internalDate,
      subject: headerMap.get("Subject"),
      from: headerMap.get("From"),
      sender: headerMap.get("Sender")
    });

    messageModel.save(function (err) {
      if (err){
          console.log(err);
          handleError(err);
          return;
      }

      callback(null, fullMessage);
      return;
    });
  });
}

/**
 * Get Message Attachment
 *
* @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function processAttachment(auth, message, callback) {
  
  var attachmentDetails = getAttachmentDetails(message);

  if (!attachmentDetails.attachmentId){
    callback("No attachment Id found", null);
  }

  var gmail = google.gmail('v1');
  gmail.users.messages.attachments.get({
    'auth':auth,
    'id': attachmentDetails.attachmentId,
    'messageId': message.id,
    'userId': 'me'
    }, function(err, attachment) {  
      if (err) {
        console.log('The users.messages.attachments.get call returned an error: ' + err);
        callback(err, null);
        return;
      }

      const buffer = Buffer.from(attachment.data.data, 'base64');      
          
      if (attachmentDetails.extension == 'gz'){
            zlib.unzip(buffer, (err, buffer) => {
            
              if (!err) {
                //console.log(buffer.toString());
                parseString(buffer.toString(), { explicitArray : false, ignoreAttrs : true }, function (err, result) {
                  
                 var aggregateReportModel = buildAggregateModel(message.id, result);
                  
                 aggregateReportModel.save(function (err) {
                    if (err){
                      console.log(err);
                      handleError(err);
                      return;
                    }
  
                    console.log("Saved report from : " + aggregateReportModel.reportMetadata.orgName);
                    callback(null, message);
                    return;
                  });
  
  
                });
              } else {
                console.log(err);
                callback("Haven't implemented yet", null);
                return;
              }
            });
          } else if(attachmentDetails.extension == 'zip'){
            
            console.log ("We don't support zip attachments")

          } else {
            callback("Inavlid attachment file extension on " + part.filename, null);
          }
          
        });
      }  

/**
 * Update the label to indicate the message has been processed
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} message Message
 * @param {String} labelId Name of the requested label.
 * @param {function} callback The callback to call with the authorized client.
 */
function updateLabel(auth, messageId, labelId, callback) {
  var labelIds = [labelId];
  var gmail = google.gmail('v1');
  gmail.users.messages.modify({
    auth: auth,
    userId: 'me',
    id: messageId,
    resource: {
      addLabelIds:labelIds
    }
  }, function(err, updatedMmessage) {
    if (err) {
      console.log('Error n the gmail.users.messages.modify call: ' + err);
      callback(err, null);
    }
    callback(null, "Label Updated");
  });
}

function getAttachmentDetails(message){

  //Some emails contain an array of parts that include filename and 
  //attachment id and some don't.  If 
  var parts = message.payload.parts;
  var attachmentId = message.payload.body.attachmentId;
  var filename = message.payload.filename;
  var extension;
  
  if(parts){
    for (var i = 0; i < message.payload.parts.length; i++) {
      var part = parts[i];
      if (part.filename && part.filename.length > 0) {
        attachmentId = part.body.attachmentId;
        filename = part.filename;
      }
    }
  }

  if (filename){
    extension = filename.split('.').pop();
  }

  attachmentDetails = {
    attachmentId: attachmentId, 
    filename: filename,
    extension: extension
  };
  
  return attachmentDetails;
}

function buildAggregateModel(messageId, result){
    
    var begin = new Date(0);
    begin.setSeconds(result.feedback.report_metadata.date_range.begin);

    var end = new Date(0);
    end.setSeconds(result.feedback.report_metadata.date_range.end);

    // Create an instance of model SomeModel
    var aggregateReportModel = new AggregateReport({
      gmailId: messageId,
      reportMetadata: {
        orgName: result.feedback.report_metadata.org_name,
        email: result.feedback.report_metadata.email,
        extraContactInfo: result.feedback.report_metadata.extra_contact_info,
        reportId: result.feedback.report_metadata.report_id,
        dateRange: {
          begin: begin,
          end: end
        },
      },
      policyPublished: {
        domain: result.feedback.policy_published.domain,
        adkim: result.feedback.policy_published.adkim,
        aspf: result.feedback.policy_published.aspf,
        p: result.feedback.policy_published.p,
        sp: result.feedback.policy_published.sp,
        pct: result.feedback.policy_published.pct
      }
    });

    //TODO:  Add a null check before adding each part of the object.
    //       Some reports don't have the auth_results.dkim section
    for (var i = 0; i < result.feedback.record.length; i++){
      var record = {
        row: {
          sourceIp: result.feedback.record[i].row.source_ip,
          count: result.feedback.record[i].row.count,
          policyEvaluated: {
            disposition: result.feedback.record[i].row.policy_evaluated.disposition,
            dkim: result.feedback.record[i].row.policy_evaluated.dkim,
            spf: result.feedback.record[i].row.policy_evaluated.spf
          },
          identifiers: {
            headerFrom: result.feedback.record[i].identifiers.header_from
          }
        }
      }

      //Check for authResults and addThem
      if (result.feedback.record[i].auth_results){
        var authResultsObj = new Object();

        if(result.feedback.record[i].auth_results.spf){
          var spfObj = {
            domain: result.feedback.record[i].auth_results.spf.domain,
            result: result.feedback.record[i].auth_results.spf.result
          };

          authResultsObj.spf = spfObj;
        }

        if(result.feedback.record[i].auth_results.dkim){
          var dkimObj = {
            domain: result.feedback.record[i].auth_results.dkim.domain,
            result: result.feedback.record[i].auth_results.dkim.result
          };

          authResultsObj.dkim = dkimObj;
        }

        record.authResults = authResultsObj;
      }

      aggregateReportModel.record.push(record);
    }
    return aggregateReportModel;
}