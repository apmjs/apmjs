'use strict'
const debug = require('debug')('apmjs:linker')
const log = require('npmlog')
const Installer = require('./installer')
const Version = require('./resolver/version.js')
const path = require('path')
const Promise = require('bluebird')
const Package = require('./package.js')
const fs = require('fs-extra')
const npm = require('./utils/npm')

function linkCurrent () {
  return Promise.all([
    Package.load(),
    fs.ensureDir(npm.globalDir)
  ])
  .spread(pkg => {
    let link = path.resolve(npm.globalDir, pkg.name)
    let file = pkg.pathname
    return fs.remove(link)
      .then(() => fs.ensureSymlink(file, link))
      .then(() => console.log(`${link} -> ${file}`))
  })
}

function loadOrInstall (name, semver) {
  return Package.createGlobalRoot().dependencyInstalled({name})
    .then(installed => installed
      ? Package.load(path.resolve(npm.globalDir, name))
      : Installer.globalInstall(name, semver)
     )
}

function linkDependency (decl) {
  let pkgDescriptor = Version.parseDependencyDeclaration(decl)
  return Promise
    .all([
      loadOrInstall(pkgDescriptor.name, pkgDescriptor.semver),
      Package.load()
    ])
    .spread((pkg, root) => {
      let link = path.resolve(root.modulesPath, pkgDescriptor.name)
      let file = pkg.pathname
      return fs.remove(link)
        .then(() => fs.ensureSymlink(file, link))
        .then(() => console.log(`${link} -> ${file}`))
    })
}

function unlinkCurrent () {
  return Promise.all([
    Package.load(),
    fs.ensureDir(npm.globalDir)
  ])
  .spread(pkg => {
    let link = path.resolve(npm.globalDir, pkg.name)
    return fs.remove(link).then(() => console.log(`unlink ${link}`))
  })
}

function unlinkDependency (name) {
  return Package.load()
    .then(root => {
      let link = path.resolve(root.modulesPath, name)
      return fs.remove(link).then(() => console.log(`unlink ${link}`))
    })
}

module.exports = {linkCurrent, unlinkCurrent, linkDependency, unlinkDependency}
