'use strict'
const os = require('os')
const path = require('path')
const log = require('npmlog')
const process = require('process')
const exec = require('child_process').exec
const Promise = require('bluebird')
const _ = require('lodash')
const fs = require('fs-extra')
const ramdisk = require('node-ramdisk')
const testRoot = 'apmjs-test-root'
const rAlreadyMounted = /"(.*)" already mounted/

function Workspace (port) {
  this.port = port
  this.apmbin = path.resolve(__dirname, '../../bin/cli.js')
}

Workspace.create = function (root) {
  let port = process.env.REGISTRY_PORT || '8723'
  let ws = new Workspace(port)
  return createDisk()
  .then(mountpoint => {
    let dirname = Math.random().toString(36).substr(2)
    ws.dirpath = path.resolve(mountpoint, dirname)
    return fs.ensureDir(ws.dirpath).then(() => createTree(ws.dirpath, root))
  })
  .then(() => ws)
}

Workspace.prototype.readJson = function (filename) {
  let file = path.resolve(this.dirpath, filename)
  return fs.readJson(file)
}

Workspace.prototype.readJsonSync = function (filename) {
  let file = path.resolve(this.dirpath, filename)
  return fs.readJsonSync(file)
}

Workspace.prototype.run = function (cmd) {
  const registry = `http://localhost:${this.port}`
  const bin = `node ${this.apmbin} --registry ${registry}`
  cmd = `cd ${this.dirpath} && export APM="${bin}" && ${cmd}`
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      console.log('stdout', stdout)
      console.warn('stderr', stderr)
      err ? reject(err) : resolve({ stdout, stderr })
    })
  })
}

function createTree (dirpath, root) {
  let ps = _.map(root, (val, key) => {
    let nodename = path.resolve(dirpath, key)
    return _.isString(val)
      ? createFile(nodename, val)
      : createTree(nodename, val)
  })
  return Promise.all(ps)
}

function createFile (filepath, content) {
  return fs.outputFile(filepath, content, 'utf8')
}

function createDisk () {
  if (!Workspace.creating) {
    Workspace.disk = ramdisk(testRoot)
    Workspace.creating = Promise.fromCallback(cb => Workspace.disk.create(10, cb))
    .catch(err => {
      let match = rAlreadyMounted.exec(err.message)
      if (match) {
        return match[1]
      }
      var rootdir = path.resolve(os.tmpdir(), testRoot)
      return fs.ensureDir(rootdir).then(() => rootdir)
    })
    .then(mountpoint => {
      console.log('ramdisk created in', mountpoint)
      process.on('exit', unmountDisk)
      return fs.realpath(mountpoint)
    })
    .tap(mountpoint => {
      Workspace.mountpoint = mountpoint
    })
  }
  return Workspace.creating
}

function unmountDisk () {
  return Promise
  .fromCallback(cb => Workspace.disk.delete(Workspace.mountpoint, cb))
  .tap(() => console.log(`ramdisk ${Workspace.mountpoint} destroyed`))
}

module.exports = Workspace
