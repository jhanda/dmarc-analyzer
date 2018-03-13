// Dependencies
// -----------------------------------------------------
var bodyParser      = require('body-parser');
var express         = require('express');
var session         = require('express-session');
var favicon 		    = require('serve-favicon');
var methodOverride  = require('method-override');
var moment 			    = require('moment');
var mongoose        = require('mongoose');
var morgan          = require('morgan');
var path 			      = require('path');
var port            = process.env.PORT || 9000;
var request     	  = require ('request');
var app             = express();

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

// Express Configuration
// -----------------------------------------------------
// Sets the connection to MongoDB
mongoose.connect("mongodb://127.0.0.1/dmarc-analyzer");
mongoose.set('debug', true);

// Logging and Parsing
//app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));
app.use(express.static(__dirname + '/public'));                 // sets the static files location to public
app.use('/bower_components',  express.static(__dirname + '/bower_components')); // Use BowerComponents
app.use(morgan('dev'));                                         // log with Morgan
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.urlencoded({extended: true}));               // parse application/x-www-form-urlencoded
app.use(bodyParser.text());                                     // allows bodyParser to look at raw text
app.use(bodyParser.json({ type: 'application/vnd.api+json'}));  // parse application/vnd.api+json as json
app.use(methodOverride());
app.use(session({ secret: 'anything' }));


app.use(passport.initialize());
app.use(passport.session());

// passport config
var User = require('./server/models/User');
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Routes
// ------------------------------------------------------
//require('./app/routes.js')(app);
//var routes = require('./routes/index');
var email = require('./server/routes/email');
var aggregateReports = require('./server/routes/aggregateReports');
app.use('/email', email);
app.use('/aggregatereports', aggregateReports);

// Point static path to dist
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Listen
// -------------------------------------------------------
var server = app.listen(port);
server.timeout = 240000;

console.log('App listening on port ' + port);
