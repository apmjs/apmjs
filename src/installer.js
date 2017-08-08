const process = require('process')
const debug = require('debug')('apmjs:installer')
const _ = require('lodash')
const Promise = require('bluebird')
const fs = require('fs-extra')
const Package = require('./package')
const npm = require('./utils/npm.js')
const path = require('path')

function Installer (dirname) {
  dirname = dirname || process.cwd()
  this.pathname = path.resolve(dirname, 'amd_modules')
}

Installer.prototype.install = function (packages) {
  return Promise
    .map(packages, pkg => pkg.setDirname(this.pathname))
    .map(pkg => this.installPackageIfNeeded(pkg))
    .then(() => this.saveMapping(packages))
}

Installer.prototype.saveMapping = function (pkgs) {
  var fields = ['name', 'version', 'filepath', 'fullpath']
  var meta = pkgs.map(pkg => _.pick(pkg, fields))
  var file = path.resolve(this.pathname, 'index.json')
  debug('writing dependency mapping to', file)
  return fs.ensureDir(this.pathname).then(() => fs.writeJson(file, meta, {spaces: 2}))
}

Installer.prototype.installPackageIfNeeded = function (pkg) {
  return this
    .hasInstalled(pkg)
    .then(exists => {
      if (exists) { return }
      return this.installPackage(pkg)
    })
}

Installer.prototype.installPackage = function (pkg) {
  var url = pkg.descriptor.dist.tarball
  var dir = path.resolve(this.pathname, pkg.name)
  return npm
    .downloadPackage(url, dir)
    .then(() => pkg.postInstall())
}

Installer.prototype.hasInstalled = function (pkg) {
  var pkgPath = path.resolve(this.pathname, pkg.name)
  return Package.load(pkgPath)
    .then(installed => installed.equalTo(pkg))
    .catch(e => {
      if (e.code === 'ENOENT') {
        return false
      } else {
        throw e
      }
    })
}

module.exports = Installer
