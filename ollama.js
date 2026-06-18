const { Ollama } = require('ollama');

const ollama = new Ollama({
  host: 'http://127.0.0.1:11434', // Default local address
});

module.exports = ollama;