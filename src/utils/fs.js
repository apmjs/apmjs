const fs = require('fs-extra')
const log = require('npmlog')
const Promise = require('bluebird')
const path = require('path')

function findUp (target, current) {
  current = current || process.cwd()
  log.silly('finding', target, 'from', current, '...')
  var file = path.resolve(current, target)
  return Promise.resolve(fs.pathExists(file))
    .then(exist => {
      if (exist) {
        return file
      }
      var parentPath = path.resolve(current, '..')
      if (parentPath === current) {
        var err = new TypeError(`ENOENT: file ${target} not found`)
        err.code = 'ENOENT'
        throw err
      }
      return findUp(target, parentPath)
    })
}

function catchNoEntry (err) {
  if (err.code === 'ENOENT') {
    return
  }
  throw err
}

function writeFileStream (stream, filename) {
  return new Promise((resolve, reject) => {
    stream.on('error', reject)
    stream.on('finish', resolve)
    stream.pipe(fs.createWriteStream(filename))
  })
}

module.exports = {findUp, catchNoEntry, writeFileStream}
