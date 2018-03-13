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

      return callback(null, labelId);
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
    }

    var messages = response.data.messages;
    if (messages.length == 0) {
      console.log('No messages found.');
    } else {
      for (var i = 0; i < messages.length; i++) {
        processEmail(auth, messages[i], function(err, message){
          if (err){
            callback(err, null);
          }

          processAttachment(auth, message, function(err, message){
            if(err){
              callback(err, null);
            }

            updateLabel(auth, message.id, labelId, function(err, result){
              if(err){
                callback(err, null);
              }

              //console.log(result);

            });
          });
        });
      }

    }
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
    }

    var fullMessage = response.data;
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
          return handleError(err);
      }

      callback(null, fullMessage);
    });
  });
}

/**
 * Get Message Attachment
 *
* @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function processAttachment(auth, message, callback) {
  var gmail = google.gmail('v1');
  var parts = message.payload.parts;
  if (parts) {
    console.log(message.id + " -- " + message.snippet  + " -- " + parts.length);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part.filename && part.filename.length > 0) {
        var attachId = part.body.attachmentId;
        gmail.users.messages.attachments.get({
          'auth':auth,
          'id': attachId,
          'messageId': message.id,
          'userId': 'me'
        }, function(err, attachment) {
          if (err) {
            console.log(attachment);
            console.log('The users.messages.attachments.get call returned an error: ' + err);
            callback(err, null);
          }

          const buffer = Buffer.from(attachment.data.data, 'base64');
          zlib.unzip(buffer, (err, buffer) => {
            if (!err) {
              //console.log(buffer.toString());
              parseString(buffer.toString(), { explicitArray : false, ignoreAttrs : true }, function (err, result) {
                //console.dir(JSON.stringify(result.feedback.report_metadata.org_name));

                // Create an instance of model SomeModel
                var aggregateReportModel = new AggregateReport({
                  gmailId: message.id,
                  reportMetadata: {
                    orgName: result.feedback.report_metadata.org_name,
                    email: result.feedback.report_metadata.email,
                    extraContactInfo: result.feedback.report_metadata.extra_contact_info,
                    reportId: result.feedback.report_metadata.reportId
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

                aggregateReportModel.save(function (err) {
                  if (err){
                    console.log(err);
                    return handleError(err);
                  }

                  console.log("Saved report from : " + aggregateReportModel.reportMetadata.orgName);
                  callback(null, message);
                  return;
                });


              });
            } else {
              // handle error
              callback("Haven't implemented yet", null);
            }
          });
        });
      }
    }
  } else{
    //console.log("Haven't implemented this yet");
    //TODO:  Implement logic for messages that don't include parts.

    // console.dir(message, {depth: null, colors: true})
    console.log('Haven\'t implemented this yet - %j', message);
  }
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