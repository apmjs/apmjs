'use strict'
const fs = require('fs-extra')
const path = require('path')
const http = require('http')
const rMeta = /^\/([^/]+)$/
const rTarball = /^\/([^/]+)\/-\/(.*)$/

var server

exports.startServer = function (cb) {
  var port = process.env.REGISTRY_PORT || '8723'
  server = http.createServer(requestHandler)
  server.listen(port, cb)

  function requestHandler (req, res) {
    var match

    if ((match = req.url.match(rMeta))) {
      let name = decodeURIComponent(match[1])
      let filepath = path.resolve(__dirname, '../stub/repo', name, 'meta.json')
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8'
      })
      fs.readFile(filepath, 'utf8').then(content => {
        content = content.replace(/apmjs\.com/g, `localhost:${port}`)
        res.end(content)
      })
    } else if ((match = req.url.match(rTarball))) {
      let name = decodeURIComponent(match[1])
      let file = match[2]
      let filepath = path.resolve(__dirname, '../stub/repo', name, file)
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream'
      })
      fs.createReadStream(filepath).pipe(res)
    } else {
      res.writeHead(404, {'Content-Type': 'text/plain'})
      res.end()
    }
  }
}

exports.stopServer = function (cb) {
  server.close(cb)
}
