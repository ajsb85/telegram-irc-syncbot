var Irc = require('irc');
var tg = require('./tg');
var ircolors = require('irc-colors');

var lookupChannel = function(chanName, channels) {
    return channels.filter(function(channel) {
        return channel.ircChan === chanName;
    })[0];
};

// generates channel list for ircOptions
var getChannels = function(arr) {
    var result = [];

    for (var i = 0; i < arr.length; i++) {
        var chanName = arr[i].chanPwd ?
                       arr[i].ircChan + ' ' + arr[i].chanPwd :
                       arr[i].ircChan;
        result.push(chanName);
    console.log("``````"+chanName);
    }

    return result;
};

var escapeHTML = function(arg){
	return arg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
module.exports = function(config, sendTo) {
    config.ircOptions.channels = getChannels(config.channels);

    var irc = new Irc.Client(config.ircServer, config.ircNick, config.ircOptions);

    irc.on('error', function(error) {
        console.error('IRC ERROR:');
        console.error(error);
    });

    irc.on('registered', function() {
        // IRC perform on connect
        config.ircPerformCmds.forEach(function(cmd) {
            irc.send.apply(null, cmd.split(' '));
        });
    });

    irc.on('message', function(user, chanName, message) {
        var channel = lookupChannel(chanName, config.channels);
        if (!channel) {
            return;
        }
        if (message==='* Topic for channel undefined') return;
        if (message.indexOf("* zbagamumble")>=-1) console.log(message);
        if (message.indexOf("* zbagamumble")===0) return;
        var match = config.hlRegexp.exec(message);
        if (match || config.ircRelayAll) {
            if (match) {
                message = match[1];
            }
            console.log("```"+message+"```");
            message = escapeHTML(ircolors.stripColorsAndStyle(message.replace(/[[:cntrl:]](\d+,|)\d+/,""))).replace("\\u00[0-9A-F]{2,2}","");
            console.log("2```"+message+"```");
            var text = '<' + user.replace(/_+$/g,'') + '>: ' + JSON.stringify(message).replace(/^\"/,'').replace(/\"$/,'').replace(/\\u00[0-9abcdefABCDEF]+/g,'').replace(/\\\\/g,'\\');
            console.log("3```"+text+"```");
            text = text.split(" ");
            if (text.length>=1){
            	text[0] = text[0].replace(/[\[\]]/g,'').replace(/[`']/g,'h');
            }
            // console.log("```"+text);
            text=text.join(" ")
            .replace(/^<.*?>: <[0-9,]*([^\>]*?)>: /,'<b>$1</b>: ')
            .replace(/^<.*?>: &lt;[0-9,]*([^\>]*?)&gt;: /,'<$1>: ')
            .replace(/^<(.*?)>: /,'<b>$1</b>: ')
            .replace(/^<(.*?)>:\n/,'')
            //.replace(/(?<=(<b>.*?)'(?=(.*?<\/b>))/,'`')
            ;
            // console.log("```"+text);
            //```<gleki>:,&lt;^^^^&gt;,&lt;gleki&gt;:,uttering,it,is,not,hard                 
            //```<b>^^^^&gt; &lt;gleki</b>: uttering it is not hard                           
            sendTo.tg(channel, text);
        }
    });

    irc.on('action', function(user, chanName, message) {
        var channel = lookupChannel(chanName, config.channels);
        if (!channel) {
            return;
        }

        var match = config.hlRegexp.exec(message);
        if (match || config.ircRelayAll) {
            if (match) {
                message = match[1].trim();
            }
            var mes = escapeHTML(message);
            mes = mes.replace(/\b((?:(?:https?|ftp|file):\/\/|www\.|ftp\.)[-A-Z0-9+&@#/%=~_|$?!:,.]*[A-Z0-9+&@#/%=~_])\b/igm,'</i>$1<i>');
            var text = '<b>' + user.replace(/_+$/g,'') + '</b>: <i>' + mes + '</i>';
            sendTo.tg(channel, text);
        }
    });

    irc.on('topic', function(chanName, topic, nick) {
        var channel = lookupChannel(chanName, config.channels);
        if (!channel) {
            return;
        }

        // ignore first topic event when joining channel
        // (doesn't handle rejoins yet)
        if (!config.sendTopic || !channel.firstTopicRcvd) {
            channel.firstTopicRcvd = true;
            return;
        }

        var text = '* Topic for channel ' + channel.chanAlias || channel.ircChan +
                   ':\n' + topic.split(' | ').join('\n') +
                   '\n* set by ' + nick.split('!')[0];
        sendTo.tg(channel, text);
    });

    sendTo.ircNames = function(channel) {
        channel = irc.chans[channel.ircChan];

        if (!channel) {
            return;
        }

        var names = Object.keys(channel.users);

        names.forEach(function(name, i) {
            names[i] = channel.users[name] + names[i];
        });

        return names;
    };

    sendTo.irc = function(chanName, msg) {
        //console.log('  >> relaying to IRC: ' + msg);
        irc.say(chanName, msg);
    };
};
