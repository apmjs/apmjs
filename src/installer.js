'use strict'
const Package = require('./package.js')
const log = require('npmlog')
const TreeNode = require('./resolver/tree-node')
const resolver = require('./resolver')
const debug = require('debug')('apmjs:installer')
const _ = require('lodash')
const Promise = require('bluebird')
const fs = require('fs-extra')
const npm = require('./utils/npm.js')
const path = require('path')

function Installer (root, options) {
  options = options || {}
  this.root = root
  this.pkg = this.root.pkg
  this.pathname = this.pkg.modulesPath
  this.hasPackageJSON = !this.pkg.noPackageJSON
  this.save = options.save
}

Installer.createToGlobalRoot = function () {
  let pathname = path.resolve(npm.globalPrefix, 'lib')
  let pkg = Package.createByDirectory(pathname)
  let node = new TreeNode(pkg)
  return new Installer(node)
}

Installer.globalInstall = function (name, semver) {
  let installer = Installer.createToGlobalRoot()

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
    .filter(pkg => pkg.hasInstalled(this.pathname).then(x => !x))
    .map(pkg => this.installPackage(pkg))
    .map(pkg => (pkg.status = 'installed'))
    .then(() => this.postInstall())
}

Installer.prototype.postInstall = function () {
  return Promise.all([
    this.hasPackageJSON && this.pkg.saveDependencies(this.root.children, this.save),
    this.pkg.saveLocks(resolver.getSavedPackages(), TreeNode.dependencyLocks),
    this.createIndex(resolver.getDependantPackages())
  ])
}

Installer.prototype.createIndex = function (pkgs) {
  let fields = ['name', 'version', 'filepath', 'fullpath']
  let index = pkgs.map(pkg => _.pick(pkg, fields))
  let file = path.resolve(this.pathname, 'index.json')
  log.verbose('writing mapping', file)
  return fs.ensureDir(this.pathname)
  .then(() => fs.writeJson(file, index, {spaces: 2}))
}

Installer.prototype.installPackage = function (pkg) {
  let url = pkg.descriptor.dist.tarball
  let dir = path.resolve(this.pathname, pkg.name)
  return npm
    .downloadPackage(url, dir)
    .then(() => pkg.postInstall())
    .then(() => pkg)
}

module.exports = Installer
