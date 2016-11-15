var messageReceivedCallback = null;
var drawBufferCallback = null;

function messageToString(bits) {
  var i = 0;
  var retval = "";
  while (i < bits.length) {
    var b = bitsToByte(bits.slice(i, i+8));
    retval = retval + String.fromCharCode(b);
    i += 8;
  }
  return retval;
}

function bitsToByte(bits) {
  var retval = bits[7];
  for (var i = 6; i >= 0; i -= 1) {
    retval = (retval << 1) + bits[i];
    //console.log("bit: ", bits[i], ", retval: ", retval);
  }
  return retval;
}

// Calculates the sum of positive elements in the array, starting from
// start_index and going till end_index.
function window_pos_sum(array, start_index, end_index) {
  var sum = 0.0;
  for (var i = start_index; i < end_index; i += 1) {
    sum += Math.max(array[i], 0);
  }
  return sum;
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var scriptNode = null;

audioContext = new AudioContext();
scriptNode = audioContext.createScriptProcessor(16384, 1, 1);
scriptNode.onaudioprocess = processBuffer;

window.onload = function() {
  record();
}

var t_b = 128;
// empirical..
var noiseThreshold = 0.01;
var bitThreshold = 0.09;

var aligned_buffer = new Float32Array(65536);
var aligned_buffer_length = 0;

var message = [];
function processSymbol(aligned_buffer) {
  var pos_avg = window_pos_sum(aligned_buffer, 0, t_b) / t_b;
  //console.log(pos_avg);
  message.push(pos_avg < bitThreshold ? 0 : 1);
}

// End of transmission.
function eot() {
  console.log(message);
  console.log("read ", message.length, " bits");
  stringMessage = messageToString(message);
  console.log(stringMessage);
  if (messageReceivedCallback) {
    messageReceivedCallback(stringMessage);
  }
  aligned_buffer_length = 0;
  message = [];
}

function processAligned(buf, startIndex, length) {
  //aligned_buffer.set(new_data, aligned_buffer_length);
  for (var i = 0; i < length; i +=1 ) {
    aligned_buffer[aligned_buffer_length + i] = buf[startIndex + i];
  }
  aligned_buffer_length += length;

  //console.log("aligned length: ", aligned_buffer_length);
  if (aligned_buffer_length >= t_b) {
    processSymbol(aligned_buffer);
    aligned_buffer_length = 0;
  }
}

var inTransmission = false;
var bufferCount = 0;
function processBuffer(audioProcessingEvent) {
  var t0 = performance.now();
  bufferCount += 1;
  var inputBuffer = audioProcessingEvent.inputBuffer;
  var buf = inputBuffer.getChannelData(0);

  //console.log("got bytes: ", buf.length);
  // Size of chunks to append to the buffer.
  var window_size = 16;
  var interestingBuffer = "";
  for (var i = 0; i < buf.length / window_size; i+=1) {
    var pos_avg = window_pos_sum(buf, i * window_size, (i + 1) * window_size) / window_size;
    if (pos_avg > noiseThreshold) {
      processAligned(buf, i * window_size, window_size);
      if (!inTransmission) {
        interestingBuffer += "starting buffer";
      }
      inTransmission = true;
    } else {
      if (inTransmission) {
        interestingBuffer += " ending buffer";
        eot();
      }
      inTransmission = false;
    }
  }
  if (interestingBuffer.length > 0 && drawBufferCallback) {
    drawBufferCallback(buf);
  }
  var t1 = performance.now();
  if (interestingBuffer.length > 0) {
    console.log("%s: draw buffer at time %d, playback time %.2f," +
                "buffer count: %d, processing took: %.2f ms",
                interestingBuffer, audioProcessingEvent.timeStamp,
		audioProcessingEvent.playbackTime, bufferCount, (t1 - t0));
  }
  if (t1 - t0 > buf.duration) {
    alert("Event processing took longer than the buffer length.");
  }
}

function error() {
  alert('Stream generation failed.');
}

function getUserMedia(dictionary, callback) {
  try {
    navigator.getUserMedia = 
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, error);
  } catch (e) {
    alert('getUserMedia threw exception :' + e);
  }
}

function record() {
  getUserMedia({
    "audio": {
      "mandatory": {
	"googEchoCancellation": "false",
	"googAutoGainControl": "false",
	"googNoiseSuppression": "false",
	"googHighpassFilter": "false"
      },
      "optional": []
    },
  }, gotStream);
}

function gotStream(stream) {
  // Create an AudioNode from the audio in stream and connect it to the
  // destination.
  micSource = audioContext.createMediaStreamSource(stream);

  // Workaround for
  // https://stackoverflow.com/questions/19482155/do-webaudio-scriptprocessornodes-require-an-output-to-be-connected
  var dummy_gain = audioContext.createGain();
  dummy_gain.connect(audioContext.destination);

  micSource.connect(scriptNode);
  scriptNode.connect(dummy_gain);
}
