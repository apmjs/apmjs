const debug = require('debug')('apmjs:commands:install')
const process = require('process')
const _ = require('lodash')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const TreeNode = require('../resolver/tree-node.js')
const Package = require('../package.js')

function install (argv, errorHandler, conf) {
  var dependencies = argv
  var save = conf.save
  var rootPkg
  var rootNode
  var installer = new Installer()
  debug('installing:', dependencies, ', save:', save)

  Package.load(process.cwd())
    .then(pkg => resolver.loadRoot(rootPkg = pkg))
    .then(node => {
      rootNode = node
      return Promise.map(dependencies, dependency => node.addDependency(dependency))
    })
    .then(() => TreeNode.packageList())
    .then(pkgs => installer.install(pkgs))
    .then(() => save ? rootPkg.saveDependencies() : '')
    .then(() => {
      if (_.size(dependencies)) {
        _.forEach(dependencies, name => TreeNode.nodes[name].printTree())
      } else {
        rootNode.printTree()
      }
    })
    .then(() => errorHandler())
    .catch(e => errorHandler(e))
}

module.exports = install
