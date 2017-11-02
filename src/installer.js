'use strict'
const process = require('process')
const Package = require('./package.js')
const log = require('npmlog')
const debug = require('debug')('apmjs:installer')
const _ = require('lodash')
const Promise = require('bluebird')
const fs = require('fs-extra')
const npm = require('./utils/npm.js')
const path = require('path')

function Installer (dirname) {
  this.pathname = dirname || path.resolve(process.cwd(), 'amd_modules')
}

Installer.globalInstall = function (name, semver) {
  var installer = new Installer(npm.globalDir)
  return npm.getPackageMeta(name)
    .then(meta => Package.createMaxSatisfying(meta, semver))
    .then(pkg => installer.install(pkg).then(() => pkg))
}

Installer.prototype.install = function (packages) {
  if (!(packages instanceof Array)) {
    packages = [packages]
  }
  return Promise
    .map(packages, pkg => pkg.setDirname(this.pathname))
    .map(pkg => this.installPackageIfNeeded(pkg))
    .then(() => this.saveMapping(packages))
}

Installer.prototype.saveMapping = function (pkgs) {
  var fields = ['name', 'version', 'filepath', 'fullpath']
  var meta = pkgs.map(pkg => _.pick(pkg, fields))
  var file = path.resolve(this.pathname, 'index.json')
  log.verbose('writing mapping', file)
  return fs.ensureDir(this.pathname)
  .then(() => fs.writeJson(file, meta, {spaces: 2}))
}

Installer.prototype.installPackageIfNeeded = function (pkg) {
  return pkg.hasInstalled(this.pathname)
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

module.exports = Installer
