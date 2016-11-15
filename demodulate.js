var messageReceivedCallback = null;

function message_to_string(bits) {
  var i = 0;
  var retval = "";
  while (i < bits.length) {
    var b = bits_to_byte(bits.slice(i, i+8));
    retval = retval + String.fromCharCode(b);
    i += 8;
  }
  return retval;
}

function bits_to_byte(bits) {
  var retval = bits[7];
  for (var i = 6; i >= 0; i -= 1) {
    retval = (retval << 1) + bits[i];
    //console.log("bit: ", bits[i], ", retval: ", retval);
  }
  return retval;
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var DEBUGCANVAS = null;
var scriptNode = null;

audioContext = new AudioContext();
scriptNode = audioContext.createScriptProcessor(16384, 1, 1);
scriptNode.onaudioprocess = processBuffer;

window.onload = function() {
  DEBUGCANVAS = document.getElementById("waveform");
  if (DEBUGCANVAS) {
    waveCanvas = DEBUGCANVAS.getContext("2d");
  }
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
  var pos_avg = aligned_buffer.reduce(
    function(a, b) { return a + Math.max(b, 0); }) / t_b;
  //console.log(pos_avg);
  message.push(pos_avg < bitThreshold ? 0 : 1);
}

// End of transmission.
function eot() {
  console.log(message);
  console.log("read ", message.length, " bits");
  console.log(message_to_string(message));
  if (messageReceivedCallback) {
    messageReceivedCallback(message);
  }
  aligned_buffer_length = 0;
  message = [];
}

function processAligned(new_data) {
  aligned_buffer.set(new_data, aligned_buffer_length);
  aligned_buffer_length += new_data.length;

  //console.log("aligned length: ", aligned_buffer_length);
  if (aligned_buffer_length >= t_b) {
    processSymbol(aligned_buffer);
    aligned_buffer_length = 0;
  }
}

var inTransmission = false;
function processBuffer(audioProcessingEvent) {
  var inputBuffer = audioProcessingEvent.inputBuffer;
  var buf = inputBuffer.getChannelData(0);

  //console.log("got bytes: ", buf.length);
  function window_pos_sum(array, start_index, num_elements) {
    var sum = 0.0;
    for (var i = 0; i < num_elements; i += 1) {
      sum += Math.max(array[start_index + i], 0);
    }
    return sum;
  }
  // Size of chunks to append to the buffer.
  var window_size = 16;
  for (var i = 0; i < buf.length / window_size; i+=1) {
    var pos_avg = window_pos_sum(buf, i * window_size, window_size) / window_size;
    if (pos_avg > noiseThreshold) {
      //console.log("have data");
      processAligned(buf.slice(i * window_size, (i+1) * window_size));
      if (!inTransmission) {
        updateWaveCanvas(buf.slice(i * window_size, (i+1) * window_size));
        //updateWaveCanvas(buf);
        console.log("pos avg that started transmission: ", pos_avg);
      }
      inTransmission = true;
    } else {
      if (inTransmission) {
        //updateWaveCanvas(buf.slice(i * window_size, (i+1) * window_size));
        console.log("pos avg that stopped transmission: ", pos_avg);
        eot();
      }
      inTransmission = false;
    }
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
  update();
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

function updateWaveCanvas(buf) {
  if (DEBUGCANVAS) {  // This draws the current waveform, useful for debugging
    waveCanvas.clearRect(0, 0, 512, 256);
    waveCanvas.strokeStyle = "red";
    waveCanvas.beginPath();
    waveCanvas.moveTo(0,0);
    waveCanvas.lineTo(0,256);
    waveCanvas.moveTo(128,0);
    waveCanvas.lineTo(128,256);
    waveCanvas.moveTo(256,0);
    waveCanvas.lineTo(256,256);
    waveCanvas.moveTo(384,0);
    waveCanvas.lineTo(384,256);
    waveCanvas.moveTo(512,0);
    waveCanvas.lineTo(512,256);
    waveCanvas.stroke();
    waveCanvas.strokeStyle = "black";
    waveCanvas.beginPath();
    waveCanvas.moveTo(0, buf[0]);
    for (var i = 1; i < 512; i++) {
      waveCanvas.lineTo(i, 128 + (buf[i * (buf.length / 512)] * 128));
    }
    waveCanvas.stroke();
  }
}
