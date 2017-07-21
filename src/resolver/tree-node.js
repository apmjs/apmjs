const Promise = require('bluebird')
const error = require('../error.js')
const npm = require('../npm.js')
const _ = require('lodash')

function TreeNode (pkginfo, semver) {
  this.name = pkginfo.name
  this.children = []
  this.versions = _.filter(pkginfo.versions, version => versionMatch(semver, version))
  this.version = this.versions.pop()
}

function versionMatch (semver, version) {
  return true
}

function isCompliant (node1, node2) {
  return true
}

TreeNode.nodes = {}

TreeNode.seq = Promise.resolve()

TreeNode.create = function (name, semver) {
  return npm.getPackageInfo(name).then(pkginfo => new TreeNode(pkginfo, semver))
}

TreeNode.checkCompliance = function (target) {
  return _.forEach(TreeNode.nodes, (node, name) => {
    if (!isCompliant(node, target)) {
      throw new error.UnmetDependency(node, target)
    }
  })
}

TreeNode.prototype.tryAppendChild = function (name, semver) {
  return TreeNode.create(name, semver)
    .then(node => this.appendChild(node))
    .then(node => TreeNode.checkCompliance(node))
    .catch(err => {
      if (err.code === 'ENOTCOM') {
        return err.target.fallback(err)
      }
      throw err
    })
}

TreeNode.prototype.fallback = function (err) {
  if (!this.versions.length) {
    return this.parent ? this.parent.fallback(err) : Promise.reject(err)
  }
  // remove children
  // replace this with next available version
}

TreeNode.prototype.checkCompliance = function (node) {
  return true
}

TreeNode.prototype.appendChild = function (node) {
  this.children.push(node)
  node.parent = this
  TreeNode.packages[node.name] = node
}

TreeNode.prototype.removeChild = function (node) {
  this.children.push(node)
}
