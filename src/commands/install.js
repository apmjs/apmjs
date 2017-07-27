const debug = require('debug')('apmjs:commands:install')
const process = require('process')
const Promise = require('bluebird')
const resolver = require('../resolver/index.js')
const Installer = require('../installer.js')
const TreeNode = require('../resolver/tree-node.js')
const Package = require('../package.js')

function install (argv, errorHandler, conf) {
  var dependencies = argv
  var save = conf.save
  var installer = new Installer()
  var pkg
  debug('installing:', dependencies, ', save:', save)

  Package.load(process.cwd())
    .then(currPackage => resolver.loadRoot(pkg = currPackage))
    .then(root => Promise.map(dependencies, dependency => root.addDependency(dependency)))
    .then(() => TreeNode.packageList())
    .then(pkgs => installer.installAll(pkgs))
    .then(() => {
      if (save) {
        pkg.save()
      }
      errorHandler()
    })
    .catch(e => errorHandler(e))
}

module.exports = install
