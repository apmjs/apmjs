'use strict'
const debug = require('debug')('apmjs:commands:update')
const version = require('../resolver/version.js')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const Package = require('../package.js')

module.exports = function (dependencies, errorHandler) {
  let deps = dependencies.map(version.parseDependencyDeclaration)

  return Package.load()
    .then(pkg => resolver.loadRoot(pkg, {
      update: dependencies.length === 0
    }))
    .then(root => {
      let installer = new Installer(root, {save: true})
      return Promise
      .map(deps, dep => root.updateOrInstallDependency(dep.name, dep.semver, true))
      .then(() => resolver.getDependantPackages())
      .then(pkgs => installer.install(pkgs))
      .then(() => root.printTree())
    })
    .then(() => errorHandler(), err => errorHandler(err))
}
