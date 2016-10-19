var Telegram = require('node-telegram-bot-api');
var fs = require('fs');
var path = require('path');
var irc = require('./irc');
var nodeStatic = require('node-static');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var nickcolor = require('./nickcolor');
var c = require('irc-colors');
var myUser = {};

// tries to read chat ids from a file
var readChatIds = function(arr) {
    console.log('\n');
    console.log('NOTE!');
    console.log('=====');

    var idMissing = false;
    try {
        var json = JSON.parse(fs.readFileSync(process.env.HOME + '/.teleirc/chat_ids'));
        for (var i = 0; i < arr.length; i++) {
            var key = arr[i].tgGroup;
            if (key in json) {
                arr[i].tgChatId = json[key];
                console.log('id found for:', key, ':', json[key]);
            } else {
                console.log('id not found:', key);
                idMissing = true;
            }
        }
    } catch (e) {
        console.log('~/.teleirc/chat_ids file not found!');
        idMissing = true;
    }

    if (idMissing) {
        console.log(
            '\nPlease add your Telegram bot to a Telegram group and have' +
            '\nsomeone send a message to that group.' +
            '\nteleirc will then automatically store your group chat_id.');
    }

    console.log('\n');
};

var writeChatIds = function(config) {
    var json = {};
    for (var i = 0; i < config.channels.length; i++) {
        if (config.channels[i].tgChatId) {
            json[config.channels[i].tgGroup] = config.channels[i].tgChatId;
        }
    }
    json = JSON.stringify(json);
    fs.writeFile(process.env.HOME + '/.teleirc/chat_ids', json, function(err) {
        if (err) {
            console.log('error while storing chat ID:');
            console.log(err);
        } else {
            console.log('successfully stored chat ID in ~/.teleirc/chat_ids');
        }
    });
};

var getName = function(user, config) {
    var name = config.nameFormat;
    if (user.username) {
        name = name.replace('%username%', user.username, 'g');
        name = name.replace(/^lojban$/,'gleki');
    } else {
        // if user lacks username, use fallback format string instead
        name = name.replace('%username%', config.usernameFallbackFormat, 'g');
    }

    name = name.replace('%firstName%', user.first_name || '', 'g');
    name = name.replace('%lastName%', user.last_name || '', 'g');

    // get rid of leading and trailing whitespace
    name = name.replace(/(^\s*)|(\s*$)/g, '');
    if (config.nickcolor) {
        return nickcolor(name);
    }

    return name;
};

var getIRCName = function(msg, config) {
    var ircNickMatchRE = /^<(.*)>/;
    var results = ircNickMatchRE.exec(msg.text);
    var name;
    if (!results) {
        // Fall back to telegram name (i.e. for the topic change message)
        name = getName(msg.from, config);
    } else {
        name = results[1];
    }

    return name;
};

