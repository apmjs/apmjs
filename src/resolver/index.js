'use strict'
const TreeNode = require('./tree-node.js')
const log = require('npmlog')
const _ = require('lodash')

function loadRoot (pkg) {
  log.verbose('loading local tree...')
  var ret = pkg.noPackageJSON
    ? Promise.resolve()
    : TreeNode.loadLockfile(pkg.lockfilePath)
  return ret.then(() => {
    let root = new TreeNode(pkg)
    root.isRoot = true
    return root.populateChildren()
  })
}

function getAllDependencies () {
  return _.filter(TreeNode.nodes, node => !node.isRoot)
}

function getAllDependantPackages () {
  return getAllDependencies().map(node => node.pkg)
}

module.exports = {loadRoot, getAllDependencies, getAllDependantPackages}
