'use strict'
const debug = require('debug')('apmjs:commands:install')
const version = require('../resolver/version.js')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const Package = require('../package.js')

function install (dependencies, errorHandler, conf) {
  let save = conf['save']
  return Package.loadOrCreate()
    .then(pkg => resolver.loadRoot(pkg))
    .then(root => {
      let installer = new Installer(root, {save})
      return Promise.map(dependencies, decl => {
        let ret = version.parseDependencyDeclaration(decl)
        return root.updateOrInstallDependency(ret.name, ret.semver, save)
      })
      .then(() => resolver.getDependantPackages())
      .then(pkgs => installer.install(pkgs))
      .then(() => root.printTree())
    })
    .then(() => errorHandler(), err => errorHandler(err))
}

module.exports = install