function randomValueBase64(len) {
    return crypto.randomBytes(Math.ceil(len * 3 / 4))
        .toString('base64')
        .slice(0, len)
        .replace(/\+/g, '0')
        .replace(/\//g, '0');
}

var serveFile = function(fileId, config, tg, callback) {
    var randomString = randomValueBase64(config.mediaRandomLenght);
    mkdirp(process.env.HOME + '/.teleirc/files/' + randomString);
    tg.downloadFile(fileId, process.env.HOME + '/.teleirc/files/' +
                                   randomString).then(function(filePath) {
        callback(config.httpLocation + '/' + randomString + '/' + path.basename(filePath));
    });
};

module.exports = function(config, sendTo) {
    // start HTTP server for media files if configured to do so
    if (config.showMedia) {
        var fileServer = new nodeStatic.Server(process.env.HOME + '/.teleirc/files');
        mkdirp(process.env.HOME + '/.teleirc/files');

        require('http').createServer(function(req, res) {
            req.addListener('end', function() {
                fileServer.serve(req, res);
            }).resume();
        }).listen(config.httpPort);
    }

    var tg = new Telegram(config.tgToken, {polling: true});

    // Get our own Telegram user
    tg.getMe().then(function(me) {
        myUser = me;
    });
    readChatIds(config.channels);

    tg.on('message', function(msg) {
        if(msg.chat.title==='1 - Scala') return;
        var age = Math.floor(Date.now() / 1000) - msg.date;
        if (config.maxMsgAge && age > config.maxMsgAge) {
            return console.log('skipping ' + age + ' seconds old message! ' +
                'NOTE: change this behaviour with config.maxMsgAge, also check your system clock');
        }

        var channel = config.channels.filter(function(channel) {
            return channel.tgGroup === msg.chat.title;
        })[0];
        if (!channel) {
            return;
        }

        if (!channel.tgChatId) {
            console.log('storing chat ID: ' + msg.chat.id);
            channel.tgChatId = msg.chat.id;
            writeChatIds(config);
        }

        if (msg.text && !msg.text.indexOf('/names')) {
            var names = sendTo.ircNames(channel);
            names.sort();
            names = 'Users on ' + (channel.chanAlias || channel.ircChan) + ':\n\n' +
                names.join(', ');

            return tg.sendMessage(channel.tgChatId, names);
        }

        // skip posts containing media if it's configured off
        if ((msg.audio || msg.document || msg.photo || msg.sticker || msg.video ||
            msg.voice || msg.contact || msg.location) && !config.showMedia) {
            return;
        }
        var text;
        var repl='';
        if (msg.reply_to_message && msg.reply_to_message.text) {//ToDo: quote images
          var replyName = getName(msg.reply_to_message.from, config);
          var txt = msg.reply_to_message.text.split(": ");
          if (c.stripColorsAndStyle(replyName) === 'lojbanbot'){
            try{
              repl = '> \"<' + txt[0] + '> ' + '' + txt.slice(1).join(": ").replace(/\n+/g,'\"\n> \"<' + txt[0] + '> ') + "\"\n";
            }catch(e){}
          } else {
            try{
              repl = '> \"<' + replyName + '> ' + '' + txt.join(": ").replace(/\n+/g,'\"\n> <' + txt[0] + '> ')  + "\"\n";
            }catch(e){}
          }
        }
        if (msg.reply_to_message && msg.text) {
            var replyName;
            if (msg.reply_to_message.from.username == myUser.username) {
                replyName = getIRCName(msg.reply_to_message, config);
            } else {
                replyName = getName(msg.reply_to_message.from, config);
            }
            if (c.stripColorsAndStyle(replyName) === 'lojbanbot'){replyName = '';}else{replyName +=': '}
            text = (msg.text||'').replace(/\n/g , '\n<' + getName(msg.from, config) + '>: ');
            sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                '' + replyName + text);
        } else if (msg.audio) {
            serveFile(msg.audio.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(sance, ' + msg.audio.duration + 's)' + url);
            });
        } else if (msg.document) {
            serveFile(msg.document.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(uencu) ' + url);
            });
        } else if (msg.photo) {
            // pick the highest quality photo
            var photo = msg.photo[msg.photo.length - 1];

            serveFile(photo.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(pixra, ' + photo.width + 'x' + photo.height + ') ' +
                    url + (msg.caption ? ' ' + msg.caption : '') + (msg.text ? ' ' + msg.text : ''));
            });
        } else if (msg.new_chat_photo) {
            // pick the highest quality photo
            var chatPhoto = msg.new_chat_photo[msg.new_chat_photo.length - 1];

            serveFile(chatPhoto.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(New chat photo, ' + chatPhoto.width + 'x' + chatPhoto.height + ') ' + url);
            });
        } else if (msg.sticker) {
            serveFile(msg.sticker.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(lanci, ' + msg.sticker.width + 'x' + msg.sticker.height + ') ' + url);
            });
        } else if (msg.video) {
            serveFile(msg.video.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(skina, ' + msg.video.duration + 's)' +
                    url + (msg.caption ? ' ' + msg.caption : '')+ (msg.text ? ' ' + msg.text : ''));
            });
        } else if (msg.voice) {
            serveFile(msg.voice.file_id, config, tg, function(url) {
                sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                    '(se bacru, ' + msg.voice.duration + 's)' + url);
            });
        } else if (msg.contact) {
            sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                '(se jikca, ' + '"' + msg.contact.first_name + ' ' +
                msg.contact.last_name + '", ' +
                msg.contact.phone_number + ')');
        } else if (msg.location) {
            sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' +
                '(stuzi, ' + 'lon: ' + msg.location.longitude +
                              ', lat: ' + msg.location.latitude + ')');
        } else if (msg.new_chat_participant) {
            /*sendTo.irc(channel.ircChan, "la\'o zoi." + getName(msg.new_chat_participant, config) +
                '.zoi. pu se jmina la\'o zoi.' + getName(msg.from, config)+".zoi. lo girzu pe la telegram");*/
        } else {
            text = (msg.text||'').replace(/\n/g , '\n<' + getName(msg.from, config) + '>: ').replace(/^@[0-9]+lojbanbot, /,'');
            sendTo.irc(channel.ircChan, repl + '<' + getName(msg.from, config) + '>: ' + text);
        }
    });
    sendTo.tg = function(channel, msg) {
        if (msg==='* Topic for channel undefined') return;
        if (msg.indexOf("* zbagamumble")===0) return;
        if (!channel.tgChatId) {
            var err = 'ERROR: No chat_id set! Add me to a Telegram group ' +
                      'and say hi so I can find your group\'s chat_id!';
            sendTo.irc(channel.ircChan, err);
            console.error(err);
            return;
        }

        tg.sendMessage(channel.tgChatId, msg, {parse_mode: "HTML"});
    };
};
