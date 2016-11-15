window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();

var fs = 44100; // sampling frequency
var fc = 10000; // carrier wave frequency
var a_0 = 0.1;  // amplitude of 0
var a_1 = 0.5;  // amplitude of 1
var t_b = 128;  // samples per bit, bit duration

function byte_to_bits(b) {
  var retval = [];
  for (var i = 0; i < 8; i += 1) {
    retval.push((b >> i) & 1);
  }
  return retval;
}

function stringToUint8Array(s) {
  var char_buffer = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i += 1) {
    char_buffer[i] = s.charCodeAt(i);
  }
  return char_buffer;
}

function playMessage(messageString) {
  var char_buffer = stringToUint8Array(messageString);
  var message = [];
  // This converts the char_buffer into an array of bits (each bit is 0 or 1).
  char_buffer.forEach(function(element, index, src_array) {
      message.push.apply(message, byte_to_bits(element)); } );

  var num_samples = message.length * t_b;
  var audioBuffer = audioContext.createBuffer(1, num_samples, fs);

  function generate_bit(buffer, offset, one) {
    for (var i = offset; i < offset + t_b; i += 1) {
      buffer[i] = (one ? a_1 : a_0) * Math.cos(2 * Math.PI * fc * i / fs);
    }
  }
  for(var bit_index = 0; bit_index < message.length; bit_index += 1) {
    generate_bit(audioBuffer.getChannelData(0), bit_index * t_b,
                 message[bit_index] == 1);
  }
  console.log(message);

  var bufferSource = audioContext.createBufferSource();
  bufferSource.connect(audioContext.destination);
  bufferSource.buffer = audioBuffer;
  bufferSource.start();
}
