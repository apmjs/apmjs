'use strict'
const TreeNode = require('./tree-node.js')
const log = require('npmlog')
const _ = require('lodash')

function loadRoot (pkg, options) {
  options = options || {}
  log.verbose('loading local tree...')
  var ret = pkg.noPackageJSON
    ? Promise.resolve()
    : TreeNode.loadLockfile(pkg.lockfilePath)
  return ret.then(() => {
    let root = new TreeNode(pkg)
    root.isRoot = true
    root.saved = true
    return root.populateChildren(options)
  })
}

function getDependencies () {
  return _.filter(TreeNode.nodes, node => !node.isRoot)
}

function getDependantPackages () {
  return getDependencies().map(node => node.pkg)
}

function getSavedPackages () {
  return getDependencies().filter(node => node.saved).map(node => node.pkg)
}

module.exports = {loadRoot, getDependencies, getDependantPackages, getSavedPackages}
