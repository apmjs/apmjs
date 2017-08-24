const debug = require('debug')('apmjs:commands:install')
const process = require('process')
const npm = require('npm')
const _ = require('lodash')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const TreeNode = require('../resolver/tree-node.js')
const Package = require('../package.js')

function install (dependencies, errorHandler, conf) {
  if (_.size(dependencies)) {
    return conf['save-dev']
      ? npmInstall(dependencies)
        .then(res => errorHandler(null, res))
        .catch(errorHandler)
      : apmInstall(dependencies, conf)
  }
  return apmInstall(dependencies, conf)
    .then(() => npmInstall(dependencies, true))
    .then(() => errorHandler())
    .catch(err => errorHandler(err))
}

function npmInstall (dependencies, onlyDev) {
  if (onlyDev) {
    npm.config.set('only', 'dev')
  }
  return Promise.fromCallback(cb => npm.commands.npmInstall(dependencies, cb))
}

function apmInstall (dependencies, conf) {
  var rootPkg
  var rootNode
  var installer = new Installer()
  return Package.load(process.cwd())
    .then(pkg => resolver.loadRoot(rootPkg = pkg))
    .then(node => {
      rootNode = node
      return Promise.map(dependencies, decl => node.addDependency(decl))
    })
    .then(() => TreeNode.packageList())
    .then(pkgs => installer.install(pkgs))
    .then(() => conf['save'] ? rootPkg.saveDependencies() : '')
    .then(() => {
      if (_.size(dependencies)) {
        _.forEach(dependencies, name => TreeNode.nodes[name].printTree())
      } else {
        rootNode.printTree()
      }
    })
}

module.exports = install
