const path = require('path')
const exec = require('child_process').exec
const Promise = require('bluebird')
const _ = require('lodash')
const fs = require('fs-extra')
const ramdisk = require('node-ramdisk')

function Workspace (port) {
  this.port = port
  this.dirname = Math.random().toString(36).substr(2)
  this.apmbin = path.resolve(__dirname, '../../bin/cli.js')
}

Workspace.prototype.destroy = function () {
  return Promise
  .fromCallback(cb => this.disk.delete(this.mountpoint, cb))
  .tap(() => console.log(`ramdisk ${this.mountpoint} destroyed`))
}

Workspace.prototype.create = function () {
  this.disk = ramdisk(this.dirname)
  // create a disk with 10MB of size
  return Promise.fromCallback(cb => this.disk.create(10, cb))
  .then(mount => {
    this.mountpoint = mount
    this.dirpath = path.join(mount, 'root')
    console.log('ramdisk created in', mount)
    return fs.mkdir(this.dirpath)
  })
}

Workspace.prototype.createTree = function (root) {
  return createTree(this.dirpath, root)
}

Workspace.prototype.readJson = function (filename) {
  var file = path.resolve(this.dirpath, filename)
  return fs.readJson(file)
}

Workspace.prototype.readJsonSync = function (filename) {
  var file = path.resolve(this.dirpath, filename)
  return fs.readJsonSync(file)
}

Workspace.prototype.run = function (cmd) {
  const registry = `http://localhost:${this.port}`
  const bin = `node ${this.apmbin} --registry ${registry}`
  var cmd = `cd ${this.dirpath} && export APM="${bin}" && ${cmd}`
  console.log('cmd:', cmd)
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      (err, stdout, stderr) => err ? reject(err) : resolve({ stdout, stderr })
    )
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
