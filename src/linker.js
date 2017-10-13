const debug = require('debug')('apmjs:linker')
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
    var link = path.resolve(npm.globalDir, pkg.name)
    var file = pkg.pathname
    console.log(`${link} -> ${file}`)
    return fs.ensureSymlink(file, link)
  })
}

function loadOrInstall (name, semver) {
  return Package.hasInstalled(name, null, npm.globalDir)
    .then(installed => installed
      ? Package.load(path.resolve(npm.globalDir, name))
      : Installer.globalInstall(name, semver)
     )
}

function linkDependency (decl) {
  var pkgDescriptor = Version.parseDependencyDeclaration(decl)
  return Promise
    .all([
      loadOrInstall(pkgDescriptor.name, pkgDescriptor.semver),
      Promise.any([
        findUp('amd_modules'),
        findUp('package.json').then(file => path.resolve(file, '../amd_modules'))
      ])
    ])
    .spread((pkg, dir) => {
      var link = path.resolve(dir, pkgDescriptor.name)
      var target = pkg.pathname
      console.log(`${link} -> ${target}`)
      return fs.ensureSymlink(target, link)
    })
}

function unlinkCurrent () {
  return Promise.all([
    Package.load(),
    fs.ensureDir(npm.globalDir)
  ])
  .spread(pkg => {
    var link = path.resolve(npm.globalDir, pkg.name)
    return fs.unlink(link).then(() => console.log(`unlink ${link}`))
  })
  .catch(e => {
    if (e.code === 'ENOENT') {
      console.log('already unlinked')
      return
    }
    throw e
  })
}

function unlinkDependency (name) {
  return Promise
    .any([
      findUp('amd_modules'),
      findUp('package.json').then(file => path.resolve(file, '../amd_modules'))
    ])
    .then(dir => {
      var link = path.resolve(dir, name)
      return fs.unlink(link).then(() => console.log(`unlink ${link}`))
    })
    .catch(e => {
      if (e.code === 'ENOENT') {
        console.log('already unlinked')
        return
      }
      throw e
    })
}

module.exports = {linkCurrent, unlinkCurrent, linkDependency, unlinkDependency}
