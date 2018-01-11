'use strict'
const debug = require('debug')('apmjs:commands:install')
const version = require('../resolver/version.js')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const Package = require('../package.js')

function install (dependencies, errorHandler, conf) {
  let save = conf['save']
  let deps = dependencies.map(version.parseDependencyDeclaration)

  return Package.load()
    .then(pkg => resolver.loadRoot(pkg))
    .then(root => {
      let installer = new Installer(root, {save})
      return Promise
      .map(deps, dep => root.installDependency(dep.name, dep.semver, save))
      .then(() => resolver.getDependantPackages())
      .then(pkgs => installer.install(pkgs))
      .then(() => root.printTree())
    })
    .then(() => errorHandler(), err => errorHandler(err))
}

module.exports = install
