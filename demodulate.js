// Called whenever a new message is received. Message is the only argument.
var messageReceivedCallback = null;
// Called to draw the buffer whenever an "interesting" buffer appears.
// Buffer is the only argument.
var drawBufferCallback = null;

var demodulateParams = {
  carrierWaveFrequency: 10000;
  samplesPerBit: 128,
  noiseThreshold: 0.03,
  zeroOneThreshold: 0.09,
  readWindowSize: 64,  // Size of chunks read from the buffer (in samples).
  inputBufferSize: 16384,  // Size of the input buffer (in samples). 
};

// Converts an array of 0/1 bits to a string.
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

// Converts an array of 8 0/1 bits into a byte.
function bitsToByte(bits) {
  var retval = bits[7];
  for (var i = 6; i >= 0; i -= 1) {
    retval = (retval << 1) + bits[i];
  }
  return retval;
}

// Calculates the sum of positive elements in the array, starting from
// startIndex and going till endIndex.
function arrayWindowPositiveAverage(array, startIndex, endIndex) {
  var sum = 0.0;
  if (endIndex == startIndex) {
    return 0;
  }
  for (var i = startIndex; i < endIndex; i += 1) {
    sum += Math.max(array[i], 0);
  }
  return sum / (endIndex - startIndex);
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = null;
var scriptNode = null;

audioContext = new AudioContext();
scriptNode = audioContext.createScriptProcessor(
  demodulateParams.inputBufferSize, 1, 1);
scriptNode.onaudioprocess = processBuffer;

var alignedBuffer = new Float32Array(65536);
var alignedBufferLength = 0;
var message = [];
var inTransmission = false;
var bufferCount = 0;

function processSymbol(alignedBuffer) {
  var posAvg = arrayWindowPositiveAverage(alignedBuffer, 0,
                                           demodulateParams.samplesPerBit);
  message.push(posAvg < demodulateParams.zeroOneThreshold ? 0 : 1);
}

// End of transmission.
function endOfTransmission() {
  console.log("read %d bits", message.length);
  console.log("raw message:", message);
  stringMessage = messageToString(message);
  console.log(stringMessage);
  if (messageReceivedCallback) {
    messageReceivedCallback(stringMessage);
  }
  alignedBufferLength = 0;
  message = [];
}

function processAligned(buf, startIndex, length) {
  for (var i = 0; i < length; i +=1 ) {
    alignedBuffer[alignedBufferLength + i] = buf[startIndex + i];
  }
  alignedBufferLength += length;

  if (alignedBufferLength >= demodulateParams.samplesPerBit) {
    processSymbol(alignedBuffer);
    alignedBufferLength = 0;
  }
}

function processBuffer(audioProcessingEvent) {
  var t0 = performance.now();
  bufferCount += 1;
  var inputBuffer = audioProcessingEvent.inputBuffer;
  var buf = inputBuffer.getChannelData(0);

  var interestingBuffer = "";
  for (var i = 0; i < buf.length / demodulateParams.readWindowSize; i+=1) {
    var posAvg = arrayWindowPositiveAverage(
      buf, i * demodulateParams.readWindowSize,
      (i + 1) * demodulateParams.readWindowSize);
    if (posAvg > demodulateParams.noiseThreshold) {
      processAligned(buf, i * demodulateParams.readWindowSize,
                     demodulateParams.readWindowSize);
      if (!inTransmission) {
        interestingBuffer += "starting buffer";
      }
      inTransmission = true;
    } else {
      if (inTransmission) {
        interestingBuffer += " ending buffer";
        endOfTransmission();
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
    alert("Event processing took longer than the input buffer length.");
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
  bandFilter = audioContext.createBiquadFilter();

  bandFilter.type = "band"
  bandFilter.frequency = demodulateParams.carrierWaveFrequency;
  bandFilter.Q = 1000;

  // Workaround for
  // https://stackoverflow.com/questions/19482155/do-webaudio-scriptprocessornodes-require-an-output-to-be-connected
  var dummy_gain = audioContext.createGain();
  dummy_gain.connect(audioContext.destination);

  micSource.connect(bandFilter);
  bandFilter.connect(scriptNode);
  scriptNode.connect(dummy_gain);
}
