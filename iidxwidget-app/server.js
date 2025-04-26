const express = require('express');
const path = require('path');

function startServer(port) {
  const app = express();

  app.use('/widget', express.static(path.join(__dirname, 'renderer/widget')));
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server started at http://0.0.0.0:${port}/widget`);
  });
}

module.exports = { startServer };
