'use strict'
const Promise = require('bluebird')
const assert = require('assert')
const treePrinter = require('tree-printer')
const Package = require('../package.js')
const Semver = require('semver')
const log = require('npmlog')
const Version = require('./version.js')
const npm = require('../utils/npm.js')
const _ = require('lodash')

function TreeNode (pkg, required) {
  assert(pkg.name, 'package name is required')
  this.name = pkg.name
  this.parents = {}
  this.children = {}
  this.referenceCount = 0
  this.required = required || 'ROOT'
  this.setPackage(pkg)
  TreeNode.nodes[this.name] = this
  log.silly(this.toString(), 'created')
}

TreeNode.nodes = {}
TreeNode.referenceCounts = {}

TreeNode.packageList = function () {
  let notRoot = pkg => pkg.required !== 'ROOT'
  return _.filter(TreeNode.nodes, notRoot).map(node => node.pkg)
}

TreeNode.prototype.toPlainTree = function () {
  let obj = {
    name: this.toString(),
    children: _.map(this.children, child => child.toPlainTree())
  }
  return obj
}

TreeNode.prototype.printTree = function () {
  let tree = this.toPlainTree()
  let str = this.toString()
  let children = treePrinter(tree.children, {format: {root: ''}}).trim()
  if (children) {
    str += '\n' + children
  }
  console.log(str)
}

TreeNode.prototype.ensureDependency = function (name, semver) {
  if (this.children[name]) {
    this.children[name].remove(this)
  }
  let saveVersion = Version.versionToSave(semver)
  return this.addDependency(name, semver, saveVersion)
}

TreeNode.prototype.addDependency = function (name, semver, saveVersion) {
  log.silly(`addDependency: ${name}@${semver}`)
  return npm
    .getPackageMeta(name, this.pkg)
    .then(info => {
      semver = semver || this.dependencies[name] || Version.derive(info)
      log.silly('finding maxSatisfying for name:', name, 'semver:', semver)
      let target = Package.createMaxSatisfying(info, semver, `required by ${this}`)
      let installed = TreeNode.nodes[name]

      if (installed) {
        installed.checkConformance(target, semver, this)
        this.appendChild(installed, semver, saveVersion)
        return installed.upgradeTo(target).then(() => installed)
      }

      let node = new TreeNode(target, semver)
      this.appendChild(node, semver, saveVersion)
      return node.populateChildren().then(() => node)
    })
}

TreeNode.prototype.checkConformance = function (pkg, semver, parent) {
  log.silly('checking comformance between', `${pkg.name}@${pkg.version} and ${this}`)
  if (this.version === pkg.version) {
    return
  }
  // erro promotion goes here, one by one...
  let p = _.sample(this.parents)
  let installed = {
    version: this.version,
    required: p ? p.dependencies[this.name] : '*',
    parent: p || 'ROOT'
  }
  let installing = {
    version: pkg.version,
    required: semver,
    parent: parent
  }
  Version.upgradeWarning(this.name, installed, installing)
}

TreeNode.prototype.upgradeTo = function (pkg) {
  if (Semver.gte(this.version, pkg.version)) {
    return Promise.resolve()
  }
  this.setPackage(pkg)
  this.prune()
  return this.populateChildren()
}

TreeNode.prototype.prune = function () {
  let installed = _.keys(this.children)
  let needed = _.keys(this.dependencies)
  let isolated = _.difference(installed, needed)
  log.silly(`pruning isolated packages for ${this}`, isolated)
  _.forEach(isolated, name => this.children[name].remove(this))
}

TreeNode.prototype.populateChildren = function () {
  let dependencies = _.keys(this.dependencies)
  log.silly(`populating children ${dependencies} for ${this}`)
  return Promise
    // no need to pass version, using this.<dep>.version
    .each(dependencies, name => this.addDependency(name))
    .then(() => this)
}

TreeNode.prototype.toString = function () {
  return Package.prototype.toString.call(this)
}

TreeNode.prototype.setPackage = function (pkg) {
  log.silly('setPackage ', pkg.name, 'to version:', pkg.version)
  this.pkg = pkg
  this.dependencies = pkg.dependencies || {}
  this.version = pkg.version
}

TreeNode.prototype.appendChild = function (child, semver, saveVersion) {
  log.silly('appendingChild', child.toString(), 'to', this.toString())
  this.dependencies[child.name] = saveVersion || semver
  child.parents[this.name] = this
  child.referenceCount++
  this.children[child.name] = child
  return this
}

TreeNode.prototype.destroy = function () {
  log.silly('destroying node', this.toString())
  _.forEach(this.children, child => child.remove(this))
  delete TreeNode.nodes[this.name]
}

TreeNode.prototype.remove = function (parent) {
  delete this.parents[parent.name].children[this.name]
  delete this.parents[parent.name]

  this.referenceCount--
  if (this.referenceCount <= 0) {
    this.destroy()
  }
}

module.exports = TreeNode
