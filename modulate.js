// Called when transmit is finished.
var onTransmitFinish = null;

var transmitParams = {
  samplingFrequency: 44100,
  carrierWaveFrequency: 10000,
  bitZeroAmplitude: 0.1,
  bitOneAmplitude: 0.5,
  samplesPerBit: 128,
};

window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();

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

function transmitMessage(messageString) {
  var charBuffer = stringToUint8Array(messageString);
  var message = [];
  // This converts the charBuffer into an array of bits (each bit is 0 or 1).
  charBuffer.forEach(function(element, index, src_array) {
      message.push.apply(message, byteToBits(element)); } );

  var numSamples = message.length * transmitParams.samplesPerBit;
  var audioBuffer = audioContext.createBuffer(
    1, numSamples, transmitParams.samplingFrequency);

  function generate_bit(buffer, offset, one) {
    for (var i = offset; i < offset + transmitParams.samplesPerBit; i += 1) {
      var amplitude =
        one ? transmitParams.bitOneAmplitude : transmitParams.bitZeroAmplitude;
      buffer[i] = amplitude
        * Math.cos(
            (2 * Math.PI * transmitParams.carrierWaveFrequency * i)
            / transmitParams.samplingFrequency
          );
    }
  }
  for(var bit_index = 0; bit_index < message.length; bit_index += 1) {
    generate_bit(audioBuffer.getChannelData(0),
                 bit_index * transmitParams.samplesPerBit,
                 message[bit_index] == 1);
  }
  console.log(message);

  var bufferSource = audioContext.createBufferSource();
  bufferSource.connect(audioContext.destination);
  bufferSource.buffer = audioBuffer;
  bufferSource.start();
  if (onTransmitFinish) {
    bufferSource.onended = onTransmitFinish;
  }
}
