const fs = require('fs-extra')
const Promise = require('bluebird')
const path = require('path')

function findUp (target, current) {
  current = current || process.cwd()
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

module.exports = {findUp}
