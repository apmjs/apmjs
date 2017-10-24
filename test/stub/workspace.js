const os = require('os')
const path = require('path')
const exec = require('child_process').exec
const Promise = require('bluebird')
const _ = require('lodash')
const fs = require('fs-extra')

function Workspace () {
  var dirname = Math.random().toString(36).substr(2)
  this.dirpath = path.resolve(os.tmpdir(), dirname)
  this.apmbin = path.resolve(__dirname, '../../bin/cli.js')
}

Workspace.prototype.destroy = function () {
  return fs.remove(this.dirpath)
}

Workspace.prototype.createTree = function (root) {
  return fs
    .emptyDir(this.dirpath)
    .then(() => createTree(this.dirpath, root))
}

Workspace.prototype.getInstalled = function (name) {
  var file = path.resolve(this.dirpath, 'amd_modules', name, 'package.json')
  return fs.readJson(file)
}

Workspace.prototype.run = function (cmd) {
  return new Promise((resolve, reject) => {
    exec(
      `cd ${this.dirpath} && export APM=${this.apmbin} ${cmd}`,
      (err, stdout, stderr) => err ? reject(err) : resolve({ stdout, stderr }
    ))
  })
}

function createTree (dirpath, root) {
  var ps = _.map(root, (val, key) => {
    var nodename = path.resolve(dirpath, key)
    return _.isString(val)
      ? createFile(nodename, val)
      : createTree(nodename, val)
  })
  return Promise.all(ps)
}

function createFile (filepath, content) {
  return fs.writeFile(filepath, content, 'utf8')
}

module.exports = Workspace
