const path = require('path');

module.exports = {
  entry: './JS/Home.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
