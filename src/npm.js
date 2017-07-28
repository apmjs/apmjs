const url = require('url')
const error = require('./error.js')
const rp = require('request-promise')
const Promise = require('bluebird')
const debug = require('debug')('apmjs:npm')
const path = require('path')
const npm = require('npm')
const fs = require('fs-extra')
const tarball = require('tarball-extract')
const _ = require('lodash')

var config = {registry: 'http://apmjs.baidu.com'}

function downloadPackage (url, dir) {
  var name = path.basename(url)
  var tarfile = `/tmp/${name}.tgz`
  var untardir = `/tmp/${name}`
  var pkgdir = `${untardir}/package`
  // TODO: tarball cache
  return Promise.all([fs.remove(untardir), fs.remove(tarfile)])
    .then(() => Promise.fromCallback(
      cb => tarball.extractTarballDownload(url, tarfile, untardir, {}, cb)
    ))
    .then(() => fs.move(pkgdir, dir, {overwrite: true}))
}

var infoCache = {}

function getPackageInfo (name, parent) {
  if (infoCache[name]) {
    return infoCache[name]
  }
  infoCache[name] = rp({
    url: url.resolve(config.registry, name),
    json: true
  })
  .promise()
  .catch(e => {
    if (e.statusCode === 404) {
      throw new error.PackageNotFound(name, parent)
    } else {
      throw e
    }
  })
  .tap(desc => {
    var versionList = Object.keys(desc.versions).join(',')
    debug('package info retrieved:', `${desc.name}@${versionList}`)
  })
  return infoCache[name]
}

function load (conf) {
  _.assign(config, conf)
  return Promise.fromCallback(cb => npm.load(config, cb))
}

module.exports = {downloadPackage, getPackageInfo, load}
