const querystring = require('querystring');
const axios = require('axios');
const session = require('express-session');

var request = require("request");
var express = require('express');
const { query } = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname));

// views is directory for all template files
app.set('views', __dirname + '/html');
app.set('view engine', 'ejs');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const REDIRECT_URI = "http://localhost:5000/oauth-callback";
const authUrl = "https://app.hubspot.com/oauth/authorize?client_id=2e597278-27db-4592-aa19-3c25ba0af946&redirect_uri=http://localhost:5000/oauth-callback&scope=contacts";

// This would typically be a database but is an object in this demo for simplicity
const tokenStore = {};

app.use(session({
  secret: Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: true
}));

const isAuthorized = (userId) => {
  return tokenStore[userId] ? true : false;
};

app.get('/', function(request, response) {
  response.render('pages/index', {apiKey: process.env.WEATHER_API});
});

app.get('/about', function(request, response) {
  response.render('pages/about');
});

app.get('/projects', function(request, response) {
  response.render('pages/projects');
});

app.get('/auth', async (req, res) => {
  if (isAuthorized(req.sessionID)) {
    const accessToken = tokenStore[req.sessionID];
    var options = {
      method: 'GET',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      qs: {limit: '10', archived: 'false'},
      headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`
      }
    };
    try {
      request(options, function (error, response, body) {
        if (error) throw new Error(error);
        res.render('pages/auth', {
          token: accessToken,
          contacts: JSON.parse(body).results 
        });
      });
    } catch(e) {
      console.error(e);
    }
  } else {
    res.render('pages/auth', {authUrl: authUrl, token: null});
  }
});

app.get('/oauth-callback', async (req, res) => {
  // res.send(req.query.code);
  const authCodeProof = {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code: req.query.code
  };
  try {
    const responseBody = await axios.post('https://api.hubapi.com/oauth/v1/token', querystring.stringify(authCodeProof));
    // res.json(responseBody.data);
    tokenStore[req.sessionID] = responseBody.data.access_token;
    res.redirect('/auth');
  } catch (e) {
    console.error(e);
  }
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


// This file is what handles incoming requests and
// serves files to the browser, or executes server-side code
