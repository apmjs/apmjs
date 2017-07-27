const TreeNode = require('./tree-node.js')

function loadRoot (pkg) {
  var versionMap = {}
  versionMap[pkg.version] = pkg
  return new TreeNode(pkg.name, versionMap)
}

module.exports = {loadRoot}
