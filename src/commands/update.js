'use strict'
const debug = require('debug')('apmjs:commands:update')
const version = require('../resolver/version.js')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const Package = require('../package.js')

module.exports = function (dependencies, errorHandler) {
  return Package.loadOrCreate()
    .then(pkg => resolver.loadRoot(pkg, {
      update: dependencies.length === 0
    }))
    .then(root => {
      let installer = new Installer(root, {save: true})
      return Promise.map(dependencies, decl => {
        let ret = version.parseDependencyDeclaration(decl)
        return root.updateOrInstallDependency(ret.name, ret.semver, true)
      })
      .then(() => resolver.getDependantPackages())
      .then(pkgs => installer.install(pkgs))
      .then(() => root.printTree())
    })
    .then(() => errorHandler(), err => errorHandler(err))
}
