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
  this.modulesPath = this.pkg.modulesPath
  this.pathname = this.pkg.pathname
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
    .map(packages, pkg => pkg.setDirname(this.modulesPath))
    .filter(pkg => pkg.hasInstalled(this.modulesPath).then(x => !x))
    .map(pkg => pkg.install())
    .then(() => this.postInstall())
}

Installer.prototype.postInstall = function () {
  return Promise.all([
    this.hasPackageJSON && this.pkg.saveDependencies(this.root.children, this.save),
    this.pkg.saveLocks(resolver.getSavedPackages(), TreeNode.lock),
    this.createIndex(resolver.getDependantPackages())
  ])
}

Installer.prototype.createIndex = function (pkgs) {
  let fields = ['name', 'version', 'filepath', 'fullpath']
  let index = pkgs.map(pkg => _.pick(pkg, fields))
  let file = path.resolve(this.modulesPath, 'index.json')
  log.verbose('writing mapping', file)
  return fs.ensureDir(this.modulesPath)
  .then(() => fs.writeJson(file, index, {spaces: 2}))
}

module.exports = Installer
