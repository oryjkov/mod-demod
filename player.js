var playerParams = {
  videoQ: null,
  playersDiv: null,
  numPlayers: null,
};

function tryLoadYTIframeApi() {
  if (!navigator.onLine) {
    setTimeout(tryLoadYTIframeApi, 1000);
  }

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Internals.

// Player registry.
var myPlayers = {};
function getPlayerFromEvent(event) {
  return myPlayers[event.target.getIframe().id];
}

function onPlayerReady(event) {
  var that = getPlayerFromEvent(event);
  window.setInterval(function() { that.watchDog(); }, 1000);
}

function onPlayerError(event) {
  var that = getPlayerFromEvent(event);
  // Ignore all errors and move on
  that.lastPlaybackScheduleTimeMs = 0;
}

class MyPlayer {
  constructor(playerElement, infoBox) {
    this.currentVideoDurationSec = 0;
    this.toleranceTimeSec = 5;
    this.lastPlaybackScheduleTimeMs = 0;
    this.infoBox = infoBox
    this.infoBox.textContent = 'no video';

    this.player_ = new YT.Player(playerElement.id, {
      width: '640',
      height: '480',
      playerVars: {
        'showinfo': '0',
        'modestbranding': '1',
        'controls': '0',
        'rel': '0',
      },
      events: {
        'onReady': onPlayerReady,
        'onError': onPlayerError
      }
    });
  }

  watchDog() {
    var secSinceLastPlayback = (Date.now() - this.lastPlaybackScheduleTimeMs) / 1000;
    var alarmTimeSec = this.currentVideoDurationSec + this.toleranceTimeSec;
    if (secSinceLastPlayback > alarmTimeSec) {
      this.maybeNextVideo();
      return;
    }
    // Restart if not playing or buffering.
    if (this.player_.getPlayerState() == 1 || this.player_.getPlayerState() == 3) {
      return;
    }
    if (secSinceLastPlayback > this.toleranceTimeSec) {
      this.maybeNextVideo();
      return;
    }
    if (this.player_.getPlayerState() != 1) {
      console.log(this.player_.getPlayerState());
    }
  }

  maybeNextVideo() {
    var v = playerParams.videoQ.tryGet();
    if (this.player_.getPlayerState() == 1 || this.player_.getPlayerState() == 3) { return; }
    if (v == null) {
      // Try again.
      this.lastPlaybackScheduleTimeMs = 0;
      return;
    }
    this.currentVideoDurationSec = v.e - v.s;

    this.player_.loadVideoById(
        {'videoId': v.v,
         'startSeconds': v.s,
         'endSeconds': v.s + 30});
    this.player_.mute();
    this.lastPlaybackScheduleTimeMs = Date.now();
    this.infoBox.textContent = JSON.stringify(v);
  }
}

function onYouTubeIframeAPIReady() {
  for (var i = 0; i < playerParams.numPlayers; ++i) {
    console.log('setting up player ', i);
    var div = document.createElement('span');
    div.style.display='inline-block';
    playerParams.playersDiv.appendChild(div);

    var playerDiv = document.createElement('div');
    var infoDiv = document.createElement('div');
    infoDiv.style.width = '640px';
    infoDiv.style.height = '60px';
    infoDiv.style.display = 'block';

    div.appendChild(playerDiv);
    div.appendChild(infoDiv);

    playerDiv.id = 'player' + i;
    myPlayers[playerDiv.id] = new MyPlayer(playerDiv, infoDiv)
  }
}

