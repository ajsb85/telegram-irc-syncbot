#!/usr/bin/env node

var parseConfig = require('./parseConfig');
var config = parseConfig();

// the modules share their respective send functions via the sendTo object
var sendTo = {
    // TODO: handle this situation better
    irc: function() {
        console.log('irc not yet initialized, not sending message!');
    }, tg: function() {
        console.log('telegram not yet initialized, not sending message!');
    }
};

var irc = require('./irc')(config, sendTo);
var tg = require('./tg')(config, sendTo);

var herokuURL = process.env.HEROKU_URL
if (herokuURL) {
  var request = require('request')
  require('http').createServer(function (req, res) {
    res.end('ping heroku\n')
  }).listen(process.env.PORT)
  setInterval(function () {
    request(herokuURL).pipe(process.stdout)
  }, 5 * 60 * 1000)
}
