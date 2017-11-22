'use strict'
const TreeNode = require('./tree-node.js')
const _ = require('lodash')

function loadRoot (pkg) {
  let root = new TreeNode(pkg)
  root.isRoot = true
  return root.populateChildren()
}

function getAllDependencies () {
  return _.filter(TreeNode.nodes, node => !node.isRoot)
}

function getAllDependantPackages () {
  return getAllDependencies().map(node => node.pkg)
}

module.exports = {loadRoot, getAllDependencies, getAllDependantPackages}
