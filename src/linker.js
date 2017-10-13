const debug = require('debug')('apmjs:linker')
const Installer = require('./installer')
const Version = require('./resolver/version.js')
const path = require('path')
const Promise = require('bluebird')
const Package = require('./package.js')
const fs = require('fs-extra')
const findUp = require('./utils/fs.js').findUp
const npm = require('./utils/npm')

function linkToGlobal () {
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

function linkFromGlobal (decl) {
  var pkgDescriptor = Version.parseDependencyDeclaration(decl)
  return Promise
    .all([
      loadOrInstall(pkgDescriptor.name, pkgDescriptor.semver),
      Promise.any([
        findUp('node_modules'),
        findUp('package.json').then(file => path.resolve(file, '../node_modules'))
      ])
    ])
    .spread((pkg, dir) => {
      var link = path.resolve(dir, pkgDescriptor.name)
      var target = pkg.pathname
      console.log(`${link} -> ${target}`)
      return fs.ensureSymlink(target, link)
    })
}

exports.linkFromGlobal = linkFromGlobal
exports.linkToGlobal = linkToGlobal
