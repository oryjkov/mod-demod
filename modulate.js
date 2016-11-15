window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var textEncoder = new TextEncoder();
var fcBox = null;
var a_0Box = null;
var a_1Box = null;
var t_bBox = null;
var inputMessageBox = null;

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

function bits_to_byte(bits) {
  var retval = 0;
  for (var i = 0; i < 8; i += 1) {
    retval = retval << 1 + bits[i];
  }
  return retval;
}

function string_to_ua(s) {
  var char_buffer = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i += 1) {
    char_buffer[i] = s.charCodeAt(i);
    //console.log("byte: ", char_buffer[i]);
  }
  return char_buffer;
}

function play() {
  fc = parseInt(fcBox.value);
  a_0 = parseFloat(a_0Box.value);
  a_1 = parseFloat(a_1Box.value);
  t_b = parseInt(t_bBox.value);
  console.log(t_b);

  var s = inputMessageBox.value;
  var char_buffer = string_to_ua(s);

  var message = [];
  // This converts the char_buffer into an array of bits (each bit is 0 or 1).
  char_buffer.forEach(function(element, index, src_array) {
      message.push.apply(message, byte_to_bits(element)); } );

  var num_samples = message.length * t_b;
  var audioBuffer = audioContext.createBuffer(1, num_samples, fs);

  function generate_bit(buffer, offset, one) {
    for (var i = 0; i < t_b; i += 1) {
      buffer[offset + i] = (one ? a_1 : a_0) * Math.cos(2 * Math.PI * fc * i / fs);
    }
  }
  for(var bit_index = 0; bit_index < message.length; bit_index += 1) {
    generate_bit(audioBuffer.getChannelData(0), bit_index * t_b,
                 message[bit_index] == 1);
  }
  console.log(message);
  //console.log("sending ", message.length, " bits");

  var bufferSource = audioContext.createBufferSource();
  bufferSource.connect(audioContext.destination);
  bufferSource.buffer = audioBuffer;
  bufferSource.start();
}

function onDOMLoad() {
  fcBox = document.getElementById("fc");
  a_0Box = document.getElementById("a_0");
  a_1Box = document.getElementById("a_1");
  t_bBox = document.getElementById("t_b");
  inputMessageBox = document.getElementById("inputMessage");
}
document.addEventListener("DOMContentLoaded", onDOMLoad);
