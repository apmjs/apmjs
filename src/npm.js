const url = require('url')
const request = require('request')
const Promise = require('bluebird')
const debug = require('debug')('apmjs:npm')
const path = require('path')
const npm = require('npm')
const fs = require('fs-extra')
const tarball = require('tarball-extract')
const _ = require('lodash')

var config = {registry: 'http://registry.npm.com'}

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

function getPackageInfo (name) {
  if (infoCache[name]) {
    return infoCache[name]
  }
  return (infoCache[name] = new Promise((resolve, reject) => {
    var opts = {url: url.resolve(config.registry, name), json: true}
    request.get(opts, (e, r, user) => e ? reject(e) : resolve(user))
  })).tap(descriptor => {
    debug('name', descriptor.name, 'versions', Object.keys(descriptor.versions))
  })
}

function load (conf) {
  _.assign(config, conf)
  return Promise.fromCallback(cb => npm.load(config, cb))
}

module.exports = {downloadPackage, getPackageInfo, load}
