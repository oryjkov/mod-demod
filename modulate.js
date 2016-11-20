// Called when transmit is finished.
var onTransmitFinish = null;

var transmitParams = {
  samplingFrequency: 44100,
  bitZeroAmplitude: 0.2,
  bitOneAmplitude: 0.2,
  bitZeroFrequency: 1300,
  bitOneFrequency: 2300,
  samplesPerBit: 256,
};

function transmitMessage(messageString, audioContext) {
  var message = stringToBitArray(messageString);
  var buf = generateWaveform(message);

  var audioBuffer = audioContext.createBuffer(1, buf.length,
    transmitParams.samplingFrequency);
  audioBuffer.copyToChannel(buf, 0);

  console.log(message);

  var bufferSource = audioContext.createBufferSource();
  bufferSource.connect(audioContext.destination);
  bufferSource.buffer = audioBuffer;
  bufferSource.start();
  if (onTransmitFinish) {
    bufferSource.onended = onTransmitFinish;
  }
}

function byteToBits(b) {
  var retval = [];
  for (var i = 0; i < 8; i += 1) {
    retval.push((b >> i) & 1);
  }
  return retval;
}

function stringToUint8Array(s) {
  var charBuffer = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i += 1) {
    charBuffer[i] = s.charCodeAt(i);
  }
  return charBuffer;
}

function stringToBitArray(messageString) {
  var charBuffer = stringToUint8Array(messageString);
  var message = [];
  // This converts the charBuffer into an array of bits (each bit is 0 or 1).
  charBuffer.forEach(function(element, index, src_array) {
      message.push.apply(message, byteToBits(element)); } );
  return message;
}

function generateWaveform(bitArray) {
  var numSamples = bitArray.length * transmitParams.samplesPerBit;
  var buf = new Float32Array(numSamples);

  // phase is used to pass in the phase offset as a value between 0 and 1.
  function generate_bit(buffer, offset, one, phase) {
    var amplitude =
      one ? transmitParams.bitOneAmplitude : transmitParams.bitZeroAmplitude;
    var carrierWaveFrequency =
      one ? transmitParams.bitOneFrequency : transmitParams.bitZeroFrequency;
    // Size of a step around the circle for between samples.
    var stepSize = carrierWaveFrequency / transmitParams.samplingFrequency;
    for (var t = 0 ; t < transmitParams.samplesPerBit; t += 1) {
      buffer[t + offset] = amplitude * Math.sin(2 * Math.PI * (phase + stepSize * t));
    }
    phase += stepSize * transmitParams.samplesPerBit;

    return phase - Math.floor(phase);
  }
  var phase = 0;
  for(var bit_index = 0; bit_index < bitArray.length; bit_index += 1) {
    phase = generate_bit(
      buf, bit_index * transmitParams.samplesPerBit, bitArray[bit_index] == 1, phase);
  }
  return buf;
}
