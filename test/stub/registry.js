'use strict'
const fs = require('fs-extra')
const path = require('path')
const http = require('http')
const rMeta = /^\/([^/]+)$/
const r302 = /302-(.+)$/
const rTarball = /^\/([^/]+)\/-\/(.*)$/

let server
let port = process.env.REGISTRY_PORT || '8723'

exports.url = 'http://localhost:' + port

exports.dirpath = path.resolve(__dirname, '../stub/packages')

exports.startServer = function (cb) {
  server = http.createServer(requestHandler)
  server.listen(port, cb)

  function requestHandler (req, res) {
    let match

    if ((match = req.url.match(r302))) {
      res.writeHead(302, {
        'Location': exports.url + match[1]
      })
      res.end()
    } else if ((match = req.url.match(rMeta))) {
      let name = decodeURIComponent(match[1])
      let filepath = path.resolve(exports.dirpath, name, 'meta.json')
      fs.readFile(filepath, 'utf8')
      .then(content => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8'
        })
        res.end(exports.applyStubServer(content))
      })
      .catch(errorHandler(res))
    } else if ((match = req.url.match(rTarball))) {
      let name = decodeURIComponent(match[1])
      let file = match[2]
      let filepath = path.resolve(exports.dirpath, name, file)
      fs.readFile(filepath)
      .then(file => {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream'
        })
        res.end(file)
      })
      .catch(errorHandler(res))
    } else {
      res.writeHead(404, {'Content-Type': 'text/plain'})
      res.end()
    }
  }
}

exports.applyStubServer = function (url) {
  return url.replace(/apmjs\.com/g, `localhost:${port}`)
}

exports.stopServer = function (cb) {
  server.close(cb)
}

function errorHandler (res) {
  return e => {
    if (e.code === 'ENOENT') {
      res.writeHead(404)
      res.end('package not found')
    } else {
      res.writeHead(500)
      res.end(e.message + '\n' + e.stack)
    }
  }
}
