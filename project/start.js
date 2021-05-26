const querystring = require('querystring');
const axios = require('axios');
const session = require('express-session');
const NodeCache = require('node-cache');

var request = require("request");
var express = require('express');
const { query } = require('express');
const { access } = require('fs');
var app = express();

const accessTokenCache = new NodeCache();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname));

// views is directory for all template files
app.set('views', __dirname + '/html');
app.set('view engine', 'ejs');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const REDIRECT_URI = "http://localhost:5000/oauth-callback";
const authUrl = "https://app.hubspot.com/oauth/authorize?client_id=2e597278-27db-4592-aa19-3c25ba0af946&redirect_uri=http://localhost:5000/oauth-callback&scope=contacts";

// IMPORTANT: When coppying this code to production, make sure to make this a database not an object!
const refreshTokenStore = {};

app.use(session({
  secret: Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: true
}));

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/weather', function(request, response) {
  response.render('pages/weather', {apiKey: process.env.WEATHER_API});
});

app.get('/projects', function(request, response) {
  response.render('pages/projects');
});

const isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

const getToken = async (userId) => {
  if (accessTokenCache.get(userId)){
    console.log(accessTokenCache.get(userId));
    return accessTokenCache.get(userId);
  } else {
    try {
      const refreshTokenProof = {
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        refresh_token: refreshTokenStore[userId]
      };
      const responseBody = await axios.post('https://api.hubapi.com/oauth/v1/token', querystring.stringify(refreshTokenProof));
      refreshTokenStore[userId] = responseBody.data.refresh_token;
      accessTokenCache.set(userId, responseBody.data.access_token, Math.round(responseBody.data.expires_in * 0.75));
      console.log("Getting refresh token")
      return responseBody.data.access_token;
    } catch (e) {
      console.error(e);
    }
  }
}

// 1. Send user to authentication page
app.get('/auth', async (req, res) => {
  if (isAuthorized(req.sessionID)) {
    const accessToken = await getToken(req.sessionID);
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


// 2. Get temp auth key from Oauth servers
// 3. Combine temp key with app credentials and send back to OAuth servers
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
    // 4. Get access and refresh tokens
    refreshTokenStore[req.sessionID] = responseBody.data.refresh_token;
    accessTokenCache.set(req.sessionID, responseBody.data.access_token, Math.round(responseBody.data.expires_in * 0.75));
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
