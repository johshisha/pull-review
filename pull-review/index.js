// Description:
//   Assigns and notifies reviewers for GitHub pull requests
//
// Commands:
//   [hubot] review <GitHub PR URL> - assign and notify reviewers for GitHub PR
//   [hubot] review <GitHub PR URL> again - reassign and notify reviewers for GitHub PR
//
// Author:
//   Ivan Malopinsky

var PullReview = require('./src/index');
var url = require('./src/url');

module.exports = function (input) {
  input = input || {};
  var isHubot = input.name !== undefined && input.adapterName !== undefined && input.logger !== undefined && input.listen !== undefined && input.hear !== undefined;
  var isAPI = input.pullRequestURL !== undefined;

  if (isHubot) {
    var robot = input;
    robot.hear(/github\.com\//, function (res) {
      var adapter = robot.adapterName;
      var chatText = res.message.text;
      var chatRoom = res.message.room;
      var chatChannel = adapter === 'slack' ? 'hubot:slack' : 'hubot:generic';

      function logError(e) {
        robot.logger.error('[pull-review]', e);
        res.send('[pull-review] ' + e);
      }

      if (adapter === 'slack') {
        var slackRoom = robot.adapter.client.rtm.dataStore.getChannelGroupOrDMBYId(chatRoom);
        chatRoom = slackRoom.name;
      }

      var pullRequestURL;
      var retryReview;

      var urls = url.extractURLs(chatText);
      var processedText = chatText.replace(/\s+/g, ' ').replace(/(\breview | again\b)/ig, function (m) { return m.toLowerCase(); });

      if (Array.isArray(urls)) {
        for (var i = 0; i < urls.length; i++) {
          var u = urls[i];
          var uo = url.parseURL(u);

          if (uo.hostname === 'github.com') {
            var reviewIndex = processedText.indexOf('review ' + u);
            if (reviewIndex !== -1) {
              retryReview = processedText.indexOf('review ' + u + ' again') === reviewIndex;
              pullRequestURL = u;
              break;
            }
          }
        }
      }

      if (!pullRequestURL) {
        return;
      }

      PullReview({
        'pullRequestURL': pullRequestURL,
        'retryReview': retryReview,
        'chatRoom': chatRoom,
        'chatChannel': chatChannel,
        'isChat': true,
        'notifyFn': function (message) {
          robot.logger.info(message);
          res.send(message);
        }
      })
        .then(function (response) {
          try {
            if (response instanceof Error) {
              logError(response);
            }
          } catch (err) {
            logError(err);
          }
        })
        .catch(logError);
    });
  } else if (isAPI) {
    return PullReview(input);
  } else {
    throw Error('Invalid input: either a review request or a Hubot reference must be provided');
  }
};