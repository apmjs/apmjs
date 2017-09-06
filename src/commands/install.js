const debug = require('debug')('apmjs:commands:install')
const version = require('../resolver/version.js')
const process = require('process')
const _ = require('lodash')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const TreeNode = require('../resolver/tree-node.js')
const Package = require('../package.js')

function install (dependencies, errorHandler, conf) {
  return apmInstall(dependencies, conf)
  .then(() => errorHandler())
  .catch(err => errorHandler(err))
}

function apmInstall (dependencies, conf) {
  var rootPkg
  var rootNode
  var installer = new Installer()
  return Package.load(process.cwd())
    .then(pkg => resolver.loadRoot(rootPkg = pkg))
    .then(node => {
      rootNode = node
      return Promise.map(dependencies, decl => {
        var ret = version.parseDependencyDeclaration(decl)
        return node.addDependency(ret.name, ret.semver)
      })
    })
    .then(() => TreeNode.packageList())
    .then(pkgs => installer.install(pkgs))
    .then(() => conf['save'] ? rootPkg.saveDependencies() : '')
    .then(() => {
      if (_.size(dependencies)) {
        _.forEach(dependencies, decl => {
          var ret = version.parseDependencyDeclaration(decl)
          TreeNode.nodes[ret.name].printTree()
        })
      } else {
        rootNode.printTree()
      }
    })
}

module.exports = install
