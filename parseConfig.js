var _ = require('lodash');
var fs = require('fs');
var mkdirp = require('mkdirp');
var defaultConfig = require('./tg_config.defaults');

module.exports = function() {
    var config;

    try {
        config = require(process.env.HOME + '/.teleirc/config.js');
    } catch (e) {
        console.error('ERROR while reading config:\n' + e + '\n\nPlease make sure ' +
                      'it exists and is valid. Run "teleirc --genconfig" to ' +
                      'generate a default config.');
        process.exit(1);
    }

    config = _.defaults(config, defaultConfig);

    return config;
};
