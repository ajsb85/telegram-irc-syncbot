var _ = require('lodash');
var fs = require('fs');
var mkdirp = require('mkdirp');
var defaultConfig = require('./config.defaults');

if (process.argv[2] === '--genconfig') {
    mkdirp(process.env.HOME + '/.teleirc');

    // read default config using readFile to include comments
    var config = fs.readFileSync(__dirname + '/config.defaults.js');
    var configPath = process.env.HOME + '/.teleirc/config.js';
    fs.writeFileSync(configPath, config);
    console.log('Wrote default configuration to ' + configPath +
                ', please edit it before re-running');
    process.exit(0);
}

module.exports = function() {
    var config={};

    /*try {
        config = require(process.env.HOME + '/.teleirc/config.js');
    } catch (e) {
        console.log('ERROR while reading config:\n' + e + '\n\nPlease make sure ' +
                      'it exists and is valid. Run "teleirc --genconfig" to ' +
                      'generate a default config.');*/
	    try {
	        config.sendTopic = true;//process.env['TELEGRAMBOT_sendTopic'];
	        console.log("zzzzzzz");
	        config.tgToken = process.env['TOKEN'];
	        config.showMedia = false;//process.env['TELEGRAMBOT_showMedia'];
	        config.mediaRandomLength = 8;//process.env['TELEGRAMBOT_mediaRandomLenght'];
	        config.maxMsgAge = 86400;//process.env['TELEGRAMBOT_maxMsgAge'];
	        config.httpPort = 9091;//process.env['TELEGRAMBOT_httpPort'];
	        config.httpLocation = 'http://vrici.lojban.org:9091';//process.env['TELEGRAMBOT_httpLocation'];
	        config.nickcolor = true;//process.env['TELEGRAMBOT_nickcolor'];
	        config.nameFormat = '%username%';//process.env['TELEGRAMBOT_nameFormat'];
	        config.usernameFallbackFormat = '%firstName% %lastName%';
	        config.ircNick = 'ttttt';//process.env['TELEGRAMBOT_ircNick'];
	        config.ircServer = 'irc.freenode.net';//process.env['TELEGRAMBOT_ircServer'];
	        console.log("YYYYYYYY");
	        config.channels = [JSON.parse(process.env['CHANNELS'])];
	        config.ircOptions = JSON.parse(process.env['OPTIONS']);
	        config.ircRelayAll = true;//process.env['TELEGRAMBOT_ircRelayAll'];
	    }
	    catch(e){
	         //process.exit(1);
             config = _.defaults(config, defaultConfig);
	    }
   
    //}
    console.log("YYYY " + JSON.stringify(config.channels));
    return config;
};
