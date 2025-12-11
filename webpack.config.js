const path = require('path');

module.exports = {
  entry: '/JS/Home.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'src/public'),
  },
  module: {
    rules: [
      {
        test: /.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
};
