'use strict'
const debug = require('debug')('apmjs:linker')
const log = require('npmlog')
const Installer = require('./installer')
const Version = require('./resolver/version.js')
const path = require('path')
const Promise = require('bluebird')
const Package = require('./package.js')
const fs = require('fs-extra')
const findUp = require('./utils/fs.js').findUp
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
  return Package.alreadyInstalled(name, null, npm.globalDir)
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
      Promise.any([
        findUp('amd_modules'),
        findUp('package.json').then(file => path.resolve(file, '../amd_modules'))
      ])
    ])
    .spread((pkg, dir) => {
      let link = path.resolve(dir, pkgDescriptor.name)
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
  return Promise
    .any([
      findUp('amd_modules'),
      findUp('package.json').then(file => path.resolve(file, '../amd_modules'))
    ])
    .then(dir => {
      let link = path.resolve(dir, name)
      return fs.remove(link).then(() => console.log(`unlink ${link}`))
    })
}

module.exports = {linkCurrent, unlinkCurrent, linkDependency, unlinkDependency}
