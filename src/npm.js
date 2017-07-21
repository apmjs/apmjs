const view = require('npm/lib/view')
const Promise = require('bluebird')
const path = require('path')
const npm = require('npm')
const fs = require('fs-extra')
const tarball = require('tarball-extract')

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
  return (infoCache[name] = Promise.fromCallback(cb => view([name], true, cb)))
}

function load (config) {
  return Promise.fromCallback(cb => npm.load(config, cb))
}

module.exports = {downloadPackage, getPackageInfo, load}
