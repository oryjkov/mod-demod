// Called whenever a new message is received. Message is the only argument.
var messageReceivedCallback = null;
// Called to draw the buffer whenever an "interesting" buffer appears.
// Buffer is the only argument.
var drawBufferCallback = null;

var demodulateParams = {
  samplingFrequency: 44100,
  samplesPerBit: 256,
  noiseThreshold: 0.05,
  bitZeroFrequency: 1200,
  bitOneFrequency: 2200,
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
    sum += Math.abs(array[i]);
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

var messageBuffer = new Float32Array(65536);
var bufferLength = 0;
var message = [];
var inTransmission = false;
var inWindowOffset = 0;
var bufferCount = 0;
var oldBuf = new Float32Array(demodulateParams.samplesPerBit);

function processSymbol(buffer) {
  var zeroCrossingsThreshold = ((demodulateParams.samplesPerBit / demodulateParams.samplingFrequency) * (2200 + 1200) * 2) / 2;
  var cnt = processSymbolZeroCrossings(buffer);
  message.push(cnt < zeroCrossingsThreshold ? 0 : 1);
}

function processSymbolZeroCrossings(alignedBuffer) {
  var count = 0;
  for (var i = 1; i < demodulateParams.samplesPerBit; i++) {
    if (alignedBuffer[i - 1] * alignedBuffer[i] < 0) {
      count += 1;
    }
  }
  console.log(count);
  return count;
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
  bufferLength = 0;
  inWindowOffset = 0;
  message = [];
}

function processWindow(buf, startIndex, length) {
  for (var i = 0; i < length; i++) {
    messageBuffer[bufferLength + i] = buf[startIndex + i];
  }
  bufferLength += length;
  console.log("pushed ", length);

  while (bufferLength >= demodulateParams.samplesPerBit) {
    processSymbol(messageBuffer);
    //drawBufferCallback(messageBuffer.slice(0, bufferLength), demodulateParams.samplesPerBit, []);
    // shift the buffer left.
    messageBuffer.copyWithin(0, demodulateParams.samplesPerBit, bufferLength);
    bufferLength -= demodulateParams.samplesPerBit;
    //console.log("drawing", length);
  }
}

function processBuffer(audioProcessingEvent) {
  // Finds index of the first element bigger than threshold. 
  function findOffset(bigWindow, start, length, threshold) {
    var offset = 0;
    while (offset < length && Math.abs(bigWindow[offset + start]) < threshold) {
      offset += 1;
    }
    return offset;
  }

  var t0 = performance.now();
  bufferCount += 1;
  var inputBuffer = audioProcessingEvent.inputBuffer;
  var newBuf = inputBuffer.getChannelData(0);
  // This way we won't fall out past the end of the buffer.
  var buf = new Float32Array(oldBuf.length + newBuf.length);
  for (var i = 0; i < oldBuf.length; i++) {
    buf[i] = oldBuf[i];
  }
  for (var i = 0; i < newBuf.length; i++) {
    buf[oldBuf.length + i] = newBuf[i];
  }
  for (var i = 0; i < oldBuf.length; i++) {
    oldBuf[i] = newBuf[newBuf.length - oldBuf.length + i];
  }

  var highlights = [];
  var interestingBuffer = "";
  var bigWindowSize = demodulateParams.samplesPerBit;
  for (var i = 0; i < newBuf.length; i += bigWindowSize) {
    var posAvg = arrayWindowPositiveAverage(buf, i, i + bigWindowSize);
    if (posAvg > demodulateParams.noiseThreshold) {
      if (inTransmission) {
        highlights.push([i, bigWindowSize]);
        processWindow(buf, i, bigWindowSize);
      } else {
        interestingBuffer += "starting buffer";
        inWindowOffset = findOffset(buf, i, bigWindowSize, posAvg);

        //drawBufferCallback(buf.slice(i, i + bigWindowSize), bigWindowSize, [[inWindowOffset, bigWindowSize - inWindowOffset]]);

        highlights.push([i + inWindowOffset, bigWindowSize - inWindowOffset]);
        processWindow(buf, i + inWindowOffset, bigWindowSize - inWindowOffset);
      }
      inTransmission = true;
    } else {
      if (inTransmission) {
        interestingBuffer += " ending buffer";
        processWindow(buf, i, inWindowOffset);
        highlights.push([i, inWindowOffset]);
        endOfTransmission();
      }
      inTransmission = false;
    }
  }
  if (interestingBuffer.length > 0 && drawBufferCallback) {
    drawBufferCallback(buf, newBuf.length, highlights);
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

  /*
  bandFilter.type = "bandpass"
  bandFilter.frequency = demodulateParams.carrierWaveFrequency;
  bandFilter.Q = 1000;
  micSource.connect(bandFilter);
  bandFilter.connect(scriptNode);
  */

  // Workaround for
  // https://stackoverflow.com/questions/19482155/do-webaudio-scriptprocessornodes-require-an-output-to-be-connected
  var dummy_gain = audioContext.createGain();
  dummy_gain.connect(audioContext.destination);

  micSource.connect(scriptNode);
  scriptNode.connect(dummy_gain);
}
