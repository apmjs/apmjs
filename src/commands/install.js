const debug = require('debug')('apmjs:commands:install')
const version = require('../resolver/version.js')
const _ = require('lodash')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const TreeNode = require('../resolver/tree-node.js')
const Package = require('../package.js')

function install (dependencies, errorHandler, conf) {
  var installer = new Installer()
  return Package.loadOrCreate()
    .then(pkg => resolver.loadRoot(pkg))
    .then(root => {
      return Promise.map(dependencies, decl => {
        var ret = version.parseDependencyDeclaration(decl)
        return root.updateOrInstallDependency(ret.name, ret.semver)
      })
      .then(() => TreeNode.packageList())
      .then(pkgs => installer.install(pkgs))
      .then(() => root.save(conf))
      .then(() => {
        if (_.size(dependencies)) {
          _.forEach(dependencies, decl => {
            var ret = version.parseDependencyDeclaration(decl)
            TreeNode.nodes[ret.name].printTree()
          })
        } else {
          root.printTree()
        }
      })
    })
    .then(() => errorHandler())
    .catch(err => errorHandler(err))
}

module.exports = install
